// PermissionWrapper.js

import React, { ReactNode } from 'react';
import { usePermissionCheck } from './usePermissionCheck';
// Import the custom hook
interface IPermissionWrapper {
  children?: ReactNode;
  permission?: string;
}
export const PermissionWrapper = ({ children, permission }: IPermissionWrapper) => { // NOSONAR
  const hasPermission = usePermissionCheck(permission as string);

  if (hasPermission === null) {
    return <div>Loading...</div>; // Render a loading state while checking permissions
  }

  if (!hasPermission) {
    return <div>Permission Denied......</div>; // Render a "Permission Denied" message
  }

  return children;
};
