import { createBackend } from '@backstage/backend-defaults';

import { createBackendModule } from '@backstage/backend-plugin-api';

import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createMicroserviceAction } from './plugins/sourceloop-ms';
import { createExtensionAction } from './plugins/sourceloop-extension';
import { createScaffoldAction } from './plugins/sourceloop-scaffold';
import { modifyIaCModules } from './plugins/iac-scaffold';
import { deleteDirectory } from './plugins/iac-scaffold';
import { grafanaSettingsPlugin } from './plugins/grafana-settings';
import { prometheusSettingsPlugin } from './plugins/prometheus-settings';
import { portalSettingsPlugin } from './plugins/portal-settings';
import { awsCostSettingsPlugin } from './plugins/aws-cost-settings';
import { jenkinsSettingsPlugin } from './plugins/jenkins-settings';
import { defectDensityPlugin } from './plugins/defect-density';

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

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));
// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
backend.add(import('@backstage/plugin-proxy-backend'));
// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
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
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

backend.add(import('@internal/backstage-plugin-access-validate-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(scaffolderModuleCustomExtensions);

backend.add(import('@backstage-community/plugin-jenkins-backend'));
backend.add(import('@backstage-community/plugin-announcements-backend'));

backend.add(
  import('@internal/backstage-plugin-jenkins-with-reporting-backend-backend'),
);

// Grafana per-entity settings (stores dashboard URL + path in PostgreSQL)
backend.add(grafanaSettingsPlugin);

// Prometheus per-entity settings (stores Prometheus URL + PromQL queries in PostgreSQL)
backend.add(prometheusSettingsPlugin);

// Portal settings (key-value store for configurable UI text)
backend.add(portalSettingsPlugin);

// AWS Cost/ECS/Lambda per-entity settings
backend.add(awsCostSettingsPlugin);

// Jenkins per-entity settings (stores job paths in PostgreSQL, proxies to Jenkins API)
backend.add(jenkinsSettingsPlugin);

// Defect density per-entity (bugs per KLOC, cached weekly in PostgreSQL)
backend.add(defectDensityPlugin);

backend.start();
