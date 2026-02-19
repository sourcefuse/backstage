import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_prometheus_entity_settings';

export const prometheusSettingsPlugin = createBackendPlugin({
  pluginId: 'prometheus-settings',
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
            table.string('prometheus_url', 1024).notNullable();
            // Optional Bearer token — stored server-side, never returned to frontend
            table.text('prometheus_token').defaultTo('');
            // JSON array of {name: string, expr: string}
            table.text('promql_queries').defaultTo('[]');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_prometheus_entity_settings table');
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
            .orderBy('created_at', 'asc')
            .select('id', 'entity_ref', 'config_name', 'prometheus_url', 'promql_queries', 'created_at', 'updated_at');
          // Map: include has_token flag but never expose the token value
          const result = rows.map((r: any) => ({...r, has_token: Boolean(r.prometheus_token)}));
          return res.json(result);
        });

        // Create a new config for an entity
        router.post('/', async (req, res) => {
          const {entityRef, configName, prometheusUrl, prometheusToken, promqlQueries} = req.body;
          if (!entityRef || !prometheusUrl) {
            return res.status(400).json({error: 'entityRef and prometheusUrl are required'});
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: configName?.trim() || 'Default',
              prometheus_url: prometheusUrl.trim(),
              prometheus_token: (prometheusToken ?? '').trim(),
              promql_queries: JSON.stringify(promqlQueries ?? []),
            })
            .returning(['id', 'entity_ref', 'config_name', 'prometheus_url', 'promql_queries', 'created_at', 'updated_at']);
          return res.status(201).json({...row, has_token: Boolean((prometheusToken ?? '').trim())});
        });

        // Update an existing config by id
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {configName, prometheusUrl, prometheusToken, promqlQueries} = req.body;
          if (!prometheusUrl) {
            return res.status(400).json({error: 'prometheusUrl is required'});
          }
          const update: Record<string, any> = {
            config_name: configName?.trim() || 'Default',
            prometheus_url: prometheusUrl.trim(),
            promql_queries: JSON.stringify(promqlQueries ?? []),
            updated_at: db.fn.now(),
          };
          // Only overwrite token when user explicitly provides a new one
          if (prometheusToken && prometheusToken.trim()) {
            update.prometheus_token = prometheusToken.trim();
          }
          const [row] = await db(TABLE)
            .where({id})
            .update(update)
            .returning(['id', 'entity_ref', 'config_name', 'prometheus_url', 'promql_queries', 'created_at', 'updated_at']);
          if (!row) return res.status(404).json({error: 'Not found'});
          // Re-read the has_token from DB (in case token wasn't updated)
          const full = await db(TABLE).where({id}).first();
          return res.json({...row, has_token: Boolean(full?.prometheus_token)});
        });

        // Delete a config by id
        router.delete('/:id', async (req, res) => {
          const {id} = req.params;
          await db(TABLE).where({id}).delete();
          return res.json({success: true});
        });

        // Proxy Prometheus API requests using the per-config URL and token.
        // The frontend calls /proxy/:id/api/v1/<path>?<params> and this handler
        // forwards the request to Prometheus — the token never leaves the server.
        router.get('/proxy/:id/api/v1/*', async (req, res) => {
          const {id} = req.params;
          const prometheusPath = (req.params as any)[0] as string;

          const row = await db(TABLE).where({id: Number(id)}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const qs =
            Object.keys(req.query).length > 0
              ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
              : '';
          const targetUrl = `${row.prometheus_url.replace(/\/$/, '')}/api/v1/${prometheusPath}${qs}`;

          try {
            const headers: Record<string, string> = {
              Accept: 'application/json',
            };
            if (row.prometheus_token) {
              headers.Authorization = `Bearer ${row.prometheus_token}`;
            }

            const upstream = await fetch(targetUrl, {headers});
            const contentType = upstream.headers.get('content-type') ?? 'application/json';
            res.setHeader('Content-Type', contentType);
            res.status(upstream.status);
            return res.send(Buffer.from(await upstream.arrayBuffer()));
          } catch (e: any) {
            return res
              .status(502)
              .json({error: `Failed to reach Prometheus: ${e.message ?? e}`});
          }
        });

        httpRouter.use(router);
        // No addAuthPolicy — requires valid Backstage user token (sent automatically by fetchApiRef)
      },
    });
  },
});
