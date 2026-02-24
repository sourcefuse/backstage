import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_portal_settings';
const DEFAULT_BADGE_TEXT = 'ARC · Developer Portal';

export const portalSettingsPlugin = createBackendPlugin({
  pluginId: 'portal-settings',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
      },
      async init({ httpRouter, database, logger }) {
        const db = await database.getClient();

        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.string('key', 255).primary();
            table.text('value').notNullable();
            table.timestamps(true, true);
          });
          await db(TABLE).insert({ key: 'hero_badge_text', value: DEFAULT_BADGE_TEXT });
          logger.info('Created plugin_portal_settings table');
        }

        const router = Router();
        router.use(express.json());

        // GET ?key=hero_badge_text
        router.get('/', async (req, res) => {
          const { key } = req.query;
          if (!key || typeof key !== 'string') {
            return res.status(400).json({ error: 'key query param is required' });
          }
          const row = await db(TABLE).where({ key }).first();
          if (!row) return res.status(404).json({ error: 'Not found' });
          return res.json({ key: row.key, value: row.value });
        });

        // PUT { key, value }
        router.put('/', async (req, res) => {
          const { key, value } = req.body;
          if (!key || value === undefined) {
            return res.status(400).json({ error: 'key and value are required' });
          }
          await db(TABLE)
            .insert({ key, value, updated_at: db.fn.now() })
            .onConflict('key')
            .merge(['value', 'updated_at']);
          return res.json({ key, value });
        });

        httpRouter.use(router);
      },
    });
  },
});
