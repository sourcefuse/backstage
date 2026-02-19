import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_grafana_entity_settings';

export const grafanaSettingsPlugin = createBackendPlugin({
  pluginId: 'grafana-settings',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
      },
      async init({httpRouter, database, logger}) {
        const db = await database.getClient();

        const hasTable = await db.schema.hasTable(TABLE);
        if (hasTable) {
          // Migrate from v1 schema (entity_ref as PK, no id column, no dashboard_name)
          const hasIdColumn = await db.schema.hasColumn(TABLE, 'id');
          if (!hasIdColumn) {
            logger.info('Migrating grafana settings table to multi-dashboard schema');
            await db.schema.dropTable(TABLE);
          }
        }

        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.increments('id').primary();
            table.string('entity_ref', 512).notNullable();
            table.string('dashboard_name', 255).notNullable().defaultTo('Default');
            table.string('grafana_url', 1024).notNullable();
            table.text('dashboard_path').notNullable().defaultTo('');
            // Optional service account token — used as auth_token in the embed URL
            // so Grafana loads without redirecting to its own login page
            table.text('grafana_token').defaultTo('');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'dashboard_name']);
          });
          logger.info('Created plugin_grafana_entity_settings table (v2)');
        }

        const router = Router();
        router.use(express.json());

        // GET all dashboards for an entity
        router.get('/', async (req, res) => {
          const {entityRef} = req.query;
          if (!entityRef || typeof entityRef !== 'string') {
            return res.status(400).json({error: 'entityRef query param is required'});
          }
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .orderBy('created_at', 'asc');
          return res.json(rows);
        });

        // Create a new dashboard entry for an entity
        router.post('/', async (req, res) => {
          const {entityRef, dashboardName, grafanaUrl, dashboardPath, grafanaToken} = req.body;
          if (!entityRef || !grafanaUrl) {
            return res.status(400).json({error: 'entityRef and grafanaUrl are required'});
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              dashboard_name: dashboardName?.trim() || 'Default',
              grafana_url: grafanaUrl.trim(),
              dashboard_path: (dashboardPath ?? '').trim(),
              grafana_token: (grafanaToken ?? '').trim(),
            })
            .returning('*');
          return res.status(201).json(row);
        });

        // Update an existing dashboard by id
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {dashboardName, grafanaUrl, dashboardPath, grafanaToken} = req.body;
          if (!grafanaUrl) {
            return res.status(400).json({error: 'grafanaUrl is required'});
          }
          const update: Record<string, any> = {
            dashboard_name: dashboardName?.trim() || 'Default',
            grafana_url: grafanaUrl.trim(),
            dashboard_path: (dashboardPath ?? '').trim(),
            updated_at: db.fn.now(),
          };
          // Only overwrite the stored token when the user explicitly provides a new one.
          // An empty/missing value means "keep the existing token".
          if (grafanaToken && grafanaToken.trim()) {
            update.grafana_token = grafanaToken.trim();
          }
          const [row] = await db(TABLE)
            .where({id})
            .update(update)
            .returning('*');
          if (!row) return res.status(404).json({error: 'Not found'});
          return res.json(row);
        });

        // Delete a dashboard by id
        router.delete('/:id', async (req, res) => {
          const {id} = req.params;
          await db(TABLE).where({id}).delete();
          return res.json({success: true});
        });

        // Proxy any Grafana API request using the per-dashboard service token.
        // The frontend calls /proxy/:id/<grafana-path>?<params> and this handler
        // forwards the request to Grafana with the stored Bearer token — so the
        // token never leaves the server and no iframe is needed.
        router.get('/proxy/:id/*', async (req, res) => {
          const {id} = req.params;
          // Express wildcard captures the rest of the path in params[0]
          const grafanaPath = (req.params as any)[0] as string;

          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Dashboard not found'});
          if (!row.grafana_token) {
            return res.status(400).json({error: 'No service token configured for this dashboard'});
          }

          const qs =
            Object.keys(req.query).length > 0
              ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
              : '';
          const targetUrl = `${row.grafana_url.replace(/\/$/, '')}/${grafanaPath}${qs}`;

          try {
            const upstream = await fetch(targetUrl, {
              headers: {Authorization: `Bearer ${row.grafana_token}`},
            });

            const contentType =
              upstream.headers.get('content-type') ?? 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            // Allow frontend to cache panel images briefly
            res.setHeader('Cache-Control', 'private, max-age=60');
            res.status(upstream.status);
            return res.send(Buffer.from(await upstream.arrayBuffer()));
          } catch (e: any) {
            return res
              .status(502)
              .json({error: `Failed to reach Grafana: ${e.message ?? e}`});
          }
        });

        httpRouter.use(router);
        // No addAuthPolicy — requires valid Backstage user token (sent automatically by fetchApiRef)
      },
    });
  },
});
