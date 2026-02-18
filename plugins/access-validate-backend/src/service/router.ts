import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { isUserAllowed } from './validateRepositoryManager';
import * as jose from 'jose';
import { createAppAuth } from '@octokit/auth-app';

export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  // Cache the installation token to avoid generating a new one on every request
  let cachedInstallationToken: { token: string; expiresAt: number } | null = null;

  async function getGitHubAppInstallationToken(): Promise<string> {
    const now = Date.now();
    // Return cached token if still valid (with 5 min buffer)
    if (cachedInstallationToken && cachedInstallationToken.expiresAt - now > 5 * 60 * 1000) {
      return cachedInstallationToken.token;
    }

    const appId = process.env.INTEGRATION_GITHUB_APP_ID || '';
    const privateKey = process.env.INTEGRATION_GITHUB_PRIVATE_KEY || '';
    const installationId = parseInt(process.env.INTEGRATION_GITHUB_INSTALLATION_ID || '', 10);

    const auth = createAppAuth({ appId, privateKey });

    let token: string;
    let expiresAt: number;

    if (installationId) {
      // Use explicit installation ID from env
      const result = await auth({ type: 'installation', installationId });
      token = result.token;
      expiresAt = new Date(result.expiresAt).getTime();
    } else {
      // Discover installation ID for sourcefuse org
      const appAuth = await auth({ type: 'app' });
      const fetch = (await import('node-fetch')).default;
      const resp = await fetch('https://api.github.com/app/installations', {
        headers: {
          Authorization: `Bearer ${appAuth.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'backstage',
        },
      });
      const installations = (await resp.json()) as Array<{ id: number; account: { login: string } }>;
      const sourcefuseInst = installations.find(i => i.account?.login === 'sourcefuse');
      if (!sourcefuseInst) throw new Error('No sourcefuse installation found for GitHub App');
      const result = await auth({ type: 'installation', installationId: sourcefuseInst.id });
      token = result.token;
      expiresAt = new Date(result.expiresAt).getTime();
    }

    cachedInstallationToken = { token, expiresAt };
    logger.info('Generated new GitHub App installation token');
    return token;
  }

  // Returns a GitHub App installation token for authenticated users (including guest)
  // Used by the frontend to fetch PR/CI data
  router.get('/github-token', async (_, res) => {
    try {
      const token = await getGitHubAppInstallationToken();
      res.json({ token });
    } catch (err: any) {
      logger.warn(`Failed to get GitHub App token, falling back to PAT: ${err.message}`);
      res.json({ token: process.env.GITHUB_TOKEN || '' });
    }
  });

  router.get('/validateuser', async (_, res) => {
    const token = _.headers?.authorization as string;
    console.log('token***************', token); //NOSONAR
    if (token !== '') {
      const userIdentityDetails = jose.decodeJwt(token);
      console.log('userIdentityDetails***************', userIdentityDetails); //NOSONAR
      const username = userIdentityDetails?.sub?.split('/')[1] as string;
      // Guest users bypass GitHub team check
      if (username === 'guest') {
        res.json({ allowed: true });
        return;
      }
      const userAllowed = await isUserAllowed(username);
      res.json({ allowed: userAllowed });
    } else {
      res.json({ allowed: false });
    }
  });
  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());
  // @ts-ignore
  return router;
}
