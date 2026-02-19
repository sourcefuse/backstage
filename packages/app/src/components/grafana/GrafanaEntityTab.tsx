import React, {useCallback, useEffect, useState} from 'react';
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
  Chip,
  Divider,
  Grid,
  IconButton,
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

/** Build the embed URL for a Grafana dashboard.
 *  - Appends ?kiosk to hide Grafana's navigation bar.
 *  - Appends auth_token if a service account token is stored, which prevents
 *    Grafana from redirecting to its login page (and loading the app in the frame).
 */
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

  // 'view' | 'add' | { mode: 'edit', dashboard: Dashboard }
  type UIMode = 'view' | 'add' | {mode: 'edit'; dashboard: Dashboard};
  const [uiMode, setUiMode] = useState<UIMode>('view');

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('grafana-settings');
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
          {currentDashboard && (
            <>
              <Tooltip title="Open in Grafana">
                <IconButton
                  size="small"
                  onClick={() => window.open(embedUrl?.replace(/[?&]kiosk=1/, '').replace(/[?&]auth_token=[^&]+/, '') ?? currentDashboard.grafana_url, '_blank')}
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

      {/* Iframe */}
      {embedUrl ? (
        <iframe
          key={embedUrl}
          src={embedUrl}
          className={classes.iframe}
          title={currentDashboard?.dashboard_name ?? 'Grafana Dashboard'}
        />
      ) : (
        <Typography color="textSecondary">
          Dashboard path is not configured.
        </Typography>
      )}
    </Box>
  );
}
