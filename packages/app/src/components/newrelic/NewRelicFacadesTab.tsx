import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { Table, TableColumn, Progress } from '@backstage/core-components';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { Entity } from '@backstage/catalog-model';

export const NEWRELIC_APP_PREFIX_ANNOTATION = 'newrelic.com/app-prefix';

export const isNewRelicFacadesTabAvailable = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.[NEWRELIC_APP_PREFIX_ANNOTATION]);

// Canonical env buckets: anything not matching goes to "Other"
const DEV_ENVS = ['dev', 'development'];
const QA_ENVS = ['qa', 'uat', 'stage', 'staging', 'test'];
const PROD_ENVS = ['prod', 'production'];
const ALL_KNOWN_ENVS = [...DEV_ENVS, ...QA_ENVS, ...PROD_ENVS];

const bucketEnv = (env: string): 'dev' | 'qa' | 'production' | 'other' => {
  if (DEV_ENVS.includes(env)) return 'dev';
  if (QA_ENVS.includes(env)) return 'qa';
  if (PROD_ENVS.includes(env)) return 'production';
  return 'other';
};

const parseAppName = (
  fullName: string,
  prefix: string,
): { component: string; env: string } => {
  const withoutPrefix = fullName
    .toLowerCase()
    .replace(`${prefix.toLowerCase()}_`, '');
  const parts = withoutPrefix.split('_');
  const lastPart = parts[parts.length - 1];
  if (ALL_KNOWN_ENVS.includes(lastPart)) {
    return {
      component: parts.slice(0, -1).join('-'),
      env: lastPart,
    };
  }
  return { component: withoutPrefix.replace(/_/g, '-'), env: 'unknown' };
};

const useStyles = makeStyles(theme => ({
  good: { color: theme.palette.success?.main ?? '#4caf50', fontWeight: 600 },
  warn: { color: theme.palette.warning?.main ?? '#ff9800', fontWeight: 600 },
  bad: { color: theme.palette.error.main, fontWeight: 600 },
  neutral: { color: theme.palette.text.primary, fontWeight: 600 },
  envChip: { fontWeight: 600, fontSize: '0.7rem', minWidth: 48 },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 2, 1),
  },
  sectionDivider: {
    margin: theme.spacing(3, 0, 1),
  },
  refreshRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(1, 2),
  },
  // Fix: MUI TableSortLabel turns text white when active, making it invisible
  tableSection: {
    '& .MuiTableSortLabel-root': {
      color: 'inherit',
    },
    '& .MuiTableSortLabel-root:hover': {
      color: 'inherit',
    },
    '& .MuiTableSortLabel-root.MuiTableSortLabel-active': {
      color: 'inherit',
    },
    '& .MuiTableSortLabel-root.MuiTableSortLabel-active .MuiTableSortLabel-icon':
      {
        color: 'inherit',
      },
  },
}));

const alertChipColor = (s: string): 'default' | 'primary' | 'secondary' => {
  if (s === 'CRITICAL') return 'secondary';
  if (s === 'WARNING') return 'primary';
  return 'default';
};

type AppRow = {
  id: string;
  appName: string;
  component: string;
  env: string;
  guid: string;
  alertSeverity: string;
  apdexScore: number | null;
  responseTime: number | null;
  errorRate: number | null;
  throughput: number | null;
};

const ENV_GROUPS: {
  key: 'dev' | 'qa' | 'production' | 'other';
  label: string;
  color: string;
}[] = [
  { key: 'production', label: 'Production', color: '#c62828' },
  { key: 'qa', label: 'QA / Staging', color: '#7b1fa2' },
  { key: 'dev', label: 'Dev', color: '#1976d2' },
  { key: 'other', label: 'Other', color: '#555' },
];

export const NewRelicFacadesTab = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prefix =
    entity.metadata.annotations?.[NEWRELIC_APP_PREFIX_ANNOTATION] ?? '';

  const fetchData = useCallback(async () => {
    if (!prefix) return;
    setLoading(true);
    setError(null);
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');

      // Step 1: find all apps with this prefix
      const searchQuery = `{
        actor {
          entitySearch(query: "name LIKE '${prefix}%' AND type = 'APPLICATION'") {
            results {
              entities {
                guid
                name
              }
            }
          }
        }
      }`;

      const searchRes = await fetchApi.fetch(
        `${proxyUrl}/newrelic/api/graphql`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        },
      );
      if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
      const searchJson = await searchRes.json();
      const entities: { guid: string; name: string }[] =
        searchJson.data?.actor?.entitySearch?.results?.entities ?? [];

      if (!entities.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch metrics in chunks of 25 (NerdGraph hard limit)
      const CHUNK_SIZE = 25;
      const guids = entities.map(e => e.guid);
      const chunks: string[][] = [];
      for (let i = 0; i < guids.length; i += CHUNK_SIZE) {
        chunks.push(guids.slice(i, i + CHUNK_SIZE));
      }

      const metricsEntities: any[] = [];
      for (const chunk of chunks) {
        const guidsArg = chunk.map(g => `"${g}"`).join(', ');
        const metricsQuery = `{
          actor {
            entities(guids: [${guidsArg}]) {
              name
              guid
              alertSeverity
              ... on ApmApplicationEntity {
                apmSummary {
                  apdexScore
                  errorRate
                  responseTimeAverage
                  throughput
                }
              }
            }
          }
        }`;

        const metricsRes = await fetchApi.fetch(
          `${proxyUrl}/newrelic/api/graphql`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: metricsQuery }),
          },
        );
        if (!metricsRes.ok) throw new Error(`HTTP ${metricsRes.status}`);
        const metricsJson = await metricsRes.json();
        metricsEntities.push(...(metricsJson.data?.actor?.entities ?? []));
      }

      const result: AppRow[] = metricsEntities
        .map(e => {
          const { component, env } = parseAppName(e.name, prefix);
          return {
            id: e.guid,
            appName: e.name,
            component,
            env,
            guid: e.guid,
            alertSeverity: e.alertSeverity ?? 'NOT_CONFIGURED',
            apdexScore: e.apmSummary?.apdexScore ?? null,
            responseTime: e.apmSummary?.responseTimeAverage ?? null,
            errorRate: e.apmSummary?.errorRate ?? null,
            throughput: e.apmSummary?.throughput ?? null,
          };
        })
        .sort((a, b) => a.component.localeCompare(b.component));

      setRows(result);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [prefix, discoveryApi, fetchApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const apdexClass = (v: number | null) => {
    if (v === null) return classes.neutral;
    if (v >= 0.9) return classes.good;
    if (v >= 0.7) return classes.warn;
    return classes.bad;
  };

  const errorClass = (v: number | null) => {
    if (v === null) return classes.neutral;
    if (v < 0.01) return classes.good;
    if (v < 0.05) return classes.warn;
    return classes.bad;
  };

  const columns: TableColumn<AppRow>[] = [
    {
      title: 'Component',
      field: 'component',
      render: row => (
        <Box display="flex" alignItems="center" style={{ gap: 6 }}>
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            {row.component}
          </Typography>
          <Tooltip title={`Open ${row.appName} in New Relic`}>
            <IconButton
              size="small"
              component="a"
              href={`https://one.newrelic.com/redirect/entity/${row.guid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon style={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
    {
      title: 'Alert',
      field: 'alertSeverity',
      render: row =>
        row.alertSeverity && row.alertSeverity !== 'NOT_CONFIGURED' ? (
          <Chip
            label={row.alertSeverity}
            size="small"
            color={alertChipColor(row.alertSeverity)}
          />
        ) : (
          <Typography variant="body2" color="textSecondary">
            —
          </Typography>
        ),
    },
    {
      title: 'Apdex',
      field: 'apdexScore',
      render: row => (
        <Typography variant="body2" className={apdexClass(row.apdexScore)}>
          {row.apdexScore !== null ? row.apdexScore.toFixed(2) : '—'}
        </Typography>
      ),
    },
    {
      title: 'Response Time',
      field: 'responseTime',
      render: row => (
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          {row.responseTime !== null
            ? `${row.responseTime.toFixed(0)} ms`
            : '—'}
        </Typography>
      ),
    },
    {
      title: 'Error Rate',
      field: 'errorRate',
      render: row => (
        <Typography variant="body2" className={errorClass(row.errorRate)}>
          {row.errorRate !== null
            ? `${(row.errorRate * 100).toFixed(2)}%`
            : '—'}
        </Typography>
      ),
    },
    {
      title: 'Throughput',
      field: 'throughput',
      render: row => (
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          {row.throughput !== null ? `${row.throughput.toFixed(0)} rpm` : '—'}
        </Typography>
      ),
    },
  ];

  if (loading) return <Progress />;

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  const grouped = new Map<string, AppRow[]>();
  for (const group of ENV_GROUPS) {
    grouped.set(group.key, []);
  }
  for (const row of rows) {
    const bucket = bucketEnv(row.env);
    grouped.get(bucket)!.push(row);
  }

  const visibleGroups = ENV_GROUPS.filter(
    g => (grouped.get(g.key)?.length ?? 0) > 0,
  );

  return (
    <Box>
      <Box className={classes.refreshRow}>
        <Tooltip title="Refresh APM data">
          <IconButton size="small" onClick={fetchData} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {visibleGroups.map((group, idx) => {
        const groupRows = grouped.get(group.key) ?? [];
        return (
          <Box key={group.key} className={classes.tableSection}>
            {idx > 0 && <Divider className={classes.sectionDivider} />}
            <Table<AppRow>
              title={
                <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: group.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="h6" style={{ fontWeight: 700 }}>
                    {group.label}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    ({groupRows.length} apps)
                  </Typography>
                </Box>
              }
              columns={columns}
              data={groupRows}
              options={{
                paging: false,
                search: false,
                padding: 'dense',
                toolbar: true,
              }}
            />
          </Box>
        );
      })}

      {rows.length === 0 && (
        <Box p={4} textAlign="center">
          <Typography color="textSecondary">
            No APM data found for prefix "{prefix}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};
