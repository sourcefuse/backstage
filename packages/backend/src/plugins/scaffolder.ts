import { CatalogClient } from '@backstage/catalog-client';
import { createBuiltinActions, createRouter } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';
import { createExtensionAction } from './sourceloop-extension';
import { createMicroserviceAction } from './sourceloop-ms';
import { createScaffoldAction } from './sourceloop-scaffold';
// eslint-disable-next-line @backstage/no-undeclared-imports
import { ScmIntegrations } from '@backstage/integration';
import { createNewFileAction } from './create-new-file.action';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });
  const integrations = ScmIntegrations.fromConfig(env.config);

  return await createRouter({
    logger: env.logger,
    config: env.config,
    database: env.database,
    reader: env.reader,
    catalogClient,
    identity: env.identity,
    permissions: env.permissions,
    actions: [
      createExtensionAction(),
      createScaffoldAction(),
      createMicroserviceAction(),
      ...createBuiltinActions({
        catalogClient,
        config: env.config,
        reader: env.reader,
        integrations,
      }),
      createNewFileAction(),
    ],
  });
}
