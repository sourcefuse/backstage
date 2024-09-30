import {
  Permission,
  createPermission,
} from '@backstage/plugin-permission-common';

// Define custom permission for scaffolding
export const scaffoldPermission: Permission = createPermission({
  name: 'scaffold.entity',
  attributes: {
    action: 'create',
    // resourceType: 'entity',
  },
});
