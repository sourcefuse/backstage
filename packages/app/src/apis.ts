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
  githubAuthApiRef,
  identityApiRef,
  oauthRequestApiRef,
  SessionState,
} from '@backstage/core-plugin-api';
import { GithubAuth } from '@backstage/core-app-api';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import {
  githubPullRequestsApiRef,
  GithubPullRequestsClient,
} from '@roadiehq/backstage-plugin-github-pull-requests';
import { techRadarApiRef } from '@backstage-community/plugin-tech-radar';
import { SourceFuseTechRadarApi } from './techRadarData';

async function getGuestGithubToken(identityApi: any): Promise<string> {
  // eslint-disable-next-line no-console
  console.log('[GuestGithubToken] Fetching GitHub App token from backend...');
  try {
    const creds = await identityApi.getCredentials();
    console.log('[GuestGithubToken] Got credentials');
    const resp = await fetch('/api/access-validate/github-token', {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    console.log('[GuestGithubToken] Response status:', resp.status);
    const data = await resp.json();
    console.log(
      '[GuestGithubToken] Got token prefix:',
      data.token?.substring(0, 10),
    );
    if (!data.token) {
      console.error('[GuestGithubToken] No token in response:', data);
    }
    return data.token;
  } catch (error) {
    console.error('[GuestGithubToken] Error:', error);
    throw error;
  }
}

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: techRadarApiRef,
    deps: {},
    factory: () => new SourceFuseTechRadarApi(),
  }),
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
              try {
                const identity = await identityApi.getBackstageIdentity();
                // eslint-disable-next-line no-console
                console.log(
                  '[GithubAuthProxy] identity:',
                  identity.userEntityRef,
                );
                if (identity.userEntityRef === 'user:development/guest') {
                  console.log('[GithubAuthProxy] Guest user detected');
                  // Prefer the real GitHub OAuth token when available (supports author:@me queries).
                  // Fall back to App installation token for unauthenticated guests.
                  try {
                    console.log('[GithubAuthProxy] Trying real OAuth token...');
                    const realToken = await target.getAccessToken(scope, {
                      ...options,
                      optional: true,
                    });
                    if (realToken) {
                      console.log('[GithubAuthProxy] Got real OAuth token');
                      notifyGuestSignedIn();
                      return realToken;
                    }
                  } catch (error) {
                    // no real OAuth session — fall through to App token
                    console.log('[GithubAuthProxy] Real OAuth failed, trying app token:', error);
                  }
                  console.log('[GithubAuthProxy] Fetching app token...');
                  const token = await getGuestGithubToken(identityApi);
                  notifyGuestSignedIn();
                  return token;
                }
                console.log('[GithubAuthProxy] Authenticated user, using real auth');
                return target.getAccessToken(scope, options);
              } catch (error) {
                console.error('[GithubAuthProxy] getAccessToken error:', error);
                throw error;
              }
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
