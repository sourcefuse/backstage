import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';
import { DefaultJenkinsInfoProvider } from '@backstage-community/plugin-jenkins-backend';

import { catalogServiceRef } from '@backstage/plugin-catalog-node/alpha';
import { CatalogClient } from '@backstage/catalog-client';

/**
 * jenkinsWithReportingBackendPlugin backend plugin
 *
 * @public
 */
export const jenkinsWithReportingBackendPlugin = createBackendPlugin({
  pluginId: 'jenkins-with-reporting-backend',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        permissions: coreServices.permissions,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        catalogClient: catalogServiceRef,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
      },
      async init({
        logger,
        permissions,
        httpRouter,
        config,
        catalogClient,
        discovery,
        auth,
        httpAuth,
      }) {
        const jenkinsInfoProvider = DefaultJenkinsInfoProvider.fromConfig({
          auth,
          httpAuth,
          config,
          catalog: catalogClient,
          discovery,
          logger,
        });

        httpRouter.use(
          await createRouter({
            permissions,
            /**
             * Logger for logging purposes
             */
            logger,
            /**
             * Info provider to be able to get all necessary information for the APIs
             */
            jenkinsInfoProvider,
            discovery,
            auth,
            httpAuth,
            config,
            catalogClient: new CatalogClient({ discoveryApi: discovery }),
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/reports/:namespace/:kind/:name/:jobFullName/:buildNumber',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
