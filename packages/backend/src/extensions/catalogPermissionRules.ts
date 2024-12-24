import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogPermissionExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { isHaveRepositoryAccess } from '../premissions/repository.rule';

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'permission-rules',
  register(reg) {
    reg.registerInit({
      deps: { catalog: catalogPermissionExtensionPoint },
      async init({ catalog }) {
        catalog.addPermissionRules(isHaveRepositoryAccess);
      },
    });
  },
});
