import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useEntity} from '@backstage/plugin-catalog-react';
import {InfoCard, Progress, WarningPanel} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
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

type GrafanaPanel = {id: number; title: string; type: string};

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

function GrafanaDashboardFetcher({
  dashboard,
  proxyBase,
  fetchApi: fetchApiInst,
  openUrl,
}: {
  dashboard: Dashboard;
  proxyBase: string;
  fetchApi: ReturnType<typeof useApi<typeof fetchApiRef>>;
  openUrl: string;
}) {
  const uid = extractUid(dashboard.dashboard_path);
  const [panels, setPanels] = useState<GrafanaPanel[]>([]);
  const [timeRange, setTimeRange] = useState('now-3h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // null = not yet checked; true = blocked; false = OK
  const [embedBlocked, setEmbedBlocked] = useState<boolean | null>(null);
  const firstChecked = useRef(false);

  const slug =
    dashboard.dashboard_path.match(/^d\/[^/]+\/([^?]+)/)?.[1] ?? uid ?? '';

  // Fetch the dashboard panel list
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
    setEmbedBlocked(null);
    firstChecked.current = false;

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
            allPanels.push(...p.panels);
          } else if (p.type !== 'row') {
            allPanels.push({id: p.id, title: p.title ?? `Panel ${p.id}`, type: p.type});
          }
        }
        setPanels(allPanels);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message ?? 'Failed to fetch dashboard data');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, dashboard.id, proxyBase, refreshKey]);

  /** Called when the first panel iframe fires onLoad — detect X-Frame-Options blocking */
  const handleFirstLoad = useCallback(
    (el: HTMLIFrameElement | null) => {
      if (!el || firstChecked.current) return;
      firstChecked.current = true;
      try {
        // If contentDocument is accessible it means either:
        // a) the browser's own error page loaded (chrome-error://) → blocked
        // b) same-origin redirect happened → blocked
        const docUrl = el.contentDocument?.URL ?? '';
        setEmbedBlocked(docUrl.startsWith('chrome-error://') || docUrl === 'about:blank');
      } catch {
        // SecurityError = real Grafana page loaded cross-origin → OK
        setEmbedBlocked(false);
      }
    },
    [],
  );

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

  // Grafana is refusing to be embedded — show a clear message instead of 24 broken iframes
  if (embedBlocked) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" gutterBottom>
          Grafana embedding is blocked
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          <strong>{new URL(dashboard.grafana_url).hostname}</strong> is blocking
          embedding via <code>X-Frame-Options</code>. To fix this, enable
          embedding in Grafana:
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
        <Typography variant="body2" color="textSecondary" paragraph>
          For <strong>Grafana Cloud</strong>, go to{' '}
          <strong>Administration → Settings → Security</strong> and enable
          "Allow embedding".
        </Typography>
        <Box mt={2} display="flex" justifyContent="center" style={{gap: 8}}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(openUrl, '_blank')}
          >
            Open in Grafana
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setEmbedBlocked(null);
              firstChecked.current = false;
              setRefreshKey(k => k + 1);
            }}
          >
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  const base = dashboard.grafana_url.replace(/\/$/, '');
  const token = dashboard.grafana_token;

  /** Build the Grafana d-solo embed URL for a single panel */
  const panelEmbedUrl = (panelId: number) => {
    let url =
      `${base}/d-solo/${uid}/${slug}` +
      `?orgId=1&panelId=${panelId}&from=${timeRange}&to=now&theme=dark`;
    if (token) url += `&auth_token=${encodeURIComponent(token)}`;
    return url;
  };

  return (
    <Box>
      {/* Toolbar */}
      <Box display="flex" alignItems="center" mb={2} style={{gap: 12}}>
        <FormControl variant="outlined" size="small" style={{minWidth: 180}}>
          <InputLabel>Time range</InputLabel>
          <Select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as string)}
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
          <IconButton size="small" onClick={() => setRefreshKey(k => k + 1)}>
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

      {/* Panel grid — each panel is an embedded iframe via d-solo */}
      {panels.length === 0 ? (
        <Typography color="textSecondary">No panels found in this dashboard.</Typography>
      ) : (
        <Grid container spacing={2}>
          {panels.map((panel, idx) => (
            <Grid item xs={12} md={6} key={`${panel.id}-${refreshKey}`}>
              <Card variant="outlined">
                <CardContent style={{padding: '12px 16px 8px'}}>
                  <Typography variant="subtitle2" gutterBottom>
                    {panel.title}
                  </Typography>
                  <iframe
                    ref={idx === 0 ? handleFirstLoad : undefined}
                    onLoad={idx === 0 ? e => handleFirstLoad(e.currentTarget) : undefined}
                    src={panelEmbedUrl(panel.id)}
                    title={panel.title}
                    style={{
                      width: '100%',
                      height: 250,
                      border: 'none',
                      display: 'block',
                      borderRadius: 4,
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
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
