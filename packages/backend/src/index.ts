import { createBackend } from '@backstage/backend-defaults';

import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  githubAuthenticator,
  githubSignInResolvers,
} from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
  createSignInResolverFactory,
} from '@backstage/plugin-auth-node';

import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createMicroserviceAction } from './plugins/sourceloop-ms';
import { createExtensionAction } from './plugins/sourceloop-extension';
import { createScaffoldAction } from './plugins/sourceloop-scaffold';
import { modifyIaCModules } from './plugins/iac-scaffold';
import { deleteDirectory } from './plugins/iac-scaffold';
import { grafanaSettingsPlugin } from './plugins/grafana-settings';

// Custom GitHub auth module.
// Overrides usernameMatchingUserEntityName to try catalog first, then fall back
// to issuing a token directly — so login works even when the catalog has no User entities.
const githubAuthModuleCustom = createBackendModule({
  pluginId: 'auth',
  moduleId: 'github-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
      },
      async init({providers}) {
        providers.registerProvider({
          providerId: 'github',
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            signInResolverFactories: {
              ...githubSignInResolvers,
              // Override: try catalog lookup first, fall back to direct token issuance
              usernameMatchingUserEntityName: createSignInResolverFactory({
                create() {
                  return async (info, ctx) => {
                    const userId = (info.result as any).fullProfile?.username as string | undefined;
                    if (!userId) {
                      throw new Error('GitHub profile does not contain a username');
                    }
                    try {
                      return await ctx.signInWithCatalogUser({entityRef: {name: userId}});
                    } catch {
                      // No catalog User entity found — issue token directly for development
                      return ctx.issueToken({
                        claims: {
                          sub: `user:default/${userId}`,
                          ent: [`user:default/${userId}`],
                        },
                      });
                    }
                  };
                },
              }),
            },
          }),
        });
      },
    });
  },
});

const scaffolderModuleCustomExtensions = createBackendModule({
  pluginId: 'scaffolder', // name of the plugin that the module is targeting
  moduleId: 'arc-microservice',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          createMicroserviceAction(),
          createScaffoldAction(),
          createExtensionAction(),
          modifyIaCModules(),
          deleteDirectory()
        );
        // scaffolder.addActions(modifyIaCModules());
      },
    });
  },
});


const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend/alpha'));
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));
// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(githubAuthModuleCustom); // custom: issues tokens without catalog user lookup
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-proxy-backend/alpha'));
// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend/alpha'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github/alpha'));
backend.add(import('@backstage/plugin-catalog-backend-module-github-org'));
backend.add(import('./extensions/catalogPermissionRules'));

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// search plugin
backend.add(import('@backstage/plugin-search-backend/alpha'));
// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg/alpha'));
// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

backend.add(import('@internal/backstage-plugin-access-validate-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));
backend.add(scaffolderModuleCustomExtensions);

backend.add(import('@backstage-community/plugin-jenkins-backend'));
backend.add(import('@backstage-community/plugin-sonarqube-backend'));
backend.add(import('@backstage/plugin-kubernetes-backend/alpha'));

// announcements + real-time signals
backend.add(import('@backstage-community/plugin-announcements-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

backend.add(
  import('@internal/backstage-plugin-jenkins-with-reporting-backend-backend'),
);

// Grafana per-entity settings (stores dashboard URL + path in PostgreSQL)
backend.add(grafanaSettingsPlugin);

backend.start();
