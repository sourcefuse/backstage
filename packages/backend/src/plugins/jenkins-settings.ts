import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_jenkins_entity_settings';

export const jenkinsSettingsPlugin = createBackendPlugin({
  pluginId: 'jenkins-settings',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({httpRouter, database, logger, config}) {
        const db = await database.getClient();

        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.increments('id').primary();
            table.string('entity_ref', 512).notNullable();
            table.string('config_name', 255).notNullable().defaultTo('Default');
            table.string('job_full_name', 1024).notNullable();
            // Per-config Jenkins credentials (optional – falls back to global config)
            table.string('jenkins_url', 1024).notNullable().defaultTo('');
            table.string('jenkins_username', 255).notNullable().defaultTo('');
            table.text('jenkins_token').notNullable().defaultTo('');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_jenkins_entity_settings table');
        } else {
          // Migrate: add credential columns if missing
          const cols = await Promise.all([
            db.schema.hasColumn(TABLE, 'jenkins_url'),
            db.schema.hasColumn(TABLE, 'jenkins_username'),
            db.schema.hasColumn(TABLE, 'jenkins_token'),
          ]);
          if (!cols[0] || !cols[1] || !cols[2]) {
            await db.schema.alterTable(TABLE, table => {
              if (!cols[0]) table.string('jenkins_url', 1024).notNullable().defaultTo('');
              if (!cols[1]) table.string('jenkins_username', 255).notNullable().defaultTo('');
              if (!cols[2]) table.text('jenkins_token').notNullable().defaultTo('');
            });
            logger.info('Added jenkins credential columns to plugin_jenkins_entity_settings');
          }
        }

        // Read global Jenkins config from app-config.yaml
        const instances = config.getOptionalConfigArray('jenkins.instances') ?? [];
        const defaultInstance = instances[0];
        const jenkinsBaseUrl = defaultInstance?.getOptionalString('baseUrl') ?? '';
        const jenkinsUsername = defaultInstance?.getOptionalString('username') ?? '';
        const jenkinsApiKey = defaultInstance?.getOptionalString('apiKey') ?? '';

        function jenkinsAuthHeader(): string {
          return `Basic ${Buffer.from(`${jenkinsUsername}:${jenkinsApiKey}`).toString('base64')}`;
        }

        const router = Router();
        router.use(express.json());

        // GET all configs for an entity
        router.get('/', async (req, res) => {
          const {entityRef} = req.query;
          if (!entityRef || typeof entityRef !== 'string') {
            return res.status(400).json({error: 'entityRef query param is required'});
          }
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .orderBy('created_at', 'asc');
          const safe = rows.map(r => ({...r, jenkins_token: r.jenkins_token ? '••••••' : ''}));
          return res.json(safe);
        });

        // Create a new config entry for an entity
        router.post('/', async (req, res) => {
          const {entityRef, configName, jobFullName, jenkinsUrl, jenkinsUsername, jenkinsApiToken} = req.body;
          if (!entityRef || !jobFullName) {
            return res.status(400).json({error: 'entityRef and jobFullName are required'});
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: (configName ?? '').trim() || 'Default',
              job_full_name: jobFullName.trim(),
              jenkins_url: (jenkinsUrl ?? '').trim().replace(/\/$/, ''),
              jenkins_username: (jenkinsUsername ?? '').trim(),
              jenkins_token: (jenkinsApiToken ?? '').trim(),
            })
            .returning('*');
          return res.status(201).json({...row, jenkins_token: row.jenkins_token ? '••••••' : ''});
        });

        // Update an existing config by id
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {configName, jobFullName, jenkinsUrl, jenkinsUsername, jenkinsApiToken} = req.body;
          if (!jobFullName) {
            return res.status(400).json({error: 'jobFullName is required'});
          }
          const update: Record<string, any> = {
            config_name: (configName ?? '').trim() || 'Default',
            job_full_name: jobFullName.trim(),
            updated_at: db.fn.now(),
          };
          // Always update URL and username if provided
          if (jenkinsUrl !== undefined) {
            update.jenkins_url = jenkinsUrl.trim().replace(/\/$/, '');
          }
          if (jenkinsUsername !== undefined) {
            update.jenkins_username = jenkinsUsername.trim();
          }
          // Only overwrite token when explicitly provided
          if (jenkinsApiToken) {
            update.jenkins_token = jenkinsApiToken.trim();
          }
          const [row] = await db(TABLE)
            .where({id})
            .update(update)
            .returning('*');
          if (!row) return res.status(404).json({error: 'Not found'});
          return res.json({...row, jenkins_token: row.jenkins_token ? '••••••' : ''});
        });

        // Delete a config by id
        router.delete('/:id', async (req, res) => {
          const {id} = req.params;
          await db(TABLE).where({id}).delete();
          return res.json({success: true});
        });

        // List available Jenkins jobs (for browsing)
        router.get('/jobs', async (_req, res) => {
          if (!jenkinsBaseUrl) {
            return res.status(400).json({error: 'Jenkins base URL not configured'});
          }
          const path = (_req.query.path as string) || '';
          const url = path
            ? `${jenkinsBaseUrl.replace(/\/$/, '')}/job/${path.split('/').join('/job/')}/api/json?tree=jobs[name,url,_class]`
            : `${jenkinsBaseUrl.replace(/\/$/, '')}/api/json?tree=jobs[name,url,_class]`;

          try {
            const upstream = await fetch(url, {
              headers: {Authorization: jenkinsAuthHeader()},
            });
            if (!upstream.ok) {
              return res.status(upstream.status).json({error: `Jenkins returned HTTP ${upstream.status}`});
            }
            const data = await upstream.json();
            return res.json(data.jobs ?? []);
          } catch (e: any) {
            return res.status(502).json({error: `Failed to reach Jenkins: ${e.message ?? e}`});
          }
        });

        // Resolve credentials: per-config overrides global
        function resolveCredentials(row: any): {baseUrl: string; authHeader: string} {
          const baseUrl = (row.jenkins_url || jenkinsBaseUrl).replace(/\/$/, '');
          const user = row.jenkins_username || jenkinsUsername;
          const token = row.jenkins_token || jenkinsApiKey;
          const authHeader = user && token
            ? `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
            : jenkinsAuthHeader();
          return {baseUrl, authHeader};
        }

        // Proxy: Fetch builds for a configured job
        router.get('/proxy/:id/builds', async (req, res) => {
          const {id} = req.params;
          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {baseUrl, authHeader} = resolveCredentials(row);
          if (!baseUrl) {
            return res.status(400).json({error: 'Jenkins base URL not configured'});
          }

          const jobPath = row.job_full_name.split('/').join('/job/');
          const url = `${baseUrl}/job/${jobPath}/api/json?tree=builds[number,url,result,timestamp,duration,displayName,fullDisplayName]{0,25}`;

          try {
            const upstream = await fetch(url, {
              headers: {Authorization: authHeader},
            });
            if (!upstream.ok) {
              const body = await upstream.text();
              return res.status(upstream.status).json({error: body || `Jenkins returned HTTP ${upstream.status}`});
            }
            const data = await upstream.json();
            return res.json(data.builds ?? []);
          } catch (e: any) {
            return res.status(502).json({error: `Failed to reach Jenkins: ${e.message ?? e}`});
          }
        });

        // Proxy: Fetch sub-jobs for a configured folder
        router.get('/proxy/:id/jobs', async (req, res) => {
          const {id} = req.params;
          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {baseUrl, authHeader} = resolveCredentials(row);
          if (!baseUrl) {
            return res.status(400).json({error: 'Jenkins base URL not configured'});
          }

          const jobPath = row.job_full_name.split('/').join('/job/');
          const url = `${baseUrl}/job/${jobPath}/api/json?tree=jobs[name,url,color,_class,lastBuild[number,url,result,timestamp,duration,displayName]]`;

          try {
            const upstream = await fetch(url, {
              headers: {Authorization: authHeader},
            });
            if (!upstream.ok) {
              const body = await upstream.text();
              return res.status(upstream.status).json({error: body || `Jenkins returned HTTP ${upstream.status}`});
            }
            const data = await upstream.json();
            return res.json(data.jobs ?? []);
          } catch (e: any) {
            return res.status(502).json({error: `Failed to reach Jenkins: ${e.message ?? e}`});
          }
        });

        httpRouter.use(router);
      },
    });
  },
});
