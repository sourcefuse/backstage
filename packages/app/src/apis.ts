import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
  scmAuthApiRef,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  errorApiRef,
  githubAuthApiRef,
  identityApiRef,
  oauthRequestApiRef,
} from '@backstage/core-plugin-api';
import { GithubAuth } from '@backstage/core-app-api';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import { visitsApiRef, VisitsWebStorageApi } from '@backstage/plugin-home';

async function getGuestGithubToken(identityApi: any): Promise<string> {
  const creds = await identityApi.getCredentials();
  const resp = await fetch('/api/access-validate/github-token', {
    headers: {Authorization: `Bearer ${creds.token}`},
  });
  const {token} = await resp.json();
  return token;
}

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: {configApi: configApiRef},
    factory: ({configApi}) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  createApiFactory({
    api: visitsApiRef,
    deps: {identityApi: identityApiRef, errorApi: errorApiRef},
    factory: ({identityApi, errorApi}) =>
      VisitsWebStorageApi.create({identityApi, errorApi}),
  }),
  createApiFactory({
    api: githubAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
      identityApi: identityApiRef,
    },
    factory: ({discoveryApi, oauthRequestApi, configApi, identityApi}) => {
      const realGithubAuth = GithubAuth.create({
        configApi,
        discoveryApi,
        oauthRequestApi,
        defaultScopes: ['read:user'],
      });

      // Wrap getAccessToken to use the integration token for guest users
      return new Proxy(realGithubAuth, {
        get(target: any, prop: string) {
          if (prop === 'getAccessToken') {
            return async (scope: any, options: any) => {
              const identity = await identityApi.getBackstageIdentity();
              if (identity.userEntityRef === 'user:development/guest') {
                return getGuestGithubToken(identityApi);
              }
              return target.getAccessToken(scope, options);
            };
          }
          return typeof target[prop] === 'function'
            ? target[prop].bind(target)
            : target[prop];
        },
      });
    },
  }),
  createApiFactory({
    api: scmAuthApiRef,
    deps: {
      github: githubAuthApiRef,
      identityApi: identityApiRef,
    },
    factory: ({github, identityApi}) => {
      const defaultScmAuth = ScmAuth.forGithub(github);

      return {
        async getCredentials(options: any) {
          const identity = await identityApi.getBackstageIdentity();
          if (
            identity.userEntityRef === 'user:development/guest' &&
            options?.url &&
            new URL(options.url).hostname.endsWith('github.com')
          ) {
            const token = await getGuestGithubToken(identityApi);
            return {token, headers: {Authorization: `token ${token}`}};
          }
          return defaultScmAuth.getCredentials(options);
        },
        isUrlSupported(url: URL) {
          return defaultScmAuth.isUrlSupported(url);
        },
      };
    },
  }),
];
