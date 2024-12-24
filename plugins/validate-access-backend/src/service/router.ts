import { errorHandler } from '@backstage/backend-common';
import express from 'express';
import Router from 'express-promise-router';
import { Logger } from 'winston';
import { isUserAllowed } from './validateRepositoryManager';
import * as jose from 'jose';

export interface RouterOptions {
  logger: Logger;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger } = options;

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  router.get('/validateuser', async (_, res) => {
    const token = _.headers?.authorization as string;
    if (token !== '') {
      const userIdentityDetails = jose.decodeJwt(token);
      const userAllowed = await isUserAllowed(
        userIdentityDetails?.sub?.split('/')[1] as string,
      );
      res.json({ allowed: userAllowed });
    } else {
      res.json({ allowed: false });
    }
  });

  router.use(errorHandler());
  // @ts-ignore
  return router;
}
