import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const DEFS_TABLE = 'plugin_entity_tags_definitions';
const ASSIGNMENTS_TABLE = 'plugin_entity_tags_assignments';

export const entityTagsPlugin = createBackendPlugin({
  pluginId: 'entity-tags',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
      },
      async init({httpRouter, database, logger, httpAuth}) {
        const db = await database.getClient();

        // Create definitions table
        if (!(await db.schema.hasTable(DEFS_TABLE))) {
          await db.schema.createTable(DEFS_TABLE, table => {
            table.increments('id').primary();
            table.string('user_ref', 512).notNullable();
            table.string('tag_name', 255).notNullable();
            table.string('color', 7).notNullable().defaultTo('#1976d2');
            table.timestamps(true, true);
            table.unique(['user_ref', 'tag_name']);
          });
          logger.info(`Created ${DEFS_TABLE} table`);
        }

        // Create assignments table
        if (!(await db.schema.hasTable(ASSIGNMENTS_TABLE))) {
          await db.schema.createTable(ASSIGNMENTS_TABLE, table => {
            table.increments('id').primary();
            table
              .integer('tag_id')
              .unsigned()
              .notNullable()
              .references('id')
              .inTable(DEFS_TABLE)
              .onDelete('CASCADE');
            table.string('entity_ref', 512).notNullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.unique(['tag_id', 'entity_ref']);
          });
          logger.info(`Created ${ASSIGNMENTS_TABLE} table`);
        }

        const router = Router();
        router.use(express.json());

        // Helper: extract user ref from request credentials
        async function getUserRef(req: express.Request): Promise<string> {
          const credentials = await httpAuth.credentials(req, {allow: ['user']});
          return (credentials.principal as any).userEntityRef;
        }

        // GET /tags — list current user's tags
        router.get('/tags', async (req, res) => {
          const userRef = await getUserRef(req);
          const rows = await db(DEFS_TABLE)
            .where({user_ref: userRef})
            .orderBy('tag_name', 'asc');
          return res.json(rows);
        });

        // POST /tags — create a tag {name, color?}
        router.post('/tags', async (req, res) => {
          const userRef = await getUserRef(req);
          const {name, color} = req.body;
          if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({error: 'name is required'});
          }
          try {
            const [row] = await db(DEFS_TABLE)
              .insert({
                user_ref: userRef,
                tag_name: name.trim(),
                color: (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#1976d2',
              })
              .returning('*');
            return res.status(201).json(row);
          } catch (e: any) {
            if (e.code === '23505' || e.message?.includes('UNIQUE')) {
              return res.status(409).json({error: 'Tag name already exists'});
            }
            throw e;
          }
        });

        // DELETE /tags/:id — delete tag + cascade assignments
        router.delete('/tags/:id', async (req, res) => {
          const userRef = await getUserRef(req);
          const {id} = req.params;
          const deleted = await db(DEFS_TABLE)
            .where({id, user_ref: userRef})
            .delete();
          if (!deleted) return res.status(404).json({error: 'Tag not found'});
          return res.json({success: true});
        });

        // GET /assignments/:entityRef — get tags assigned to an entity for current user
        router.get('/assignments/:entityRef', async (req, res) => {
          const userRef = await getUserRef(req);
          const {entityRef} = req.params;
          const rows = await db(ASSIGNMENTS_TABLE)
            .join(DEFS_TABLE, `${DEFS_TABLE}.id`, `${ASSIGNMENTS_TABLE}.tag_id`)
            .where({[`${DEFS_TABLE}.user_ref`]: userRef, [`${ASSIGNMENTS_TABLE}.entity_ref`]: entityRef})
            .select(`${ASSIGNMENTS_TABLE}.tag_id`);
          return res.json(rows.map(r => r.tag_id));
        });

        // PUT /assignments/:entityRef — set tags {tagIds: []} for an entity
        router.put('/assignments/:entityRef', async (req, res) => {
          const userRef = await getUserRef(req);
          const {entityRef} = req.params;
          const {tagIds} = req.body;
          if (!Array.isArray(tagIds)) {
            return res.status(400).json({error: 'tagIds array is required'});
          }

          // Verify all tagIds belong to this user
          if (tagIds.length > 0) {
            const owned = await db(DEFS_TABLE)
              .where({user_ref: userRef})
              .whereIn('id', tagIds)
              .select('id');
            const ownedIds = new Set(owned.map(r => r.id));
            const invalid = tagIds.filter(id => !ownedIds.has(id));
            if (invalid.length > 0) {
              return res.status(403).json({error: 'Some tag IDs do not belong to you'});
            }
          }

          // Delete existing assignments for this entity (scoped to user's tags)
          const userTagIds = await db(DEFS_TABLE)
            .where({user_ref: userRef})
            .select('id');
          const allUserTagIds = userTagIds.map(r => r.id);
          if (allUserTagIds.length > 0) {
            await db(ASSIGNMENTS_TABLE)
              .where({entity_ref: entityRef})
              .whereIn('tag_id', allUserTagIds)
              .delete();
          }

          // Insert new assignments
          if (tagIds.length > 0) {
            await db(ASSIGNMENTS_TABLE).insert(
              tagIds.map((tagId: number) => ({
                tag_id: tagId,
                entity_ref: entityRef,
              })),
            );
          }

          return res.json({success: true});
        });

        // GET /entities?tagIds=1,2 — get entity refs matching ALL given tag IDs
        router.get('/entities', async (req, res) => {
          const userRef = await getUserRef(req);
          const {tagIds: tagIdsStr} = req.query;
          if (!tagIdsStr || typeof tagIdsStr !== 'string') {
            return res.status(400).json({error: 'tagIds query param is required'});
          }
          const tagIds = tagIdsStr.split(',').map(Number).filter(n => !isNaN(n));
          if (tagIds.length === 0) {
            return res.json([]);
          }

          // Verify tags belong to user
          const owned = await db(DEFS_TABLE)
            .where({user_ref: userRef})
            .whereIn('id', tagIds)
            .select('id');
          if (owned.length !== tagIds.length) {
            return res.status(403).json({error: 'Some tag IDs do not belong to you'});
          }

          // Find entities that have ALL the requested tags
          const rows = await db(ASSIGNMENTS_TABLE)
            .whereIn('tag_id', tagIds)
            .select('entity_ref')
            .groupBy('entity_ref')
            .havingRaw('count(distinct tag_id) = ?', [tagIds.length]);

          return res.json(rows.map(r => r.entity_ref));
        });

        httpRouter.use(router);
      },
    });
  },
});
