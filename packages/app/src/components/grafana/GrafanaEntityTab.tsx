import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useEntity} from '@backstage/plugin-catalog-react';
import {InfoCard, Progress, WarningPanel} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
  type FetchApi,
} from '@backstage/core-plugin-api';
import {stringifyEntityRef} from '@backstage/catalog-model';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
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
import {makeStyles} from '@material-ui/core/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type Dashboard = {
  id: number;
  entity_ref: string;
  dashboard_name: string;
  grafana_url: string;
  dashboard_path: string;
  grafana_token: string;
};

type FormState = {
  dashboardName: string;
  grafanaUrl: string;
  dashboardPath: string;
  grafanaToken: string;
};

const emptyForm = (): FormState => ({
  dashboardName: '',
  grafanaUrl: '',
  dashboardPath: '',
  grafanaToken: '',
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  iframe: {
    border: 'none',
    width: '100%',
    height: '800px',
    display: 'block',
    background: theme.palette.background.default,
  },
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
  addBtn: {
    marginLeft: theme.spacing(1),
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
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the embed URL (with kiosk + auth_token). */
function buildEmbedUrl(d: Dashboard): string {
  const base = d.grafana_url.replace(/\/$/, '');
  const path = d.dashboard_path.replace(/^\//, '');
  const sep = path.includes('?') ? '&' : '?';
  let url = `${base}/${path}${sep}kiosk=1`;
  if (d.grafana_token) {
    url += `&auth_token=${encodeURIComponent(d.grafana_token)}`;
  }
  return url;
}

/** Clean URL to open directly in Grafana (strips kiosk + auth_token). */
function buildOpenUrl(d: Dashboard): string {
  const base = d.grafana_url.replace(/\/$/, '');
  const path = d.dashboard_path.replace(/^\//, '');
  return `${base}/${path}`;
}

type IframeStatus = 'loading' | 'loaded' | 'blocked' | 'redirected';

// ─── Iframe viewer with failure detection ─────────────────────────────────────

function GrafanaIframeViewer({
  embedUrl,
  openUrl,
  title,
}: {
  embedUrl: string;
  openUrl: string;
  title: string;
}) {
  const classes = useStyles();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<IframeStatus>('loading');

  useEffect(() => {
    // Reset status whenever the URL changes (user switches dashboard)
    setStatus('loading');

    // X-Frame-Options: SAMEORIGIN / DENY causes the browser to silently block
    // the iframe without firing onLoad. Treat no-load after 10 s as "blocked".
    const timer = window.setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'blocked' : prev));
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [embedUrl]);

  const handleLoad = () => {
    // If the iframe loaded a same-origin page it means Grafana redirected the
    // browser to the Backstage login/app (OAuth flow) instead of showing the
    // dashboard. We detect this by checking contentDocument access:
    //   - Same-origin (Backstage loaded) → no SecurityError → "redirected"
    //   - Cross-origin (Grafana loaded)  → SecurityError thrown  → "loaded"
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      iframeRef.current?.contentDocument?.title; // throws if cross-origin
      setStatus('redirected');
    } catch {
      setStatus('loaded');
    }
  };

  // ── Error states ─────────────────────────────────────────────────────────

  if (status === 'blocked') {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" gutterBottom>
          Grafana refused to connect
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          The Grafana instance is blocking embedding via{' '}
          <code>X-Frame-Options</code> or{' '}
          <code>Content-Security-Policy: frame-ancestors</code>. To fix this,
          add the following to your <code>grafana.ini</code>:
        </Typography>
        <Box
          component="pre"
          p={2}
          mb={2}
          bgcolor="action.hover"
          borderRadius={4}
          textAlign="left"
          style={{display: 'inline-block', minWidth: 280}}
        >
          {`[security]\nallow_embedding = true`}
        </Box>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(openUrl, '_blank')}
          >
            Open in Grafana
          </Button>
        </Box>
      </Box>
    );
  }

  if (status === 'redirected') {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" gutterBottom>
          Grafana redirected to login
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Grafana redirected to an authentication page instead of showing the
          dashboard. Add a <strong>service account token</strong> in the
          dashboard settings so the embed URL authenticates automatically.
        </Typography>
        <Box display="flex" justifyContent="center" style={{gap: 8}}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(openUrl, '_blank')}
          >
            Open in Grafana
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Iframe (loading + loaded) ─────────────────────────────────────────────

  return (
    <Box position="relative">
      {status === 'loading' && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          bgcolor="background.paper"
          zIndex={1}
        >
          <Progress />
          <Typography variant="caption" color="textSecondary" style={{marginTop: 8}}>
            Connecting to Grafana…
          </Typography>
        </Box>
      )}
      <iframe
        key={embedUrl}
        ref={iframeRef}
        src={embedUrl}
        onLoad={handleLoad}
        className={classes.iframe}
        title={title}
      />
    </Box>
  );
}

// ─── Native dashboard fetcher (used when a service token is stored) ───────────

type GrafanaPanel = {
  id: number;
  title: string;
  type: string;
  targets?: any[];
  datasource?: any;
};

/** Format a numeric metric value for display */
function formatValue(v: number | null): string {
  if (v === null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (v % 1 !== 0) return v.toFixed(2);
  return String(Math.round(v));
}

/** Extract the last value and full time-series array from a Grafana data-frames response */
function extractSeriesFromResults(results: any): {value: number | null; series: number[]} {
  const frames: any[] = Object.values(results ?? {}).flatMap(
    (r: any) => r?.frames ?? [],
  );
  if (!frames.length) return {value: null, series: []};

  const frame = frames[0];
  const fields: any[] = frame.schema?.fields ?? [];
  const dataValues: any[][] = frame.data?.values ?? [];

  const valueIdx = fields.findIndex(f => f.type === 'number');
  if (valueIdx === -1) return {value: null, series: []};

  const series = (dataValues[valueIdx] ?? []).filter(
    (x: any) => x !== null && x !== undefined,
  ) as number[];
  const value = series.length > 0 ? series[series.length - 1] : null;
  return {value, series};
}

/** Minimal SVG sparkline — no dependencies */
function Sparkline({series}: {series: number[]}) {
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
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{width: '100%', height: H, display: 'block'}}
    >
      <path d={d} fill="none" stroke="#1976d2" strokeWidth="1.5" />
    </svg>
  );
}

const TIME_RANGES = [
  {label: 'Last 1 hour', value: 'now-1h'},
  {label: 'Last 3 hours', value: 'now-3h'},
  {label: 'Last 6 hours', value: 'now-6h'},
  {label: 'Last 12 hours', value: 'now-12h'},
  {label: 'Last 24 hours', value: 'now-24h'},
  {label: 'Last 7 days', value: 'now-7d'},
];

/** Extract the Grafana dashboard UID from a dashboard_path like "d/abc123/name?orgId=1" */
function extractUid(path: string): string | null {
  return path.match(/^d\/([^/?]+)/)?.[1] ?? null;
}

/**
 * Build a map of variable name → current value from the dashboard's
 * `templating.list` array.  We use `current.value` when it is a plain
 * string, or the first element when it is an array (multi-value variable).
 */
function buildVariableDefaults(templating: any[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const t of templating ?? []) {
    // Prefer current.value, fall back to first option value
    let val = t.current?.value;
    if (!val || val === '$__all') {
      const firstOpt = t.options?.[0]?.value;
      if (firstOpt && firstOpt !== '$__all') val = firstOpt;
    }
    if (typeof val === 'string') {
      if (val !== '$__all') vars[t.name] = val;
      // When val === '$__all' (All selected) or undefined, use empty string
      // so label filters like {cluster="$cluster"} become {cluster=""} which
      // matches time series with no cluster label (common in single-cluster setups).
      else vars[t.name] = '';
    } else if (Array.isArray(val) && val.length > 0) {
      const first = val.find((v: any) => v !== '$__all');
      vars[t.name] = first ? String(first) : '';
    } else {
      // No value at all — use empty string so the variable is at least resolved
      vars[t.name] = '';
    }
  }
  return vars;
}

/**
 * Replace ${varName} and $varName occurrences in a string with resolved values.
 * Leaves unresolved references unchanged so Grafana returns an error rather
 * than silently querying with a literal "$foo".
 */
function resolveVars(str: string, vars: Record<string, string>): string {
  return str.replace(/\$\{(\w+)\}|\$(\w+)/g, (_, a, b) => {
    const name = a ?? b;
    return vars[name] ?? `$${name}`;
  });
}

type PanelResult = {
  value: number | null;
  series: number[];
  error?: string;
};

function GrafanaDashboardFetcher({
  dashboard,
  proxyBase,
  fetchApi: fetchApiInst,
  openUrl,
}: {
  dashboard: Dashboard;
  proxyBase: string;
  fetchApi: FetchApi;
  openUrl: string;
}) {
  const uid = extractUid(dashboard.dashboard_path);
  const [panels, setPanels] = useState<GrafanaPanel[]>([]);
  const [varDefaults, setVarDefaults] = useState<Record<string, string>>({});
  const [panelResults, setPanelResults] = useState<Record<number, PanelResult>>({});
  const [timeRange, setTimeRange] = useState('now-3h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Step 1: Fetch dashboard JSON (panel list + query targets) ─────────────
  useEffect(() => {
    if (!uid) {
      setError(
        `Cannot extract dashboard UID from path "${dashboard.dashboard_path}". ` +
          `Expected format: d/<uid>/<slug>`,
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPanelResults({});

    fetchApiInst
      .fetch(`${proxyBase}/proxy/${dashboard.id}/api/dashboards/uid/${uid}`)
      .then(r => {
        if (!r.ok) throw new Error(`Grafana returned HTTP ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        const allPanels: GrafanaPanel[] = [];
        for (const p of data.dashboard?.panels ?? []) {
          if (p.type === 'row' && Array.isArray(p.panels)) {
            for (const child of p.panels) {
              if (child.type !== 'row') {
                allPanels.push({
                  id: child.id,
                  title: child.title ?? `Panel ${child.id}`,
                  type: child.type,
                  targets: child.targets,
                  datasource: child.datasource,
                });
              }
            }
          } else if (p.type !== 'row') {
            allPanels.push({
              id: p.id,
              title: p.title ?? `Panel ${p.id}`,
              type: p.type,
              targets: p.targets,
              datasource: p.datasource,
            });
          }
        }
        const defaults = buildVariableDefaults(data.dashboard?.templating?.list ?? []);

        // If any variable resolved to "default" (Grafana special keyword), resolve
        // it to the actual default datasource UID by fetching /api/datasources.
        // We set panels ONLY after varDefaults is fully resolved to avoid firing
        // panel queries with unresolved variables.
        const hasDefault = Object.values(defaults).some(v => v === 'default');
        if (hasDefault) {
          fetchApiInst
            .fetch(`${proxyBase}/proxy/${dashboard.id}/api/datasources`)
            .then(r => r.json())
            .then((dsList: any[]) => {
              const dsMap: Record<string, string> = {};
              for (const ds of dsList ?? []) {
                if (ds.uid && ds.isDefault) dsMap.default = ds.uid;
                if (ds.uid && ds.type && ds.isDefault) dsMap[ds.type] = ds.uid;
              }
              const resolved: Record<string, string> = {};
              for (const [k, v] of Object.entries(defaults)) {
                resolved[k] = dsMap[v] ?? v;
              }
              // eslint-disable-next-line no-console
              console.debug('[GrafanaTab] Resolved template variables:', resolved);
              setVarDefaults(resolved);
              setPanels(allPanels);
              setLoading(false);
            })
            .catch(() => {
              // If datasources fetch fails, proceed with what we have
              // eslint-disable-next-line no-console
              console.debug('[GrafanaTab] Template variable defaults (unresolved):', defaults);
              setVarDefaults(defaults);
              setPanels(allPanels);
              setLoading(false);
            });
        } else {
          // eslint-disable-next-line no-console
          console.debug('[GrafanaTab] Template variable defaults:', defaults);
          setVarDefaults(defaults);
          setPanels(allPanels);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        setError(e.message ?? 'Failed to fetch dashboard data');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, dashboard.id, proxyBase, refreshKey]);

  // ── Step 2: Query panel data via /api/ds/query for each panel ────────────
  useEffect(() => {
    if (!uid || panels.length === 0) return;

    for (const panel of panels) {
      const targets: any[] = panel.targets ?? [];
      if (targets.length === 0) continue;

      // Build the query payload — resolve template variables in datasource UIDs
      // and PromQL expressions, then fall back to panel-level datasource if needed
      const queries = targets.map(t => {
        const rawDsUid = t.datasource?.uid ?? panel.datasource?.uid ?? '';
        const resolvedDsUid = resolveVars(String(rawDsUid), varDefaults);

        const resolved = {
          ...t,
          datasource: {
            ...(t.datasource ?? panel.datasource),
            uid: resolvedDsUid,
          },
          maxDataPoints: 100,
          intervalMs: 60000,
        };

        // Resolve variables in any string fields (expr, query, etc.)
        for (const key of ['expr', 'query', 'rawSql', 'target'] as const) {
          if (typeof resolved[key] === 'string') {
            resolved[key] = resolveVars(resolved[key], varDefaults);
          }
        }
        return resolved;
      });

      // eslint-disable-next-line no-console
      console.debug(`[GrafanaTab] Querying panel "${panel.title}" (id=${panel.id}):`, queries);
      fetchApiInst
        .fetch(`${proxyBase}/proxy/${dashboard.id}/api/ds/query`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({queries, from: timeRange, to: 'now'}),
        })
        .then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.message ?? `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then((resp: any) => {
          const {value, series} = extractSeriesFromResults(resp.results);
          setPanelResults(prev => ({
            ...prev,
            [panel.id]: {value, series},
          }));
        })
        .catch((e: any) => {
          setPanelResults(prev => ({
            ...prev,
            [panel.id]: {value: null, series: [], error: e.message ?? 'Query failed'},
          }));
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panels, varDefaults, timeRange, refreshKey]);

  const STAT_TYPES = new Set(['stat', 'gauge', 'singlestat', 'bargauge']);

  if (loading) return <Progress />;

  if (error) {
    return (
      <Box p={3} textAlign="center">
        <WarningPanel title="Could not load dashboard" message={error} />
        <Box mt={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(openUrl, '_blank')}
          >
            Open in Grafana
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box display="flex" alignItems="center" mb={2} style={{gap: 12}}>
        <FormControl variant="outlined" size="small" style={{minWidth: 180}}>
          <InputLabel>Time range</InputLabel>
          <Select
            value={timeRange}
            onChange={e => {
              setTimeRange(e.target.value as string);
              setPanelResults({});
            }}
            label="Time range"
          >
            {TIME_RANGES.map(r => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Refresh panels">
          <IconButton
            size="small"
            onClick={() => {
              setPanelResults({});
              setRefreshKey(k => k + 1);
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box flex={1} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          onClick={() => window.open(openUrl, '_blank')}
        >
          Open in Grafana
        </Button>
      </Box>

      {/* Panel grid */}
      {panels.length === 0 ? (
        <Typography color="textSecondary">No panels found in this dashboard.</Typography>
      ) : (
        <Grid container spacing={2}>
          {panels.map(panel => {
            const result = panelResults[panel.id];
            const isStat = STAT_TYPES.has(panel.type);
            return (
              <Grid item xs={12} sm={6} md={4} key={panel.id}>
                <Card variant="outlined" style={{height: '100%'}}>
                  <CardContent style={{padding: '12px 16px 8px'}}>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      style={{textTransform: 'uppercase', letterSpacing: 1}}
                    >
                      {panel.title}
                    </Typography>

                    {!result && (
                      <Box height={80} display="flex" alignItems="center" justifyContent="center">
                        <Progress />
                      </Box>
                    )}

                    {result?.error && (
                      <Box
                        height={80}
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Typography variant="caption" color="textSecondary" align="center">
                          No data
                        </Typography>
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          align="center"
                          style={{opacity: 0.6, fontSize: 10}}
                        >
                          {result.error}
                        </Typography>
                      </Box>
                    )}

                    {result && !result.error && (
                      <>
                        {isStat || result.series.length <= 1 ? (
                          // Large current value for stat/gauge panels
                          <Box py={1} textAlign="center">
                            <Typography
                              variant="h4"
                              style={{fontWeight: 600, lineHeight: 1.2}}
                            >
                              {formatValue(result.value)}
                            </Typography>
                          </Box>
                        ) : (
                          // Sparkline + current value for time-series panels
                          <Box pt={1}>
                            <Sparkline series={result.series} />
                            <Typography
                              variant="body2"
                              align="right"
                              style={{marginTop: 2, fontWeight: 600}}
                            >
                              {formatValue(result.value)}
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
      )}
    </Box>
  );
}

// ─── Dashboard form ───────────────────────────────────────────────────────────

function DashboardForm({
  initial,
  saving,
  isEdit,
  hasExistingToken,
  onSave,
  onCancel,
}: {
  initial: FormState;
  saving: boolean;
  /** True when editing an existing dashboard (affects token field label/hint). */
  isEdit?: boolean;
  /** True when the existing dashboard already has a token saved. */
  hasExistingToken?: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const classes = useStyles();
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({...prev, [k]: e.target.value}));

  let tokenLabel = 'Grafana Service Account Token (optional)';
  if (isEdit && hasExistingToken) {
    tokenLabel = 'Replace Service Account Token (optional)';
  }

  const tokenPlaceholder = isEdit && hasExistingToken
    ? 'Leave blank to keep the existing token'
    : 'glsa_xxxxxxxxxxxx';

  return (
    <Grid container spacing={2} direction="column">
      <Grid item xs={12} md={8}>
        <TextField
          label="Dashboard Name"
          placeholder="e.g. Overview, API Metrics"
          value={form.dashboardName}
          onChange={set('dashboardName')}
          fullWidth
          variant="outlined"
          helperText="A short label shown on the tab"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Grafana Base URL"
          placeholder="https://grafana.example.com"
          value={form.grafanaUrl}
          onChange={set('grafanaUrl')}
          fullWidth
          variant="outlined"
          helperText="Root URL of your Grafana instance (no trailing slash)"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Dashboard Path"
          placeholder="d/abc123/biz-book-api?orgId=1"
          value={form.dashboardPath}
          onChange={set('dashboardPath')}
          fullWidth
          variant="outlined"
          helperText="Everything after the hostname in your Grafana dashboard URL"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label={tokenLabel}
          placeholder={tokenPlaceholder}
          value={form.grafanaToken}
          onChange={set('grafanaToken')}
          fullWidth
          variant="outlined"
          type="password"
          helperText={
            <span className={classes.hintText}>
              {isEdit && hasExistingToken && (
                <>
                  A token is already saved for this dashboard. Leave this field
                  blank to keep it, or enter a new token to replace it.
                  <br />
                </>
              )}
              {!isEdit && (
                <>
                  If Grafana requires login it redirects to its auth page inside the
                  frame, loading the app again. A service account token fixes this —
                  it is passed as <code>auth_token</code> in the embed URL.
                  <br />
                </>
              )}
              Also make sure <code>allow_embedding = true</code> is set in{' '}
              <code>grafana.ini</code>.
            </span>
          }
        />
      </Grid>
      <Grid item>
        <Box display="flex" style={{gap: 8}}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.grafanaUrl || !form.dashboardPath}
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

export function GrafanaEntityTab() {
  const {entity} = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const classes = useStyles();

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiBase, setApiBase] = useState<string>('');

  // 'view' | 'add' | { mode: 'edit', dashboard: Dashboard }
  type UIMode = 'view' | 'add' | {mode: 'edit'; dashboard: Dashboard};
  const [uiMode, setUiMode] = useState<UIMode>('view');

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('grafana-settings');
      setApiBase(base);
      const resp = await fetchApi.fetch(
        `${base}?entityRef=${encodeURIComponent(entityRef)}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: Dashboard[] = await resp.json();
      setDashboards(data);
      setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load Grafana settings');
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
      const base = await discoveryApi.getBaseUrl('grafana-settings');
      const resp = await fetchApi.fetch(base, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          entityRef,
          dashboardName: form.dashboardName || 'Default',
          grafanaUrl: form.grafanaUrl,
          dashboardPath: form.dashboardPath,
          grafanaToken: form.grafanaToken,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const created: Dashboard = await resp.json();
      setDashboards(prev => [...prev, created]);
      setSelectedIdx(dashboards.length); // select the new tab
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────

  async function handleUpdate(id: number, form: FormState) {
    setSaving(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('grafana-settings');
      const resp = await fetchApi.fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          dashboardName: form.dashboardName || 'Default',
          grafanaUrl: form.grafanaUrl,
          dashboardPath: form.dashboardPath,
          grafanaToken: form.grafanaToken,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const updated: Dashboard = await resp.json();
      setDashboards(prev => prev.map(d => (d.id === id ? updated : d)));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to update dashboard');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    try {
      const base = await discoveryApi.getBaseUrl('grafana-settings');
      await fetchApi.fetch(`${base}/${id}`, {method: 'DELETE'});
      const next = dashboards.filter(d => d.id !== id);
      setDashboards(next);
      setSelectedIdx(Math.max(0, selectedIdx - 1));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete dashboard');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <Progress />;

  const currentDashboard = dashboards[selectedIdx] ?? null;

  // ── Add / Edit form ──────────────────────────────────────────────────────

  if (uiMode === 'add') {
    return (
      <InfoCard
        title="Add Grafana Dashboard"
        subheader="Configure a Grafana dashboard for this component"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <DashboardForm
          initial={emptyForm()}
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  if (typeof uiMode === 'object' && uiMode.mode === 'edit') {
    const d = uiMode.dashboard;
    return (
      <InfoCard
        title={`Edit — ${d.dashboard_name}`}
        subheader="Update the Grafana dashboard settings"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <DashboardForm
          initial={{
            dashboardName: d.dashboard_name,
            grafanaUrl: d.grafana_url,
            dashboardPath: d.dashboard_path,
            grafanaToken: '', // never pre-fill — user must type a new one to replace
          }}
          saving={saving}
          isEdit
          hasExistingToken={Boolean(d.grafana_token)}
          onSave={form => handleUpdate(d.id, form)}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  // ── No dashboards yet ────────────────────────────────────────────────────

  if (dashboards.length === 0) {
    return (
      <InfoCard
        title="Grafana"
        subheader="No dashboards configured for this component yet"
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
            Add Dashboard
          </Button>
        </Box>
      </InfoCard>
    );
  }

  // ── Dashboard viewer ─────────────────────────────────────────────────────

  const embedUrl = currentDashboard ? buildEmbedUrl(currentDashboard) : null;
  const openUrl = currentDashboard ? buildOpenUrl(currentDashboard) : null;

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
          {dashboards.map((d, i) => (
            <Tab
              key={d.id}
              label={
                <Box display="flex" alignItems="center">
                  {d.dashboard_name}
                  {d.grafana_token && (
                    <Tooltip title="Auth token configured">
                      <Chip label="auth" className={classes.tokenChip} size="small" />
                    </Tooltip>
                  )}
                </Box>
              }
              value={i}
            />
          ))}
        </Tabs>

        {/* Action buttons aligned to the right */}
        <Box className={classes.tabActions}>
          {currentDashboard && openUrl && (
            <>
              <Tooltip title="Open in Grafana">
                <IconButton
                  size="small"
                  onClick={() => window.open(openUrl, '_blank')}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit dashboard settings">
                <IconButton
                  size="small"
                  onClick={() =>
                    setUiMode({mode: 'edit', dashboard: currentDashboard})
                  }
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove this dashboard">
                <IconButton
                  size="small"
                  onClick={() => handleDelete(currentDashboard.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem style={{margin: '4px 4px'}} />
            </>
          )}
          <Tooltip title="Add another dashboard">
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

      {/* Native API view when token is configured; iframe fallback otherwise */}
      {!currentDashboard?.dashboard_path && (
        <Typography color="textSecondary">
          Dashboard path is not configured.
        </Typography>
      )}
      {currentDashboard?.dashboard_path && currentDashboard.grafana_token && (
        <GrafanaDashboardFetcher
          key={`${currentDashboard.id}-${currentDashboard.dashboard_path}`}
          dashboard={currentDashboard}
          proxyBase={apiBase}
          fetchApi={fetchApi}
          openUrl={openUrl ?? currentDashboard.grafana_url}
        />
      )}
      {currentDashboard?.dashboard_path && !currentDashboard.grafana_token && embedUrl && openUrl && (
        <GrafanaIframeViewer
          key={embedUrl}
          embedUrl={embedUrl}
          openUrl={openUrl}
          title={currentDashboard.dashboard_name}
        />
      )}
    </Box>
  );
}
