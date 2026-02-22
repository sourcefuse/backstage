import { useCallback, useEffect, useState } from 'react';
import {
  Content,
  Header,
  Page,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { configApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
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
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { makeStyles } from '@material-ui/core/styles';

// ─── Types ────────────────────────────────────────────────────────────────────

type PrometheusAlert = {
  name: string;
  state: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  activeAt?: string;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  summaryBar: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
}));

// ─── Severity helpers ─────────────────────────────────────────────────────────

function severityStyle(severity?: string): React.CSSProperties {
  if (!severity) return {};
  const s = severity.toLowerCase();
  if (s === 'critical') return { backgroundColor: '#d32f2f', color: '#fff' };
  if (s === 'warning') return { backgroundColor: '#f57c00', color: '#fff' };
  if (s === 'info') return { backgroundColor: '#0288d1', color: '#fff' };
  return {};
}

function labelsToString(labels: Record<string, string>): string {
  return Object.entries(labels)
    .filter(([k]) => k !== 'alertname' && k !== 'severity')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}

// ─── Global Prometheus Alerts Page ───────────────────────────────────────────

export function PrometheusGlobalPage() {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [alerts, setAlerts] = useState<PrometheusAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const backendUrl = configApi.getString('backend.baseUrl');
      const resp = await fetchApi.fetch(
        `${backendUrl}/api/proxy/prometheus/api/api/v1/alerts`,
      );
      if (!resp.ok) throw new Error(`Prometheus returned HTTP ${resp.status}`);
      const data = await resp.json();
      const list: PrometheusAlert[] = (data?.data?.alerts ?? []).map(
        (a: any) => ({
          name: a.labels?.alertname ?? 'Unknown',
          state: a.state ?? 'unknown',
          labels: a.labels ?? {},
          annotations: a.annotations ?? {},
          activeAt: a.activeAt,
        }),
      );
      // Sort: firing first, then by severity (critical > warning > info > others)
      const severityOrder: Record<string, number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };
      list.sort((a, b) => {
        if (a.state === 'firing' && b.state !== 'firing') return -1;
        if (a.state !== 'firing' && b.state === 'firing') return 1;
        const sa = severityOrder[a.labels.severity?.toLowerCase() ?? ''] ?? 99;
        const sb = severityOrder[b.labels.severity?.toLowerCase() ?? ''] ?? 99;
        return sa - sb;
      });
      setAlerts(list);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch Prometheus alerts');
    } finally {
      setLoading(false);
    }
  }, [configApi, fetchApi, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // ── Summary counts ────────────────────────────────────────────────────────

  const critical = alerts.filter(
    a => a.labels.severity?.toLowerCase() === 'critical',
  ).length;
  const warning = alerts.filter(
    a => a.labels.severity?.toLowerCase() === 'warning',
  ).length;
  const info = alerts.filter(
    a => a.labels.severity?.toLowerCase() === 'info',
  ).length;
  const firing = alerts.filter(a => a.state === 'firing').length;

  return (
    <Page themeId="tool">
      <Header
        title="Prometheus Alerts"
        subtitle="Active alerts from the global Prometheus instance"
      />
      <Content>
        {loading && <Progress />}

        {!loading && error && (
          <WarningPanel
            title="Could not load Prometheus alerts"
            message={error}
          />
        )}

        {!loading && !error && (
          <>
            {/* Summary bar */}
            <Box className={classes.summaryBar}>
              {critical > 0 && (
                <Chip
                  label={`Critical: ${critical}`}
                  size="small"
                  style={{ backgroundColor: '#d32f2f', color: '#fff' }}
                />
              )}
              {warning > 0 && (
                <Chip
                  label={`Warning: ${warning}`}
                  size="small"
                  style={{ backgroundColor: '#f57c00', color: '#fff' }}
                />
              )}
              {info > 0 && (
                <Chip
                  label={`Info: ${info}`}
                  size="small"
                  style={{ backgroundColor: '#0288d1', color: '#fff' }}
                />
              )}
              <Chip
                label={`Firing: ${firing}`}
                size="small"
                variant={firing > 0 ? 'default' : 'outlined'}
              />
              <Chip
                label={`Total: ${alerts.length}`}
                size="small"
                variant="outlined"
              />
              <Box flex={1} />
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  onClick={() => setRefreshKey(k => k + 1)}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Table */}
            {alerts.length === 0 ? (
              <Box py={6} textAlign="center">
                <Typography variant="h6" color="textSecondary">
                  No active alerts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  All systems are healthy.
                </Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Alert Name</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Summary</TableCell>
                    <TableCell>Labels</TableCell>
                    <TableCell>Since</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell style={{ fontWeight: 600 }}>
                        {a.name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={a.labels.severity ?? '—'}
                          size="small"
                          style={severityStyle(a.labels.severity)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={a.state}
                          size="small"
                          variant={
                            a.state === 'firing' ? 'default' : 'outlined'
                          }
                          style={
                            a.state === 'firing'
                              ? { backgroundColor: '#d32f2f', color: '#fff' }
                              : {}
                          }
                        />
                      </TableCell>
                      <TableCell
                        style={{
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.annotations.summary ??
                          a.annotations.description ??
                          '—'}
                      </TableCell>
                      <TableCell
                        style={{
                          maxWidth: 240,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.75rem',
                          color: 'textSecondary',
                        }}
                      >
                        {labelsToString(a.labels) || '—'}
                      </TableCell>
                      <TableCell style={{ whiteSpace: 'nowrap' }}>
                        {a.activeAt
                          ? new Date(a.activeAt).toLocaleString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Content>
    </Page>
  );
}
