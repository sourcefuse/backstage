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
  SessionState,
} from '@backstage/core-plugin-api';
import { GithubAuth } from '@backstage/core-app-api';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import { visitsApiRef, VisitsWebStorageApi } from '@backstage/plugin-home';
import {
  githubPullRequestsApiRef,
  GithubPullRequestsClient,
} from '@roadiehq/backstage-plugin-github-pull-requests';

async function getGuestGithubToken(identityApi: any): Promise<string> {
  // eslint-disable-next-line no-console
  console.log('[GuestGithubToken] Fetching GitHub App token from backend...');
  const creds = await identityApi.getCredentials();
  const resp = await fetch('/api/access-validate/github-token', {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  const data = await resp.json();
  // eslint-disable-next-line no-console
  console.log(
    '[GuestGithubToken] Got token prefix:',
    data.token?.substring(0, 10),
  );
  return data.token;
}

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: githubPullRequestsApiRef,
    deps: {},
    factory: () => new GithubPullRequestsClient(),
  }),
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  createApiFactory({
    api: visitsApiRef,
    deps: { identityApi: identityApiRef, errorApi: errorApiRef },
    factory: ({ identityApi, errorApi }) =>
      VisitsWebStorageApi.create({ identityApi, errorApi }),
  }),
  createApiFactory({
    api: githubAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
      identityApi: identityApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi, identityApi }) => {
      const realGithubAuth = GithubAuth.create({
        configApi,
        discoveryApi,
        oauthRequestApi,
        defaultScopes: ['read:user'],
      });

      // Simple subject to notify sessionState$ subscribers when guest token is ready
      let guestSignedIn = false;
      const sessionListeners = new Set<(state: SessionState) => void>();

      const notifyGuestSignedIn = () => {
        if (guestSignedIn) return; // fire only once
        guestSignedIn = true;
        sessionListeners.forEach(cb => cb(SessionState.SignedIn));
      };

      const guestSessionState$ = () => ({
        subscribe(observer: any) {
          const cb =
            typeof observer === 'function'
              ? observer
              : observer.next?.bind(observer);
          if (cb) {
            if (guestSignedIn) cb(SessionState.SignedIn);
            sessionListeners.add(cb);
          }
          return { unsubscribe: () => cb && sessionListeners.delete(cb) };
        },
      });

      // eslint-disable-next-line no-console
      console.log('[GithubAuthProxy] Factory created — guest proxy is active');

      return new Proxy(realGithubAuth, {
        get(target: any, prop: string) {
          if (prop === 'getAccessToken') {
            return async (scope: any, options: any) => {
              // eslint-disable-next-line no-console
              console.log(
                '[GithubAuthProxy] getAccessToken called, scope:',
                scope,
                'optional:',
                options?.optional,
              );
              const identity = await identityApi.getBackstageIdentity();
              // eslint-disable-next-line no-console
              console.log(
                '[GithubAuthProxy] identity:',
                identity.userEntityRef,
              );
              if (identity.userEntityRef === 'user:development/guest') {
                // Prefer the real GitHub OAuth token when available (supports author:@me queries).
                // Fall back to App installation token for unauthenticated guests.
                try {
                  const realToken = await target.getAccessToken(scope, {
                    ...options,
                    optional: true,
                  });
                  if (realToken) {
                    notifyGuestSignedIn();
                    return realToken;
                  }
                } catch (_) {
                  // no real OAuth session — fall through to App token
                }
                const token = await getGuestGithubToken(identityApi);
                notifyGuestSignedIn();
                return token;
              }
              return target.getAccessToken(scope, options);
            };
          }
          if (prop === 'sessionState$') {
            // Must be synchronous — return a combined observable that merges
            // the real session state with the guest session state.
            // For real users, the real OAuth flow emits SignedIn.
            // For guest users, notifyGuestSignedIn() fires when the token is ready.
            return () => {
              const realObs = target.sessionState$();
              const guestObs = guestSessionState$();
              return {
                subscribe(observer: any) {
                  const cb =
                    typeof observer === 'function'
                      ? observer
                      : observer.next?.bind(observer);
                  const sub1 = realObs.subscribe(cb);
                  const sub2 = guestObs.subscribe(cb);
                  return {
                    unsubscribe() {
                      sub1.unsubscribe();
                      sub2.unsubscribe();
                    },
                  };
                },
              };
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
    factory: ({ github, identityApi }) => {
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
            return { token, headers: { Authorization: `token ${token}` } };
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
