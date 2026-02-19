import {useCallback, useEffect, useState} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
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
import RefreshIcon from '@material-ui/icons/Refresh';
import {useEntity} from '@backstage/plugin-catalog-react';
import {discoveryApiRef, fetchApiRef, useApi} from '@backstage/core-plugin-api';
import {stringifyEntityRef} from '@backstage/catalog-model';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AwsConfig {
  id: number;
  entity_ref: string;
  config_name: string;
  aws_region: string;
  aws_account_id: string;
  has_credentials: boolean;
  has_session_token: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceCost {
  serviceName: string;
  total: number;
  periods: {date: string; amount: number}[];
}

interface CostData {
  total: number;
  services: ServiceCost[];
  currency: string;
}

type Granularity = 'MONTHLY' | 'DAILY';
type Period = '1m' | '3m' | '6m';

const PERIOD_LABELS: Record<Period, string> = {
  '1m': 'Last 1 Month',
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
};

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({data, color = '#0469E3'}: {data: number[]; color?: string}) {
  if (data.length < 2) return null;
  const w = 80;
  const h = 28;
  const max = Math.max(...data, 0.01);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4)}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{display: 'block', marginTop: 4}}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ── Cost Card ─────────────────────────────────────────────────────────────────

function ServiceCostCard({service}: {service: ServiceCost}) {
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;
  const sparkData = service.periods.map(p => p.amount);
  return (
    <Paper
      elevation={1}
      style={{padding: '12px 16px', minWidth: 140, display: 'inline-block'}}
    >
      <Typography variant="caption" color="textSecondary" noWrap>
        {service.serviceName.replace('Amazon ', '').replace('AWS ', '')}
      </Typography>
      <Typography variant="h6" style={{fontWeight: 600, lineHeight: 1.2}}>
        {fmt(service.total)}
      </Typography>
      <Sparkline data={sparkData} />
    </Paper>
  );
}

// ── Config Form Dialog ─────────────────────────────────────────────────────────

interface ConfigFormProps {
  open: boolean;
  existing?: AwsConfig;
  onClose: () => void;
  onSave: (data: {
    configName: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    awsRegion: string;
    awsAccountId: string;
  }) => Promise<void>;
}

function ConfigFormDialog({open, existing, onClose, onSave}: ConfigFormProps) {
  const [configName, setConfigName] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setConfigName(existing?.config_name ?? 'Default');
      setAwsAccessKeyId('');
      setAwsSecretAccessKey('');
      setAwsSessionToken('');
      setAwsRegion(existing?.aws_region ?? 'us-east-1');
      setAwsAccountId(existing?.aws_account_id ?? '');
      setError('');
    }
  }, [open, existing]);

  const handleSave = async () => {
    if (!existing && (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim())) {
      setError('Access Key ID and Secret Access Key are required');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        configName,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsSessionToken,
        awsRegion,
        awsAccountId,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? 'Edit AWS Config' : 'Add AWS Config'}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" style={{gap: 16, marginTop: 4}}>
          <TextField
            label="Config Name"
            value={configName}
            onChange={e => setConfigName(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="AWS Access Key ID"
            value={awsAccessKeyId}
            onChange={e => setAwsAccessKeyId(e.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={existing ? 'Leave blank to keep existing' : ''}
            helperText="Stored securely in the database — never exposed to the browser"
          />
          <TextField
            label="AWS Secret Access Key"
            value={awsSecretAccessKey}
            onChange={e => setAwsSecretAccessKey(e.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={existing ? 'Leave blank to keep existing' : ''}
          />
          <TextField
            label="AWS Session Token (optional)"
            value={awsSessionToken}
            onChange={e => setAwsSessionToken(e.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={
              existing?.has_session_token
                ? 'Leave blank to keep existing, clear to remove'
                : 'For STS temporary credentials only'
            }
            helperText={
              existing?.has_session_token
                ? 'A session token is currently stored. Leave blank to keep it.'
                : 'Leave empty to use permanent IAM credentials (access key + secret only).'
            }
          />
          <TextField
            label="AWS Region"
            value={awsRegion}
            onChange={e => setAwsRegion(e.target.value)}
            size="small"
            fullWidth
            helperText="Used for Lambda / ECS calls. Cost Explorer always uses us-east-1."
          />
          <TextField
            label="AWS Account ID (optional)"
            value={awsAccountId}
            onChange={e => setAwsAccountId(e.target.value)}
            size="small"
            fullWidth
            placeholder="123456789012"
          />
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function AwsCostEntityTab() {
  const {entity} = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [configs, setConfigs] = useState<AwsConfig[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [period, setPeriod] = useState<Period>('3m');
  const [granularity, setGranularity] = useState<Granularity>('MONTHLY');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AwsConfig | undefined>(undefined);

  const getBase = useCallback(
    async () => discoveryApi.getBaseUrl('aws-cost-settings'),
    [discoveryApi],
  );

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const base = await getBase();
      const resp = await fetchApi.fetch(`${base}?entityRef=${encodeURIComponent(entityRef)}`);
      const data = await resp.json();
      setConfigs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [entityRef, getBase, fetchApi]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const loadCost = useCallback(
    async (configId: number) => {
      setCostLoading(true);
      setCostError('');
      setCostData(null);
      try {
        const base = await getBase();
        const end = new Date().toISOString().split('T')[0];
        const start = (() => {
          const d = new Date();
          const periodMonths: Record<string, number> = {'1m': 1, '3m': 3, '6m': 6};
          const months = periodMonths[period] ?? 6;
          d.setMonth(d.getMonth() - months);
          return d.toISOString().split('T')[0];
        })();
        const url = `${base}/cost/${configId}?startDate=${start}&endDate=${end}&granularity=${granularity}`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({error: resp.statusText}));
          setCostError(err.error ?? 'Failed to fetch cost data');
          return;
        }
        const raw = await resp.json();
        // Parse AWS Cost Explorer response format
        const serviceMap = new Map<string, {total: number; periods: {date: string; amount: number}[]}>();
        for (const result of raw.ResultsByTime ?? []) {
          const date = result.TimePeriod?.Start ?? '';
          for (const group of result.Groups ?? []) {
            const svc = group.Keys?.[0] ?? 'Other';
            const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? '0');
            if (!serviceMap.has(svc)) serviceMap.set(svc, {total: 0, periods: []});
            const entry = serviceMap.get(svc)!;
            entry.total += amount;
            entry.periods.push({date, amount});
          }
        }
        const services: ServiceCost[] = Array.from(serviceMap.entries())
          .map(([serviceName, val]) => ({serviceName, ...val}))
          .filter(s => s.total > 0.001)
          .sort((a, b) => b.total - a.total);
        const total = services.reduce((sum, s) => sum + s.total, 0);
        const currency = raw.ResultsByTime?.[0]?.Groups?.[0]?.Metrics?.UnblendedCost?.Unit ?? 'USD';
        setCostData({total, services, currency});
      } catch (e: any) {
        setCostError(e.message ?? 'Unexpected error');
      } finally {
        setCostLoading(false);
      }
    },
    [getBase, fetchApi, period, granularity],
  );

  const activeConfig = configs[activeTab];

  useEffect(() => {
    if (activeConfig) loadCost(activeConfig.id);
  }, [activeConfig, loadCost]);

  const handleSave = async (formData: {
    configName: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    awsRegion: string;
    awsAccountId: string;
  }) => {
    const base = await getBase();
    if (editTarget) {
      await fetchApi.fetch(`${base}/${editTarget.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...formData, entityRef}),
      });
    } else {
      await fetchApi.fetch(base, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...formData, entityRef}),
      });
    }
    await loadConfigs();
  };

  const handleDelete = async (cfg: AwsConfig) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete config "${cfg.config_name}"?`)) return;
    const base = await getBase();
    await fetchApi.fetch(`${base}/${cfg.id}`, {method: 'DELETE'});
    setActiveTab(0);
    await loadConfigs();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={2}>
      {/* Header row */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">AWS Cost Insights</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditTarget(undefined);
            setFormOpen(true);
          }}
        >
          Add Config
        </Button>
      </Box>

      {configs.length === 0 ? (
        <Paper elevation={0} style={{padding: 32, textAlign: 'center', border: '1px dashed #ccc'}}>
          <Typography color="textSecondary" gutterBottom>
            No AWS credentials configured for this entity.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditTarget(undefined);
              setFormOpen(true);
            }}
          >
            Add AWS Config
          </Button>
        </Paper>
      ) : (
        <>
          {/* Config tabs + actions */}
          <Box display="flex" alignItems="center" mb={2}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              style={{flexGrow: 1}}
            >
              {configs.map(cfg => (
                <Tab key={cfg.id} label={cfg.config_name} />
              ))}
            </Tabs>
            {activeConfig && (
              <Box ml={1} display="flex">
                <Tooltip title="Edit config">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditTarget(activeConfig);
                      setFormOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete config">
                  <IconButton size="small" onClick={() => handleDelete(activeConfig)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>

          {activeConfig && (
            <>
              {/* Account info + controls */}
              <Box display="flex" alignItems="center" flexWrap="wrap" style={{gap: 12}} mb={2}>
                {activeConfig.aws_account_id && (
                  <Typography variant="caption" color="textSecondary">
                    Account: {activeConfig.aws_account_id}
                  </Typography>
                )}
                <Typography variant="caption" color="textSecondary">
                  Region: {activeConfig.aws_region}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Auth: {activeConfig.has_session_token ? 'STS (session token)' : 'IAM (access key)'}
                </Typography>
                <Select
                  value={period}
                  onChange={e => setPeriod(e.target.value as Period)}
                  variant="outlined"
                  style={{height: 28, fontSize: 12}}
                >
                  {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                    <MenuItem key={p} value={p} style={{fontSize: 12}}>
                      {PERIOD_LABELS[p]}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  value={granularity}
                  onChange={e => setGranularity(e.target.value as Granularity)}
                  variant="outlined"
                  style={{height: 28, fontSize: 12}}
                >
                  <MenuItem value="MONTHLY" style={{fontSize: 12}}>Monthly</MenuItem>
                  <MenuItem value="DAILY" style={{fontSize: 12}}>Daily</MenuItem>
                </Select>
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={() => loadCost(activeConfig.id)}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Cost content */}
              {costLoading && (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={32} />
                </Box>
              )}
              {!costLoading && costError && (
                <Paper
                  elevation={0}
                  style={{padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb'}}
                >
                  <Typography color="error" variant="body2">
                    {costError}
                  </Typography>
                </Paper>
              )}
              {!costLoading && !costError && costData && (
                <>
                  <Box mb={2}>
                    <Typography variant="body2" color="textSecondary">
                      Total spend ({PERIOD_LABELS[period]})
                    </Typography>
                    <Typography variant="h4" style={{fontWeight: 700}}>
                      ${costData.total.toFixed(2)}{' '}
                      <Typography component="span" variant="caption" color="textSecondary">
                        {costData.currency}
                      </Typography>
                    </Typography>
                  </Box>
                  {costData.services.length === 0 ? (
                    <Typography color="textSecondary" variant="body2">
                      No cost data found for this period.
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {costData.services.map(svc => (
                        <Grid item key={svc.serviceName}>
                          <ServiceCostCard service={svc} />
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <ConfigFormDialog
        open={formOpen}
        existing={editTarget}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </Box>
  );
}
