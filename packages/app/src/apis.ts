import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  identityApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { visitsApiRef, VisitsWebStorageApi } from '@backstage/plugin-home';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
  createApiFactory({
    api: visitsApiRef,
    deps: {storageApi: storageApiRef, identityApi: identityApiRef},
    factory: ({storageApi, identityApi}) =>
      VisitsWebStorageApi.create({storageApi, identityApi}),
  }),
];
