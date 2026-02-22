// PermissionWrapper.js

import React from 'react';
import { usePermissionCheck } from './usePermissionCheck';

export const PermissionWrapper = ({ children, permission }: any) => {
  // NOSONAR
  const hasPermission = usePermissionCheck(permission as string); // NOSONAR

  if (hasPermission === null) {
    return <div>Loading...</div>; // Render a loading state while checking permissions
  }

  if (!hasPermission) {
    return <div>Permission Denied......</div>; // Render a "Permission Denied" message
  }

  return children;
};
