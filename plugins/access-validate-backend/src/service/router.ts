import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { isUserAllowed } from './validateRepositoryManager';
import * as jose from 'jose';

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

  router.get('/validateuser', async (_, res) => {
    const token = _.headers?.authorization as string;
    console.log('token***************', token); //NOSONAR
    if (token !== '') {
      const userIdentityDetails = jose.decodeJwt(token);
      console.log('userIdentityDetails***************', userIdentityDetails); //NOSONAR
      const userAllowed = await isUserAllowed(
        userIdentityDetails?.sub?.split('/')[1] as string,
      );
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
