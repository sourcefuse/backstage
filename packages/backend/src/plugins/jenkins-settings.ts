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
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_jenkins_entity_settings table');
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
          return res.json(rows);
        });

        // Create a new config entry for an entity
        router.post('/', async (req, res) => {
          const {entityRef, configName, jobFullName} = req.body;
          if (!entityRef || !jobFullName) {
            return res.status(400).json({error: 'entityRef and jobFullName are required'});
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: (configName ?? '').trim() || 'Default',
              job_full_name: jobFullName.trim(),
            })
            .returning('*');
          return res.status(201).json(row);
        });

        // Update an existing config by id
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {configName, jobFullName} = req.body;
          if (!jobFullName) {
            return res.status(400).json({error: 'jobFullName is required'});
          }
          const [row] = await db(TABLE)
            .where({id})
            .update({
              config_name: (configName ?? '').trim() || 'Default',
              job_full_name: jobFullName.trim(),
              updated_at: db.fn.now(),
            })
            .returning('*');
          if (!row) return res.status(404).json({error: 'Not found'});
          return res.json(row);
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

        // Proxy: Fetch builds for a configured job
        router.get('/proxy/:id/builds', async (req, res) => {
          const {id} = req.params;
          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});
          if (!jenkinsBaseUrl) {
            return res.status(400).json({error: 'Jenkins base URL not configured'});
          }

          const jobPath = row.job_full_name.split('/').join('/job/');
          const url = `${jenkinsBaseUrl.replace(/\/$/, '')}/job/${jobPath}/api/json?tree=builds[number,url,result,timestamp,duration,displayName,fullDisplayName]{0,25}`;

          try {
            const upstream = await fetch(url, {
              headers: {Authorization: jenkinsAuthHeader()},
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
          if (!jenkinsBaseUrl) {
            return res.status(400).json({error: 'Jenkins base URL not configured'});
          }

          const jobPath = row.job_full_name.split('/').join('/job/');
          const url = `${jenkinsBaseUrl.replace(/\/$/, '')}/job/${jobPath}/api/json?tree=jobs[name,url,color,_class,lastBuild[number,url,result,timestamp,duration,displayName]]`;

          try {
            const upstream = await fetch(url, {
              headers: {Authorization: jenkinsAuthHeader()},
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
