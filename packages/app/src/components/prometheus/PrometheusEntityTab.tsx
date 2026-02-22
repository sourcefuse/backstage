import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { InfoCard, Progress, WarningPanel } from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import RefreshIcon from '@material-ui/icons/Refresh';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import { makeStyles } from '@material-ui/core/styles';

// ─── Types ────────────────────────────────────────────────────────────────────

type PromqlQuery = {
  name: string;
  expr: string;
};

type PrometheusConfig = {
  id: number;
  entity_ref: string;
  config_name: string;
  prometheus_url: string;
  promql_queries: string; // JSON string
  has_token: boolean;
};

type FormState = {
  configName: string;
  prometheusUrl: string;
  prometheusToken: string;
  promqlQueries: PromqlQuery[];
};

const emptyForm = (): FormState => ({
  configName: '',
  prometheusUrl: '',
  prometheusToken: '',
  promqlQueries: [],
});

const parseQueries = (raw: string): PromqlQuery[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  tabBar: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
  },
  tabActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginLeft: 'auto',
    padding: theme.spacing(0.5, 0),
  },
  hintText: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
  },
  tokenChip: {
    marginLeft: theme.spacing(1),
    height: 20,
    fontSize: '0.65rem',
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  queryRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    marginBottom: theme.spacing(1),
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

// ─── Minimal SVG sparkline ────────────────────────────────────────────────────

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const W = 280;
  const H = 50;
  const PAD = 3;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => [
    PAD + (i / (series.length - 1)) * (W - 2 * PAD),
    PAD + (1 - (v - min) / range) * (H - 2 * PAD),
  ]);
  const d = pts
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: H, display: 'block' }}
    >
      <path d={d} fill="none" stroke="#e64a19" strokeWidth="1.5" />
    </svg>
  );
}

function formatValue(v: number | null): string {
  if (v === null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (v % 1 !== 0) return v.toFixed(3);
  return String(Math.round(v));
}

// ─── Alerts section ───────────────────────────────────────────────────────────

type PrometheusAlert = {
  name: string;
  state: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  activeAt?: string;
};

function AlertsSection({
  proxyBase,
  configId,
}: {
  proxyBase: string;
  configId: number;
}) {
  const fetchApi = useApi(fetchApiRef);
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi
      .fetch(`${proxyBase}/proxy/${configId}/api/v1/alerts`)
      .then(r => {
        if (!r.ok) throw new Error(`Prometheus returned HTTP ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        const list: PrometheusAlert[] = (data?.data?.alerts ?? []).map(
          (a: any) => ({
            name: a.labels?.alertname ?? 'Unknown',
            state: a.state ?? 'unknown',
            labels: a.labels ?? {},
            annotations: a.annotations ?? {},
            activeAt: a.activeAt,
          }),
        );
        setAlerts(list);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message ?? 'Failed to fetch alerts');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, proxyBase, refreshKey]);

  if (loading) return <Progress />;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Active Alerts
        </Typography>
        <Box flex={1} />
        <Tooltip title="Refresh alerts">
          <IconButton size="small" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <WarningPanel title="Could not load alerts" message={error} />}

      {!error && alerts.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No active alerts.
        </Typography>
      )}

      {!error && alerts.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Alert Name</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell>Since</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.map((a, i) => (
              <TableRow key={i}>
                <TableCell>{a.name}</TableCell>
                <TableCell>
                  <Chip
                    label={a.labels.severity ?? '—'}
                    size="small"
                    style={severityStyle(a.labels.severity)}
                  />
                </TableCell>
                <TableCell>{a.state}</TableCell>
                <TableCell
                  style={{
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.annotations.summary ?? a.annotations.description ?? '—'}
                </TableCell>
                <TableCell>
                  {a.activeAt ? new Date(a.activeAt).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

// ─── Metrics section ──────────────────────────────────────────────────────────

type MetricResult = {
  value: number | null;
  series: number[];
  error?: string;
};

function MetricsSection({
  proxyBase,
  configId,
  queries,
}: {
  proxyBase: string;
  configId: number;
  queries: PromqlQuery[];
}) {
  const fetchApi = useApi(fetchApiRef);
  const [results, setResults] = useState<Record<string, MetricResult>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!queries.length) return;
    setResults({});

    const now = Math.floor(Date.now() / 1000);
    const start = now - 3600; // last 1h
    const step = 60;

    for (const q of queries) {
      if (!q.expr.trim()) continue;
      const qs = new URLSearchParams({
        query: q.expr,
        start: String(start),
        end: String(now),
        step: String(step),
      }).toString();
      fetchApi
        .fetch(`${proxyBase}/proxy/${configId}/api/v1/query_range?${qs}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: any) => {
          const result = data?.data?.result?.[0];
          if (!result) {
            setResults(prev => ({
              ...prev,
              [q.name]: { value: null, series: [] },
            }));
            return;
          }
          const series = (result.values ?? []).map((v: [number, string]) =>
            parseFloat(v[1]),
          );
          const value = series.length > 0 ? series[series.length - 1] : null;
          setResults(prev => ({ ...prev, [q.name]: { value, series } }));
        })
        .catch((e: any) => {
          setResults(prev => ({
            ...prev,
            [q.name]: {
              value: null,
              series: [],
              error: e.message ?? 'Query failed',
            },
          }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries, configId, proxyBase, refreshKey]);

  if (!queries.length) {
    return (
      <Typography variant="body2" color="textSecondary">
        No PromQL queries configured. Add queries in the settings form.
      </Typography>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Metrics (last 1 hour)
        </Typography>
        <Box flex={1} />
        <Tooltip title="Refresh metrics">
          <IconButton size="small" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Grid container spacing={2}>
        {queries.map(q => {
          const r = results[q.name];
          return (
            <Grid item xs={12} sm={6} md={4} key={q.name}>
              <Card variant="outlined" style={{ height: '100%' }}>
                <CardContent style={{ padding: '12px 16px 8px' }}>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      display: 'block',
                    }}
                  >
                    {q.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.65rem',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    {q.expr}
                  </Typography>
                  {!r && (
                    <Box
                      height={60}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Progress />
                    </Box>
                  )}
                  {r?.error && (
                    <Box
                      height={60}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        align="center"
                      >
                        No data
                      </Typography>
                    </Box>
                  )}
                  {r && !r.error && (
                    <>
                      {r.series.length > 1 ? (
                        <Box pt={1}>
                          <Sparkline series={r.series} />
                          <Typography
                            variant="body2"
                            align="right"
                            style={{ marginTop: 2, fontWeight: 600 }}
                          >
                            {formatValue(r.value)}
                          </Typography>
                        </Box>
                      ) : (
                        <Box py={1} textAlign="center">
                          <Typography
                            variant="h4"
                            style={{ fontWeight: 600, lineHeight: 1.2 }}
                          >
                            {formatValue(r.value)}
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// ─── Config form ──────────────────────────────────────────────────────────────

function ConfigForm({
  initial,
  saving,
  isEdit,
  hasExistingToken,
  onSave,
  onCancel,
}: {
  initial: FormState;
  saving: boolean;
  isEdit?: boolean;
  hasExistingToken?: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const classes = useStyles();
  const [form, setForm] = useState<FormState>(initial);
  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const addQuery = () =>
    setForm(prev => ({
      ...prev,
      promqlQueries: [...prev.promqlQueries, { name: '', expr: '' }],
    }));

  const removeQuery = (idx: number) =>
    setForm(prev => ({
      ...prev,
      promqlQueries: prev.promqlQueries.filter((_, i) => i !== idx),
    }));

  const setQuery = (idx: number, field: keyof PromqlQuery, value: string) =>
    setForm(prev => ({
      ...prev,
      promqlQueries: prev.promqlQueries.map((q, i) =>
        i === idx ? { ...q, [field]: value } : q,
      ),
    }));

  const tokenLabel =
    isEdit && hasExistingToken
      ? 'Replace Bearer Token (optional)'
      : 'Bearer Token (optional)';

  const tokenPlaceholder =
    isEdit && hasExistingToken
      ? 'Leave blank to keep the existing token'
      : 'Leave blank if Prometheus is unauthenticated';

  return (
    <Grid container spacing={2} direction="column">
      <Grid item xs={12} md={8}>
        <TextField
          label="Config Name"
          placeholder="e.g. Production, Staging"
          value={form.configName}
          onChange={set('configName')}
          fullWidth
          variant="outlined"
          helperText="A short label shown on the tab"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Prometheus Base URL"
          placeholder="http://prometheus:9090"
          value={form.prometheusUrl}
          onChange={set('prometheusUrl')}
          fullWidth
          variant="outlined"
          helperText="Root URL of your Prometheus instance (no trailing slash)"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label={tokenLabel}
          placeholder={tokenPlaceholder}
          value={form.prometheusToken}
          onChange={set('prometheusToken')}
          fullWidth
          variant="outlined"
          type="password"
          helperText={
            <span className={classes.hintText}>
              {isEdit && hasExistingToken && (
                <>
                  A token is already saved. Leave blank to keep it, or enter a
                  new one to replace it.
                  <br />
                </>
              )}
              The token is stored server-side and never exposed to the browser.
            </span>
          }
        />
      </Grid>

      {/* PromQL queries */}
      <Grid item xs={12} md={10}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          PromQL Queries
        </Typography>
        {form.promqlQueries.map((q, i) => (
          <div key={i} className={classes.queryRow}>
            <TextField
              label="Query Name"
              placeholder="e.g. Request Rate"
              value={q.name}
              onChange={e => setQuery(i, 'name', e.target.value)}
              variant="outlined"
              size="small"
              style={{ flex: '0 0 200px' }}
            />
            <TextField
              label="PromQL Expression"
              placeholder="e.g. rate(http_requests_total[5m])"
              value={q.expr}
              onChange={e => setQuery(i, 'expr', e.target.value)}
              variant="outlined"
              size="small"
              style={{ flex: 1, fontFamily: 'monospace' }}
            />
            <Tooltip title="Remove query">
              <IconButton size="small" onClick={() => removeQuery(i)}>
                <RemoveCircleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addQuery}
          variant="outlined"
          style={{ marginTop: 4 }}
        >
          Add Query
        </Button>
      </Grid>

      <Grid item>
        <Box display="flex" style={{ gap: 8 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.prometheusUrl}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
}

// ─── Main tab component ───────────────────────────────────────────────────────

export function PrometheusEntityTab() {
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const classes = useStyles();

  const [configs, setConfigs] = useState<PrometheusConfig[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiBase, setApiBase] = useState<string>('');

  type UIMode = 'view' | 'add' | { mode: 'edit'; config: PrometheusConfig };
  const [uiMode, setUiMode] = useState<UIMode>('view');

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('prometheus-settings');
      setApiBase(base);
      const resp = await fetchApi.fetch(
        `${base}?entityRef=${encodeURIComponent(entityRef)}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: PrometheusConfig[] = await resp.json();
      setConfigs(data);
      setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load Prometheus settings');
    } finally {
      setLoading(false);
    }
  }, [entityRef, discoveryApi, fetchApi]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Create ───────────────────────────────────────────────────────────────

  async function handleCreate(form: FormState) {
    setSaving(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('prometheus-settings');
      const resp = await fetchApi.fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityRef,
          configName: form.configName || 'Default',
          prometheusUrl: form.prometheusUrl,
          prometheusToken: form.prometheusToken,
          promqlQueries: form.promqlQueries,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const created: PrometheusConfig = await resp.json();
      setConfigs(prev => [...prev, created]);
      setSelectedIdx(configs.length);
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────

  async function handleUpdate(id: number, form: FormState) {
    setSaving(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('prometheus-settings');
      const resp = await fetchApi.fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configName: form.configName || 'Default',
          prometheusUrl: form.prometheusUrl,
          prometheusToken: form.prometheusToken,
          promqlQueries: form.promqlQueries,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const updated: PrometheusConfig = await resp.json();
      setConfigs(prev => prev.map(c => (c.id === id ? updated : c)));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to update config');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    try {
      const base = await discoveryApi.getBaseUrl('prometheus-settings');
      await fetchApi.fetch(`${base}/${id}`, { method: 'DELETE' });
      const next = configs.filter(c => c.id !== id);
      setConfigs(next);
      setSelectedIdx(Math.max(0, selectedIdx - 1));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete config');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <Progress />;

  const currentConfig = configs[selectedIdx] ?? null;

  // ── Add / Edit form ──────────────────────────────────────────────────────

  if (uiMode === 'add') {
    return (
      <InfoCard
        title="Add Prometheus Config"
        subheader="Configure a Prometheus instance for this component"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <ConfigForm
          initial={emptyForm()}
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  if (typeof uiMode === 'object' && uiMode.mode === 'edit') {
    const c = uiMode.config;
    return (
      <InfoCard
        title={`Edit — ${c.config_name}`}
        subheader="Update the Prometheus config settings"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <ConfigForm
          initial={{
            configName: c.config_name,
            prometheusUrl: c.prometheus_url,
            prometheusToken: '',
            promqlQueries: parseQueries(c.promql_queries),
          }}
          saving={saving}
          isEdit
          hasExistingToken={c.has_token}
          onSave={form => handleUpdate(c.id, form)}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  // ── No configs yet ───────────────────────────────────────────────────────

  if (configs.length === 0) {
    return (
      <InfoCard
        title="Prometheus"
        subheader="No Prometheus config for this component yet"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <Box py={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setUiMode('add')}
          >
            Add Config
          </Button>
        </Box>
      </InfoCard>
    );
  }

  // ── Config viewer ─────────────────────────────────────────────────────────

  const queries = currentConfig
    ? parseQueries(currentConfig.promql_queries)
    : [];

  return (
    <Box>
      {error && (
        <Box mb={1}>
          <WarningPanel title="Error" message={error} />
        </Box>
      )}

      {/* Tab bar */}
      <Box display="flex" alignItems="center" className={classes.tabBar}>
        <Tabs
          value={selectedIdx}
          onChange={(_, v) => {
            setSelectedIdx(v);
            setUiMode('view');
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {configs.map((c, i) => (
            <Tab
              key={c.id}
              label={
                <Box display="flex" alignItems="center">
                  {c.config_name}
                  {c.has_token && (
                    <Tooltip title="Auth token configured">
                      <Chip
                        label="auth"
                        className={classes.tokenChip}
                        size="small"
                      />
                    </Tooltip>
                  )}
                </Box>
              }
              value={i}
            />
          ))}
        </Tabs>

        {/* Action buttons */}
        <Box className={classes.tabActions}>
          {currentConfig && (
            <>
              <Tooltip title="Open Prometheus UI">
                <IconButton
                  size="small"
                  onClick={() =>
                    window.open(currentConfig.prometheus_url, '_blank')
                  }
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit config">
                <IconButton
                  size="small"
                  onClick={() =>
                    setUiMode({ mode: 'edit', config: currentConfig })
                  }
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove this config">
                <IconButton
                  size="small"
                  onClick={() => handleDelete(currentConfig.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Divider
                orientation="vertical"
                flexItem
                style={{ margin: '4px 4px' }}
              />
            </>
          )}
          <Tooltip title="Add another config">
            <IconButton
              size="small"
              color="primary"
              onClick={() => setUiMode('add')}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Alerts + Metrics */}
      {currentConfig && (
        <Box>
          <AlertsSection proxyBase={apiBase} configId={currentConfig.id} />
          <Box mt={3}>
            <MetricsSection
              proxyBase={apiBase}
              configId={currentConfig.id}
              queries={queries}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
