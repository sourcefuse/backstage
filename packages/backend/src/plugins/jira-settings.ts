import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_jira_entity_settings';

export const jiraSettingsPlugin = createBackendPlugin({
  pluginId: 'jira-settings',
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
            // Jira instance URL, e.g. https://sourcefuse.atlassian.net
            table.string('jira_url', 1024).notNullable();
            table.string('project_key', 64).notNullable();
            table.string('component_name', 255).notNullable().defaultTo('');
            table.string('labels', 512).notNullable().defaultTo('');
            // Base64-encoded "email:api-token" for Basic auth
            table.text('jira_token').notNullable().defaultTo('');
            table.string('data_scope', 32).notNullable().defaultTo('current_sprint');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_jira_entity_settings table');
        } else {
          // Migrate: add columns if missing
          const hasToken = await db.schema.hasColumn(TABLE, 'jira_token');
          if (!hasToken) {
            await db.schema.alterTable(TABLE, table => {
              table.text('jira_token').notNullable().defaultTo('');
            });
            logger.info('Added jira_token column to plugin_jira_entity_settings');
          }
          const hasUrl = await db.schema.hasColumn(TABLE, 'jira_url');
          if (!hasUrl) {
            await db.schema.alterTable(TABLE, table => {
              table.string('jira_url', 1024).notNullable().defaultTo('https://sourcefuse.atlassian.net');
            });
            logger.info('Added jira_url column to plugin_jira_entity_settings');
          }
          const hasDataScope = await db.schema.hasColumn(TABLE, 'data_scope');
          if (!hasDataScope) {
            await db.schema.alterTable(TABLE, table => {
              table.string('data_scope', 32).notNullable().defaultTo('current_sprint');
            });
            logger.info('Added data_scope column to plugin_jira_entity_settings');
          }
        }

        const router = Router();
        router.use(express.json());

        // GET all configs for an entity (token is masked in response)
        router.get('/', async (req, res) => {
          const {entityRef} = req.query;
          if (!entityRef || typeof entityRef !== 'string') {
            return res.status(400).json({error: 'entityRef query param is required'});
          }
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .orderBy('created_at', 'asc');
          const safe = rows.map(r => ({...r, jira_token: r.jira_token ? '••••••' : ''}));
          return res.json(safe);
        });

        // Create a new config for an entity
        router.post('/', async (req, res) => {
          const {entityRef, configName, jiraUrl, projectKey, componentName, labels, jiraEmail, jiraApiToken, dataScope} = req.body;
          if (!entityRef || !projectKey || !jiraUrl) {
            return res.status(400).json({error: 'entityRef, jiraUrl, and projectKey are required'});
          }
          // Build base64 token from email + API token
          let token = '';
          if (jiraEmail && jiraApiToken) {
            token = Buffer.from(`${jiraEmail.trim()}:${jiraApiToken.trim()}`).toString('base64');
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: configName?.trim() || 'Default',
              jira_url: jiraUrl.trim().replace(/\/$/, ''),
              project_key: projectKey.trim(),
              component_name: (componentName ?? '').trim(),
              labels: (labels ?? '').trim(),
              jira_token: token,
              data_scope: dataScope || 'current_sprint',
            })
            .returning('*');
          return res.status(201).json({...row, jira_token: row.jira_token ? '••••••' : ''});
        });

        // Update an existing config by id
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {configName, jiraUrl, projectKey, componentName, labels, jiraEmail, jiraApiToken, dataScope} = req.body;
          if (!projectKey || !jiraUrl) {
            return res.status(400).json({error: 'jiraUrl and projectKey are required'});
          }
          const update: Record<string, any> = {
            config_name: configName?.trim() || 'Default',
            jira_url: jiraUrl.trim().replace(/\/$/, ''),
            project_key: projectKey.trim(),
            component_name: (componentName ?? '').trim(),
            labels: (labels ?? '').trim(),
            data_scope: dataScope || 'current_sprint',
            updated_at: db.fn.now(),
          };
          // Only overwrite token when user explicitly provides new credentials
          if (jiraEmail && jiraApiToken) {
            update.jira_token = Buffer.from(`${jiraEmail.trim()}:${jiraApiToken.trim()}`).toString('base64');
          }
          const [row] = await db(TABLE)
            .where({id})
            .update(update)
            .returning('*');
          if (!row) return res.status(404).json({error: 'Not found'});
          return res.json({...row, jira_token: row.jira_token ? '••••••' : ''});
        });

        // Delete a config by id
        router.delete('/:id', async (req, res) => {
          const {id} = req.params;
          await db(TABLE).where({id}).delete();
          return res.json({success: true});
        });

        // Proxy GET requests to Jira REST API using per-config token and URL
        router.get('/proxy/:id/*', async (req, res) => {
          const {id} = req.params;
          const jiraPath = (req.params as any)[0] as string;

          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});
          if (!row.jira_token) {
            return res.status(400).json({error: 'No Jira API token configured for this project'});
          }

          const qs =
            Object.keys(req.query).length > 0
              ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
              : '';
          const targetUrl = `${row.jira_url.replace(/\/$/, '')}/${jiraPath}${qs}`;

          try {
            const upstream = await fetch(targetUrl, {
              headers: {
                Authorization: `Basic ${row.jira_token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Atlassian-Token': 'no-check',
              },
            });

            const contentType =
              upstream.headers.get('content-type') ?? 'application/json';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'private, max-age=30');
            res.status(upstream.status);
            return res.send(Buffer.from(await upstream.arrayBuffer()));
          } catch (e: any) {
            return res
              .status(502)
              .json({error: `Failed to reach Jira: ${e.message ?? e}`});
          }
        });

        httpRouter.use(router);
      },
    });
  },
});
