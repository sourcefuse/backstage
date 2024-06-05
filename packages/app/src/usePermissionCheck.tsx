// usePermissionCheck.js

import { useEffect, useState } from 'react';
import {
  useApi,
  identityApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';

export const usePermissionCheck = (permission: string) => {
  const config = useApi(configApiRef);
  const [hasPermission, setHasPermission] = useState(null);
  const identityApi = useApi(identityApiRef);

  useEffect(() => {
    const checkPermission = async () => {
      const authDetail = await identityApi.getCredentials();
      const backendUrl = config.getOptionalString('backend.baseUrl');
      const response = await fetch(
        `${backendUrl}/api/validate-access/validateuser`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: authDetail.token as string,
          },
        },
      );
      if (response.ok) {
        const { allowed } = await response.json();
        setHasPermission(allowed);
      } else {
        setHasPermission(null);
      }
    };

    checkPermission();
  }, [config, identityApi, permission]);

  return hasPermission;
};
