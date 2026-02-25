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
import {makeStyles} from '@material-ui/core/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type JenkinsConfig = {
  id: number;
  entity_ref: string;
  config_name: string;
  job_full_name: string;
};

type FormState = {
  configName: string;
  jobFullName: string;
};

type JenkinsBuild = {
  number: number;
  url: string;
  result: string | null;
  timestamp: number;
  duration: number;
  displayName: string;
  fullDisplayName?: string;
};

type JenkinsJob = {
  name: string;
  url: string;
  color: string;
  _class: string;
  lastBuild?: {
    number: number;
    url: string;
    result: string | null;
    timestamp: number;
    duration: number;
    displayName: string;
  };
};

const emptyForm = (): FormState => ({
  configName: '',
  jobFullName: '',
});

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  resultChip: {
    fontWeight: 600,
    fontSize: '0.7rem',
    height: 22,
  },
  success: {backgroundColor: '#4caf50', color: '#fff'},
  failure: {backgroundColor: '#f44336', color: '#fff'},
  unstable: {backgroundColor: '#ff9800', color: '#fff'},
  aborted: {backgroundColor: '#9e9e9e', color: '#fff'},
  building: {backgroundColor: '#2196f3', color: '#fff'},
  unknown: {backgroundColor: '#bdbdbd', color: '#fff'},
  jobRow: {
    cursor: 'pointer',
    '&:hover': {backgroundColor: theme.palette.action.hover},
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resultClass(result: string | null, classes: any): string {
  if (!result) return classes.building;
  switch (result.toUpperCase()) {
    case 'SUCCESS': return classes.success;
    case 'FAILURE': return classes.failure;
    case 'UNSTABLE': return classes.unstable;
    case 'ABORTED': return classes.aborted;
    default: return classes.unknown;
  }
}

function resultLabel(result: string | null): string {
  if (!result) return 'BUILDING';
  return result.toUpperCase();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function colorToStatus(color: string | undefined): string {
  if (!color) return 'UNKNOWN';
  if (color.includes('blue') || color.includes('green')) return 'SUCCESS';
  if (color.includes('red')) return 'FAILURE';
  if (color.includes('yellow')) return 'UNSTABLE';
  if (color.includes('grey') || color.includes('disabled') || color.includes('aborted'))
    return 'ABORTED';
  if (color.includes('anime')) return 'BUILDING';
  return color;
}

// ─── Builds table ────────────────────────────────────────────────────────────

function BuildsTable({builds}: {builds: JenkinsBuild[]}) {
  const classes = useStyles();

  if (builds.length === 0) {
    return (
      <Typography color="textSecondary" style={{padding: 16}}>
        No builds found for this job.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>#</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Started</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {builds.map(build => (
          <TableRow key={build.number}>
            <TableCell>
              <Typography variant="body2" style={{fontWeight: 600}}>
                {build.displayName || `#${build.number}`}
              </Typography>
            </TableCell>
            <TableCell>
              <Chip
                label={resultLabel(build.result)}
                className={`${classes.resultChip} ${resultClass(build.result, classes)}`}
                size="small"
              />
            </TableCell>
            <TableCell>{formatTimestamp(build.timestamp)}</TableCell>
            <TableCell>{formatDuration(build.duration)}</TableCell>
            <TableCell>
              <Tooltip title="Open in Jenkins">
                <IconButton size="small" onClick={() => window.open(build.url, '_blank')}>
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Sub-jobs table (for folder jobs) ────────────────────────────────────────

function SubJobsTable({jobs}: {jobs: JenkinsJob[]}) {
  const classes = useStyles();

  if (jobs.length === 0) {
    return (
      <Typography color="textSecondary" style={{padding: 16}}>
        No sub-jobs found in this folder.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Job</TableCell>
          <TableCell>Last Build</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Started</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {jobs.map(job => (
          <TableRow key={job.name} className={classes.jobRow} onClick={() => window.open(job.url, '_blank')}>
            <TableCell>
              <Typography variant="body2" style={{fontWeight: 600}}>
                {job.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {job._class?.includes('Folder') ? 'Folder' : 'Job'}
              </Typography>
            </TableCell>
            <TableCell>
              {job.lastBuild ? (
                job.lastBuild.displayName || `#${job.lastBuild.number}`
              ) : (
                <Typography variant="caption" color="textSecondary">--</Typography>
              )}
            </TableCell>
            <TableCell>
              {job.lastBuild ? (
                <Chip
                  label={resultLabel(job.lastBuild.result ?? colorToStatus(job.color))}
                  className={`${classes.resultChip} ${resultClass(
                    job.lastBuild.result ?? colorToStatus(job.color),
                    classes,
                  )}`}
                  size="small"
                />
              ) : (
                <Chip label={colorToStatus(job.color)} className={`${classes.resultChip} ${classes.unknown}`} size="small" />
              )}
            </TableCell>
            <TableCell>
              {job.lastBuild ? formatTimestamp(job.lastBuild.timestamp) : '--'}
            </TableCell>
            <TableCell>
              {job.lastBuild ? formatDuration(job.lastBuild.duration) : '--'}
            </TableCell>
            <TableCell>
              <Tooltip title="Open in Jenkins">
                <IconButton size="small" onClick={e => { e.stopPropagation(); window.open(job.url, '_blank'); }}>
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Jenkins data viewer ─────────────────────────────────────────────────────

function JenkinsDataViewer({
  config,
  apiBase,
}: {
  config: JenkinsConfig;
  apiBase: string;
}) {
  const fetchApi = useApi(fetchApiRef);
  const [builds, setBuilds] = useState<JenkinsBuild[]>([]);
  const [subJobs, setSubJobs] = useState<JenkinsJob[]>([]);
  const [viewMode, setViewMode] = useState<'builds' | 'jobs'>('builds');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try fetching builds first
      const buildsResp = await fetchApi.fetch(`${apiBase}/proxy/${config.id}/builds`);
      if (buildsResp.ok) {
        const data = await buildsResp.json();
        if (Array.isArray(data) && data.length > 0) {
          setBuilds(data);
          setViewMode('builds');
          setLoading(false);
          return;
        }
      }
      // If no builds, try fetching sub-jobs (folder)
      const jobsResp = await fetchApi.fetch(`${apiBase}/proxy/${config.id}/jobs`);
      if (jobsResp.ok) {
        const data = await jobsResp.json();
        if (Array.isArray(data) && data.length > 0) {
          setSubJobs(data);
          setViewMode('jobs');
          setLoading(false);
          return;
        }
      }
      // Neither worked - show what we got
      if (!buildsResp.ok) {
        const body = await buildsResp.json().catch(() => ({}));
        setError(body.error ?? `Jenkins returned HTTP ${buildsResp.status}`);
      } else {
        setBuilds([]);
        setViewMode('builds');
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch Jenkins data');
    } finally {
      setLoading(false);
    }
  }, [config.id, apiBase, fetchApi]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Progress />;

  if (error) {
    return (
      <Box p={2}>
        <WarningPanel title="Jenkins Error" message={error} />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1} style={{gap: 8}}>
        <Typography variant="body2" color="textSecondary">
          Job: <strong>{config.job_full_name}</strong>
        </Typography>
        <Box flex={1} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {viewMode === 'builds' ? (
        <BuildsTable builds={builds} />
      ) : (
        <SubJobsTable jobs={subJobs} />
      )}
    </Box>
  );
}

// ─── Config form ─────────────────────────────────────────────────────────────

function ConfigForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: FormState;
  saving: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({...prev, [k]: e.target.value}));

  return (
    <Grid container spacing={2} direction="column">
      <Grid item xs={12} md={8}>
        <TextField
          label="Config Name"
          placeholder="e.g. DEV, QA, Production"
          value={form.configName}
          onChange={set('configName')}
          fullWidth
          variant="outlined"
          helperText="A label for this Jenkins configuration (shown as a tab)"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Jenkins Job Full Name"
          placeholder="e.g. bizbook/DEV or bizbook/bizbook-production"
          value={form.jobFullName}
          onChange={set('jobFullName')}
          fullWidth
          variant="outlined"
          helperText="The full path of the Jenkins job/folder, using / as separator (e.g. folder/subfolder/job-name)"
        />
      </Grid>
      <Grid item>
        <Box display="flex" style={{gap: 8}}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.jobFullName}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
}

// ─── Main tab component ──────────────────────────────────────────────────────

export function JenkinsEntityTab() {
  const {entity} = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const classes = useStyles();

  const [configs, setConfigs] = useState<JenkinsConfig[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiBase, setApiBase] = useState<string>('');

  type UIMode = 'view' | 'add' | {mode: 'edit'; config: JenkinsConfig};
  const [uiMode, setUiMode] = useState<UIMode>('view');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('jenkins-settings');
      setApiBase(base);
      const resp = await fetchApi.fetch(
        `${base}?entityRef=${encodeURIComponent(entityRef)}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: JenkinsConfig[] = await resp.json();
      setConfigs(data);
      setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load Jenkins settings');
    } finally {
      setLoading(false);
    }
  }, [entityRef, discoveryApi, fetchApi]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreate(form: FormState) {
    setSaving(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('jenkins-settings');
      const resp = await fetchApi.fetch(base, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          entityRef,
          configName: form.configName || 'Default',
          jobFullName: form.jobFullName,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const created: JenkinsConfig = await resp.json();
      setConfigs(prev => [...prev, created]);
      setSelectedIdx(configs.length);
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async function handleUpdate(id: number, form: FormState) {
    setSaving(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('jenkins-settings');
      const resp = await fetchApi.fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          configName: form.configName || 'Default',
          jobFullName: form.jobFullName,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const updated: JenkinsConfig = await resp.json();
      setConfigs(prev => prev.map(c => (c.id === id ? updated : c)));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to update config');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    try {
      const base = await discoveryApi.getBaseUrl('jenkins-settings');
      await fetchApi.fetch(`${base}/${id}`, {method: 'DELETE'});
      const next = configs.filter(c => c.id !== id);
      setConfigs(next);
      setSelectedIdx(Math.max(0, selectedIdx - 1));
      setUiMode('view');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete config');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <Progress />;

  const currentConfig = configs[selectedIdx] ?? null;

  // ── Add / Edit form ───────────────────────────────────────────────────────

  if (uiMode === 'add') {
    return (
      <InfoCard
        title="Add Jenkins Job"
        subheader="Configure a Jenkins job or folder for this component"
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
        title={`Edit - ${c.config_name}`}
        subheader="Update the Jenkins job settings"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <ConfigForm
          initial={{
            configName: c.config_name,
            jobFullName: c.job_full_name,
          }}
          saving={saving}
          onSave={form => handleUpdate(c.id, form)}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  // ── No configs yet ────────────────────────────────────────────────────────

  if (configs.length === 0) {
    return (
      <InfoCard
        title="Jenkins"
        subheader="No Jenkins jobs configured for this component yet"
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
            Add Jenkins Job
          </Button>
        </Box>
      </InfoCard>
    );
  }

  // ── Config viewer ─────────────────────────────────────────────────────────

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
            <Tab key={c.id} label={c.config_name} value={i} />
          ))}
        </Tabs>

        <Box className={classes.tabActions}>
          {currentConfig && (
            <>
              <Tooltip title="Edit settings">
                <IconButton
                  size="small"
                  onClick={() => setUiMode({mode: 'edit', config: currentConfig})}
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
              <Divider orientation="vertical" flexItem style={{margin: '4px 4px'}} />
            </>
          )}
          <Tooltip title="Add another Jenkins job">
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

      {/* Jenkins data */}
      {currentConfig && (
        <JenkinsDataViewer
          key={currentConfig.id}
          config={currentConfig}
          apiBase={apiBase}
        />
      )}
    </Box>
  );
}
