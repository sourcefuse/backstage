import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import type {Granularity} from '@aws-sdk/client-cost-explorer';

const TABLE = 'plugin_aws_cost_entity_settings';

export const awsCostSettingsPlugin = createBackendPlugin({
  pluginId: 'aws-cost-settings',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
      },
      async init({httpRouter, database, logger}) {
        const db = await database.getClient();

        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.increments('id').primary();
            table.string('entity_ref', 512).notNullable();
            table.string('config_name', 255).notNullable().defaultTo('Default');
            // Credentials stored server-side only, never returned to frontend
            table.text('aws_access_key_id').notNullable();
            table.text('aws_secret_access_key').notNullable();
            table.text('aws_session_token').nullable(); // STS temporary credentials
            table.string('aws_region', 64).notNullable().defaultTo('us-east-1');
            table.string('aws_account_id', 32).defaultTo('');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_aws_cost_entity_settings table');
        } else {
          // Migrate existing table: add session_token column if missing
          const hasSessionToken = await db.schema.hasColumn(TABLE, 'aws_session_token');
          if (!hasSessionToken) {
            await db.schema.alterTable(TABLE, table => {
              table.text('aws_session_token').nullable();
            });
            logger.info('Migrated plugin_aws_cost_entity_settings: added aws_session_token column');
          }
        }

        const router = Router();
        router.use(express.json());

        // GET all configs for an entity — never expose credentials
        router.get('/', async (req, res) => {
          const {entityRef} = req.query;
          if (!entityRef || typeof entityRef !== 'string') {
            return res.status(400).json({error: 'entityRef query param required'});
          }
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .orderBy('created_at', 'asc')
            .select(
              'id',
              'entity_ref',
              'config_name',
              'aws_region',
              'aws_account_id',
              'aws_session_token', // included only as a boolean flag below
              'created_at',
              'updated_at',
            );
          return res.json(
            rows.map((r: any) => ({
              id: r.id,
              entity_ref: r.entity_ref,
              config_name: r.config_name,
              aws_region: r.aws_region,
              aws_account_id: r.aws_account_id,
              created_at: r.created_at,
              updated_at: r.updated_at,
              has_credentials: true,
              has_session_token: Boolean(r.aws_session_token?.trim()),
            })),
          );
        });

        // POST create new config
        router.post('/', async (req, res) => {
          const {
            entityRef,
            configName,
            awsAccessKeyId,
            awsSecretAccessKey,
            awsSessionToken,
            awsRegion,
            awsAccountId,
          } = req.body;
          if (!entityRef || !awsAccessKeyId || !awsSecretAccessKey) {
            return res.status(400).json({
              error: 'entityRef, awsAccessKeyId and awsSecretAccessKey are required',
            });
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: configName?.trim() || 'Default',
              aws_access_key_id: awsAccessKeyId.trim(),
              aws_secret_access_key: awsSecretAccessKey.trim(),
              aws_session_token: awsSessionToken?.trim() || null,
              aws_region: awsRegion?.trim() || 'us-east-1',
              aws_account_id: awsAccountId?.trim() || '',
            })
            .returning([
              'id',
              'entity_ref',
              'config_name',
              'aws_region',
              'aws_account_id',
              'aws_session_token',
              'created_at',
              'updated_at',
            ]);
          return res.status(201).json({
            id: row.id,
            entity_ref: row.entity_ref,
            config_name: row.config_name,
            aws_region: row.aws_region,
            aws_account_id: row.aws_account_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            has_credentials: true,
            has_session_token: Boolean(row.aws_session_token?.trim()),
          });
        });

        // PUT update existing config — only update credentials if new values provided
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {
            configName,
            awsAccessKeyId,
            awsSecretAccessKey,
            awsSessionToken,
            awsRegion,
            awsAccountId,
          } = req.body;
          const updates: Record<string, any> = {
            updated_at: db.fn.now(),
            config_name: configName?.trim() || 'Default',
            aws_region: awsRegion?.trim() || 'us-east-1',
            aws_account_id: awsAccountId?.trim() || '',
          };
          if (awsAccessKeyId?.trim()) updates.aws_access_key_id = awsAccessKeyId.trim();
          if (awsSecretAccessKey?.trim())
            updates.aws_secret_access_key = awsSecretAccessKey.trim();
          // Allow explicitly clearing session token by passing empty string,
          // or updating it when a new value is provided
          if (awsSessionToken !== undefined) {
            updates.aws_session_token = awsSessionToken?.trim() || null;
          }
          await db(TABLE).where({id}).update(updates);
          const row = await db(TABLE)
            .where({id})
            .select(
              'id',
              'entity_ref',
              'config_name',
              'aws_region',
              'aws_account_id',
              'aws_session_token',
              'created_at',
              'updated_at',
            )
            .first();
          return res.json({
            id: row.id,
            entity_ref: row.entity_ref,
            config_name: row.config_name,
            aws_region: row.aws_region,
            aws_account_id: row.aws_account_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            has_credentials: true,
            has_session_token: Boolean(row.aws_session_token?.trim()),
          });
        });

        // DELETE config
        router.delete('/:id', async (req, res) => {
          await db(TABLE).where({id: req.params.id}).delete();
          return res.status(204).send();
        });

        // GET /cost/:id — query AWS Cost Explorer using stored credentials
        // Cost Explorer is a global AWS service; region is always us-east-1 for the API endpoint
        router.get('/cost/:id', async (req, res) => {
          const {id} = req.params;
          const {startDate, endDate, granularity = 'MONTHLY'} = req.query;

          const row = await db(TABLE).where({id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          // Use session token (STS temporary credentials) if present,
          // otherwise fall back to permanent IAM access key + secret
          const credentials: {
            accessKeyId: string;
            secretAccessKey: string;
            sessionToken?: string;
          } = {
            accessKeyId: row.aws_access_key_id,
            secretAccessKey: row.aws_secret_access_key,
          };
          if (row.aws_session_token?.trim()) {
            credentials.sessionToken = row.aws_session_token.trim();
            logger.info(`aws-cost-settings: using STS session token for config ${id}`);
          }

          const client = new CostExplorerClient({
            region: 'us-east-1', // Cost Explorer API is always us-east-1
            credentials,
          });

          const today = new Date().toISOString().split('T')[0];
          const sixMonthsAgo = (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
          })();

          const start = (startDate as string) || sixMonthsAgo;
          const end = (endDate as string) || today;

          try {
            const command = new GetCostAndUsageCommand({
              TimePeriod: {Start: start, End: end},
              Granularity: granularity as Granularity,
              Metrics: ['UnblendedCost'],
              GroupBy: [{Type: 'DIMENSION', Key: 'SERVICE'}],
            });
            const data = await client.send(command);
            return res.json(data);
          } catch (err: any) {
            logger.error('AWS Cost Explorer error:', err);
            return res.status(500).json({error: err.message ?? 'AWS API error'});
          }
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/aws-cost-settings',
          allow: 'unauthenticated',
        });
        logger.info('aws-cost-settings plugin registered at /api/aws-cost-settings');
      },
    });
  },
});
