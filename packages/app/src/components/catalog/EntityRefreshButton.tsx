import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { Button, CircularProgress, Tooltip } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import CheckIcon from '@material-ui/icons/Check';

export const EntityRefreshButton = () => {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setDone(false);
    try {
      await catalogApi.refreshEntity(stringifyEntityRef(entity));
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip title="Re-fetch this entity from its source (GitHub)">
      <span>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            // eslint-disable-next-line no-nested-ternary
            loading ? (
              <CircularProgress size={14} />
            ) : done ? (
              <CheckIcon fontSize="small" />
            ) : (
              <RefreshIcon fontSize="small" />
            )
          }
          onClick={handleRefresh}
          disabled={loading}
        >
          {done ? 'Refresh queued' : 'Refresh entity'}
        </Button>
      </span>
    </Tooltip>
  );
};
