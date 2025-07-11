import { createBackend } from '@backstage/backend-defaults';

import { createBackendModule } from '@backstage/backend-plugin-api';

import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createMicroserviceAction } from './plugins/sourceloop-ms';
import { createExtensionAction } from './plugins/sourceloop-extension';
import { createScaffoldAction } from './plugins/sourceloop-scaffold';
import { modifyIaCModules } from './plugins/iac-scaffold';
import { deleteDirectory } from './plugins/iac-scaffold';

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
        //scaffolder.addActions(modifyIaCModules());
      },
    });
  },
});


const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend/alpha'));
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));
// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
backend.add(import('@backstage/plugin-proxy-backend/alpha'));
// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend/alpha'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
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

backend.add(
  import('@internal/backstage-plugin-jenkins-with-reporting-backend-backend'),
);
backend.start();
