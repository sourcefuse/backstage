import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';

export const githubPrPlugin = createBackendPlugin({
  pluginId: 'github-pr',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ httpRouter, logger }) {
        const githubToken = process.env.GITHUB_TOKEN;
        const githubApiUrl =
          process.env.GITHUB_API_URL || 'https://api.github.com';

        async function githubFetch(url: string, options?: RequestInit) {
          const resp = await fetch(url, {
            ...options,
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              ...(options?.headers || {}),
            },
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`GitHub API ${resp.status}: ${text}`);
          }
          return resp.json();
        }

        const router = Router();
        router.use(express.json());

        // GET /repos/:owner/:repo/branches
        router.get('/repos/:owner/:repo/branches', async (req, res) => {
          if (!githubToken) {
            return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
          }
          const { owner, repo } = req.params;
          const perPage = req.query.per_page || '100';
          const page = req.query.page || '1';
          try {
            const data = await githubFetch(
              `${githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`,
            );
            return res.json(data);
          } catch (e: any) {
            logger.error(`Failed to fetch branches for ${owner}/${repo}: ${e.message}`);
            return res.status(502).json({ error: e.message });
          }
        });

        // GET /repos/:owner/:repo/pulls
        router.get('/repos/:owner/:repo/pulls', async (req, res) => {
          if (!githubToken) {
            return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
          }
          const { owner, repo } = req.params;
          const perPage = req.query.per_page || '10';
          const state = req.query.state || 'open';
          const sort = req.query.sort || 'created';
          const direction = req.query.direction || 'desc';
          try {
            const data = await githubFetch(
              `${githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&sort=${sort}&direction=${direction}&per_page=${perPage}`,
            );
            return res.json(data);
          } catch (e: any) {
            logger.error(`Failed to fetch PRs for ${owner}/${repo}: ${e.message}`);
            return res.status(502).json({ error: e.message });
          }
        });

        // POST /repos/:owner/:repo/pulls
        router.post('/repos/:owner/:repo/pulls', async (req, res) => {
          if (!githubToken) {
            return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
          }
          const { owner, repo } = req.params;
          const { title, body, head, base, draft, reviewers } = req.body;

          if (!title || !head || !base) {
            return res.status(400).json({ error: 'title, head, and base are required' });
          }

          try {
            const pr: any = await githubFetch(
              `${githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
              {
                method: 'POST',
                body: JSON.stringify({ title, body, head, base, draft: !!draft }),
              },
            );

            // Add reviewers if provided (non-blocking on failure)
            if (reviewers && Array.isArray(reviewers) && reviewers.length > 0) {
              try {
                await githubFetch(
                  `${githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pr.number}/requested_reviewers`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ reviewers }),
                  },
                );
              } catch (reviewerErr: any) {
                logger.warn(`Failed to add reviewers to PR #${pr.number}: ${reviewerErr.message}`);
              }
            }

            return res.status(201).json(pr);
          } catch (e: any) {
            logger.error(`Failed to create PR for ${owner}/${repo}: ${e.message}`);
            return res.status(502).json({ error: e.message });
          }
        });

        router.get('/health', (_, res) => res.json({ status: 'ok' }));

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });

        logger.info('GitHub PR plugin initialized');
      },
    });
  },
});
