import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

const TABLE = 'plugin_defect_density_cache';

/**
 * Defect Density = (bug issues closed in the week) / (lines changed in merged PRs that week / 1000)
 * Result is "bugs per KLOC" for the default branch, cached per project per ISO week.
 */
export const defectDensityPlugin = createBackendPlugin({
  pluginId: 'defect-density',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
      },
      async init({ httpRouter, database, logger }) {
        const db = await database.getClient();

        // Create table if not exists
        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.increments('id').primary();
            table.string('project_slug', 512).notNullable();
            table.string('branch', 255).notNullable().defaultTo('main');
            table.integer('week_number').notNullable();
            table.integer('year').notNullable();
            table.integer('bug_count').notNullable().defaultTo(0);
            table.integer('lines_changed').notNullable().defaultTo(0);
            table.float('defect_density').notNullable().defaultTo(0);
            table.integer('merged_pr_count').notNullable().defaultTo(0);
            table.timestamps(true, true);
            table.unique(['project_slug', 'branch', 'week_number', 'year']);
          });
          logger.info('Created plugin_defect_density_cache table');
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const githubApiUrl =
          process.env.GITHUB_API_URL || 'https://api.github.com';

        async function githubFetch(url: string) {
          const resp = await fetch(url, {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });
          if (!resp.ok) {
            throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
          }
          return resp.json();
        }

        // Get ISO week number and year
        function getISOWeek(date: Date): { week: number; year: number } {
          const d = new Date(
            Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
          );
          d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const week = Math.ceil(
            ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
          );
          return { week, year: d.getUTCFullYear() };
        }

        // Get Monday and Sunday of a given ISO week
        function getWeekRange(
          week: number,
          year: number,
        ): { from: string; to: string } {
          const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
          const dow = simple.getUTCDay();
          const monday = new Date(simple);
          if (dow <= 4) {
            monday.setUTCDate(simple.getUTCDate() - dow + 1);
          } else {
            monday.setUTCDate(simple.getUTCDate() + 8 - dow);
          }
          const sunday = new Date(monday);
          sunday.setUTCDate(monday.getUTCDate() + 6);
          return {
            from: monday.toISOString().split('T')[0],
            to: sunday.toISOString().split('T')[0],
          };
        }

        async function calculateForWeek(
          projectSlug: string,
          branch: string,
          week: number,
          year: number,
        ) {
          const { from, to } = getWeekRange(week, year);

          // 1. Count bug/defect issues closed in this week
          let bugCount = 0;
          try {
            const bugQuery = `repo:${projectSlug}+is:issue+is:closed+label:bug+closed:${from}..${to}`;
            const bugData: any = await githubFetch(
              `${githubApiUrl}/search/issues?q=${encodeURIComponent(bugQuery)}&per_page=1`,
            );
            bugCount = bugData.total_count || 0;
          } catch (e: any) {
            logger.warn(
              `Failed to fetch bug issues for ${projectSlug}: ${e.message}`,
            );
          }

          // 2. Get merged PRs in this week on the base branch
          let linesChanged = 0;
          let mergedPrCount = 0;
          try {
            const prQuery = `repo:${projectSlug}+is:pr+is:merged+base:${branch}+merged:${from}..${to}`;
            const prData: any = await githubFetch(
              `${githubApiUrl}/search/issues?q=${encodeURIComponent(prQuery)}&per_page=100`,
            );
            mergedPrCount = prData.total_count || 0;

            // Fetch additions/deletions for each PR (up to 30 to avoid rate limits)
            const prsToCheck = (prData.items || []).slice(0, 30);
            for (const pr of prsToCheck) {
              try {
                const prDetail: any = await githubFetch(pr.pull_request.url);
                linesChanged +=
                  (prDetail.additions || 0) + (prDetail.deletions || 0);
              } catch {
                // skip individual PR failures
              }
            }
          } catch (e: any) {
            logger.warn(
              `Failed to fetch PRs for ${projectSlug}: ${e.message}`,
            );
          }

          // 3. Calculate defect density (bugs per KLOC)
          const kloc = linesChanged / 1000;
          const density = kloc > 0 ? Math.round((bugCount / kloc) * 100) / 100 : 0;

          return { bugCount, linesChanged, mergedPrCount, defectDensity: density };
        }

        const router = Router();
        router.use(express.json());

        // GET /api/defect-density?projectSlug=owner/repo&branch=main
        router.get('/', async (req, res) => {
          const { projectSlug, branch: branchParam } = req.query;
          if (!projectSlug || typeof projectSlug !== 'string') {
            return res
              .status(400)
              .json({ error: 'projectSlug query param is required' });
          }

          const branch =
            typeof branchParam === 'string' ? branchParam : 'main';
          const now = new Date();
          const { week, year } = getISOWeek(now);

          // Check cache
          const cached = await db(TABLE)
            .where({
              project_slug: projectSlug,
              branch,
              week_number: week,
              year,
            })
            .first();

          if (cached) {
            return res.json({
              projectSlug,
              branch,
              week,
              year,
              bugCount: cached.bug_count,
              linesChanged: cached.lines_changed,
              defectDensity: cached.defect_density,
              mergedPrCount: cached.merged_pr_count,
              cached: true,
            });
          }

          // Calculate fresh
          if (!githubToken) {
            return res
              .status(500)
              .json({ error: 'GITHUB_TOKEN not configured' });
          }

          try {
            const result = await calculateForWeek(
              projectSlug,
              branch,
              week,
              year,
            );

            // Cache to DB (upsert)
            await db(TABLE)
              .insert({
                project_slug: projectSlug,
                branch,
                week_number: week,
                year,
                bug_count: result.bugCount,
                lines_changed: result.linesChanged,
                defect_density: result.defectDensity,
                merged_pr_count: result.mergedPrCount,
              })
              .onConflict(['project_slug', 'branch', 'week_number', 'year'])
              .merge();

            return res.json({
              projectSlug,
              branch,
              week,
              year,
              ...result,
              cached: false,
            });
          } catch (e: any) {
            logger.error(`Defect density calculation failed: ${e.message}`);
            return res.status(500).json({ error: e.message });
          }
        });

        // GET /api/defect-density/history?projectSlug=owner/repo&branch=main&weeks=12
        router.get('/history', async (req, res) => {
          const { projectSlug, branch: branchParam, weeks: weeksParam } = req.query;
          if (!projectSlug || typeof projectSlug !== 'string') {
            return res
              .status(400)
              .json({ error: 'projectSlug query param is required' });
          }
          const branch =
            typeof branchParam === 'string' ? branchParam : 'main';
          const weeksBack = Math.min(
            Number(weeksParam) || 12,
            52,
          );

          const rows = await db(TABLE)
            .where({ project_slug: projectSlug, branch })
            .orderBy([
              { column: 'year', order: 'desc' },
              { column: 'week_number', order: 'desc' },
            ])
            .limit(weeksBack);

          return res.json(rows);
        });

        router.get('/health', (_, res) => res.json({ status: 'ok' }));

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
