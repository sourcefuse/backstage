import { useEffect, useState, useCallback } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

export function useTabSettings() {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);

  const [disabledTabs, setDisabledTabs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('tab-settings');
      const res = await fetchApi.fetch(
        `${baseUrl}/disabled/${encodeURIComponent(entityRef)}`,
      );
      if (res.ok) {
        const ids: string[] = await res.json();
        setDisabledTabs(new Set(ids));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi, entityRef]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTab = useCallback(
    async (tabId: string) => {
      const next = new Set(disabledTabs);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      // Optimistic update
      setDisabledTabs(next);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('tab-settings');
        await fetchApi.fetch(
          `${baseUrl}/disabled/${encodeURIComponent(entityRef)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disabledTabs: Array.from(next) }),
          },
        );
      } catch {
        // Revert on error
        load();
      }
    },
    [disabledTabs, discoveryApi, fetchApi, entityRef, load],
  );

  const isTabEnabled = useCallback(
    (tabId: string) => !disabledTabs.has(tabId),
    [disabledTabs],
  );

  return { disabledTabs, loading, toggleTab, isTabEnabled };
}
