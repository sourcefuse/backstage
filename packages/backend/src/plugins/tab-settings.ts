import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_tab_settings_disabled';

export const tabSettingsPlugin = createBackendPlugin({
  pluginId: 'tab-settings',
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
            table.string('tab_id', 255).notNullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.unique(['entity_ref', 'tab_id']);
          });
          logger.info(`Created ${TABLE} table`);
        }

        const router = Router();
        router.use(express.json());

        // GET /disabled/:entityRef — returns string[] of disabled tab IDs
        router.get('/disabled/:entityRef', async (req, res) => {
          const {entityRef} = req.params;
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .select('tab_id');
          return res.json(rows.map(r => r.tab_id));
        });

        // PUT /disabled/:entityRef — body { disabledTabs: string[] }
        router.put('/disabled/:entityRef', async (req, res) => {
          const {entityRef} = req.params;
          const {disabledTabs} = req.body;
          if (!Array.isArray(disabledTabs)) {
            return res.status(400).json({error: 'disabledTabs array is required'});
          }

          await db.transaction(async trx => {
            await trx(TABLE).where({entity_ref: entityRef}).delete();
            if (disabledTabs.length > 0) {
              await trx(TABLE).insert(
                disabledTabs.map((tabId: string) => ({
                  entity_ref: entityRef,
                  tab_id: tabId,
                })),
              );
            }
          });

          return res.json({success: true});
        });

        httpRouter.use(router);
      },
    });
  },
});
