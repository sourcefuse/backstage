import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { InfoCard, Progress, EmptyState } from '@backstage/core-components';
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { Entity } from '@backstage/catalog-model';

export const NEWRELIC_APM_APP_NAME_ANNOTATION = 'newrelic.com/apm-app-name';

export const isNewRelicApmAvailable = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.[NEWRELIC_APM_APP_NAME_ANNOTATION]);

const KNOWN_ENVS = ['dev', 'qa', 'uat', 'staging', 'stage', 'production', 'prod'];

const parseEnv = (fullName: string, baseName: string): string => {
  const suffix = fullName
    .toLowerCase()
    .replace(baseName.toLowerCase(), '')
    .replace(/^_/, '');
  if (!suffix) return 'default';
  if (KNOWN_ENVS.includes(suffix)) return suffix === 'production' ? 'prod' : suffix;
  return suffix;
};

const useStyles = makeStyles(theme => ({
  envChip: {
    fontWeight: 600,
    fontSize: '0.7rem',
    textTransform: 'uppercase',
  },
  good: { color: theme.palette.success?.main ?? '#4caf50' },
  warn: { color: theme.palette.warning?.main ?? '#ff9800' },
  bad: { color: theme.palette.error.main },
  headerCell: {
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  tableRow: {
    '&:last-child td': { borderBottom: 0 },
  },
  error: {
    color: theme.palette.error.main,
    padding: theme.spacing(2),
  },
}));

type EnvRow = {
  guid: string;
  name: string;
  env: string;
  alertSeverity: string;
  apdexScore: number | null;
  errorRate: number | null;
  responseTimeAverage: number | null;
  throughput: number | null;
};

const ENV_ORDER = ['dev', 'qa', 'uat', 'staging', 'stage', 'prod', 'production', 'default'];

const sortByEnv = (rows: EnvRow[]) =>
  [...rows].sort(
    (a, b) =>
      (ENV_ORDER.indexOf(a.env) === -1 ? 99 : ENV_ORDER.indexOf(a.env)) -
      (ENV_ORDER.indexOf(b.env) === -1 ? 99 : ENV_ORDER.indexOf(b.env)),
  );

export const NewRelicApmCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [rows, setRows] = useState<EnvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appName =
    entity.metadata.annotations?.[NEWRELIC_APM_APP_NAME_ANNOTATION] ?? '';

  const fetchApmData = useCallback(async () => {
    if (!appName) return;
    setLoading(true);
    setError(null);
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');

      // Step 1: search for all NR entities matching the base app name
      const searchQuery = `{
        actor {
          entitySearch(query: "type = 'APPLICATION' AND name LIKE '${appName}%'") {
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

      if (entities.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Step 2: batch fetch APM metrics — NerdGraph limits to 25 guids per call
      const CHUNK_SIZE = 25;
      const allGuids = entities.map(e => e.guid);
      const chunks: string[][] = [];
      for (let i = 0; i < allGuids.length; i += CHUNK_SIZE) {
        chunks.push(allGuids.slice(i, i + CHUNK_SIZE));
      }

      const metricsEntities: any[] = [];
      for (const chunk of chunks) {
        const guidsArg = chunk.map(g => `"${g}"`).join(', ');
        const metricsQuery = `{
          actor {
            entities(guids: [${guidsArg}]) {
              guid
              name
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

      const parsed: EnvRow[] = metricsEntities.map(e => ({
        guid: e.guid,
        name: e.name,
        env: parseEnv(e.name, appName),
        alertSeverity: e.alertSeverity ?? 'NOT_CONFIGURED',
        apdexScore: e.apmSummary?.apdexScore ?? null,
        errorRate: e.apmSummary?.errorRate ?? null,
        responseTimeAverage: e.apmSummary?.responseTimeAverage ?? null,
        throughput: e.apmSummary?.throughput ?? null,
      }));

      setRows(sortByEnv(parsed));
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [appName, discoveryApi, fetchApi]);

  useEffect(() => {
    fetchApmData();
  }, [fetchApmData]);

  const cardAction = (
    <Box display="flex" alignItems="center">
      <Tooltip title="Refresh APM data">
        <IconButton size="small" onClick={fetchApmData} disabled={loading}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  if (loading) {
    return (
      <InfoCard title="New Relic APM">
        <Progress />
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="New Relic APM" action={cardAction}>
        <Typography className={classes.error}>{error}</Typography>
      </InfoCard>
    );
  }

  if (rows.length === 0) {
    return (
      <InfoCard title="New Relic APM" action={cardAction}>
        <EmptyState title="No APM data found" missing="data" />
      </InfoCard>
    );
  }

  const apdexClass = (v: number | null) => {
    if (v === null) return '';
    if (v >= 0.9) return classes.good;
    if (v >= 0.7) return classes.warn;
    return classes.bad;
  };

  const errClass = (v: number | null) => {
    if (v === null) return '';
    if (v <= 0.01) return classes.good;
    if (v <= 0.05) return classes.warn;
    return classes.bad;
  };

  const alertColor: Record<string, 'default' | 'primary' | 'secondary'> = {
    CRITICAL: 'secondary',
    WARNING: 'primary',
    NOT_ALERTING: 'default',
    NOT_CONFIGURED: 'default',
  };

  return (
    <InfoCard title="New Relic APM" subheader={appName} action={cardAction}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell className={classes.headerCell}>Env</TableCell>
            <TableCell className={classes.headerCell} align="center">
              Apdex
            </TableCell>
            <TableCell className={classes.headerCell} align="center">
              Resp (ms)
            </TableCell>
            <TableCell className={classes.headerCell} align="center">
              Error %
            </TableCell>
            <TableCell className={classes.headerCell} align="center">
              RPM
            </TableCell>
            <TableCell className={classes.headerCell} align="center">
              Alert
            </TableCell>
            <TableCell className={classes.headerCell} align="center">
              Link
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.guid} className={classes.tableRow}>
              <TableCell>
                <Chip
                  label={row.env}
                  size="small"
                  className={classes.envChip}
                />
              </TableCell>
              <TableCell
                align="center"
                className={apdexClass(row.apdexScore)}
              >
                {row.apdexScore !== null ? row.apdexScore.toFixed(2) : '-'}
              </TableCell>
              <TableCell align="center">
                {row.responseTimeAverage !== null
                  ? row.responseTimeAverage.toFixed(0)
                  : '-'}
              </TableCell>
              <TableCell
                align="center"
                className={errClass(row.errorRate)}
              >
                {row.errorRate !== null
                  ? `${(row.errorRate * 100).toFixed(2)}%`
                  : '-'}
              </TableCell>
              <TableCell align="center">
                {row.throughput !== null ? row.throughput.toFixed(0) : '-'}
              </TableCell>
              <TableCell align="center">
                {row.alertSeverity !== 'NOT_CONFIGURED' ? (
                  <Chip
                    label={row.alertSeverity}
                    size="small"
                    color={alertColor[row.alertSeverity] ?? 'default'}
                    className={classes.envChip}
                  />
                ) : (
                  <Typography variant="caption" color="textSecondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Open in New Relic">
                  <IconButton
                    size="small"
                    component="a"
                    href={`https://one.newrelic.com/redirect/entity/${row.guid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InfoCard>
  );
};
