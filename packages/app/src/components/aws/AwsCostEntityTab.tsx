import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AwsConfig {
  id: number;
  entity_ref: string;
  config_name: string;
  aws_region: string;
  aws_account_id: string;
  ecs_cluster_name: string;
  ecs_service_name: string;
  lambda_function_name: string;
  has_credentials: boolean;
  has_session_token: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceCost {
  serviceName: string;
  total: number;
  periods: { date: string; amount: number }[];
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

// ── ECS Types ─────────────────────────────────────────────────────────────────

interface EcsContainer {
  name: string;
  lastStatus: string;
  healthStatus?: string;
  exitCode?: number;
}

interface EcsTaskDetail {
  taskArn: string;
  lastStatus: string;
  healthStatus?: string;
  startedAt?: string;
  cpu?: string;
  memory?: string;
  containers: EcsContainer[];
}

interface EcsServiceTasksGroup {
  serviceName: string;
  tasks: EcsTaskDetail[];
}

interface EcsDeployment {
  status: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface EcsEvent {
  createdAt?: string;
  message: string;
}

interface EcsService {
  serviceName: string;
  status: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  launchType?: string;
  taskDefinition?: string;
  deployments: EcsDeployment[];
  events: EcsEvent[];
}

interface EcsCluster {
  clusterName: string;
  status: string;
  activeServicesCount: number;
  runningTasksCount: number;
  pendingTasksCount: number;
  registeredContainerInstancesCount: number;
  capacityProviders?: string[];
}

interface EcsData {
  cluster: EcsCluster | null;
  services: EcsService[];
  tasks: EcsServiceTasksGroup[];
}

// ── Lambda Types ──────────────────────────────────────────────────────────────

interface MetricDatapoint {
  Timestamp?: Date;
  Sum?: number;
  Average?: number;
  Maximum?: number;
  Minimum?: number;
  Unit?: string;
}

// Lambda Summary Types
interface TopFunctionMetric {
  functionName: string;
  invocations: number;
  errors: number;
  concurrentExecutions: number;
  invocationsDatapoints: MetricDatapoint[];
  errorsDatapoints: MetricDatapoint[];
  concurrentDatapoints: MetricDatapoint[];
}

interface LambdaSummaryData {
  summary: {
    totalFunctions: number;
    totalCodeSize: number;
    accountConcurrency: number;
    unreservedConcurrency: number;
  };
  topFunctions: {
    byErrors: TopFunctionMetric[];
    byInvocations: TopFunctionMetric[];
    byConcurrent: TopFunctionMetric[];
  };
}

// ── EC2 Types ────────────────────────────────────────────────────────────────

interface Ec2SecurityGroup {
  groupId: string;
  groupName: string;
}

interface Ec2Instance {
  instanceId: string;
  instanceType: string;
  state: string;
  stateCode: number;
  name: string;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
  vpcId: string | null;
  subnetId: string | null;
  platform: string;
  architecture: string | null;
  monitoring: string | null;
  availabilityZone: string | null;
  keyName: string | null;
  securityGroups: Ec2SecurityGroup[];
  tags: Record<string, string>;
}

interface Ec2Data {
  totalInstances: number;
  runningCount: number;
  stoppedCount: number;
  instances: Ec2Instance[];
}

// ── Status Chip ───────────────────────────────────────────────────────────────

function statusColor(status?: string): 'default' | 'primary' {
  if (!status) return 'default';
  const s = status.toLowerCase();
  if (['active', 'running', 'healthy', 'primary'].includes(s)) return 'primary';
  return 'default';
}

function ec2StateStyle(state: string): { color: string; bg: string } {
  switch (state) {
    case 'running':
      return { color: '#2e7d32', bg: '#e8f5e9' };
    case 'stopped':
      return { color: '#c62828', bg: '#ffebee' };
    case 'pending':
    case 'stopping':
    case 'shutting-down':
      return { color: '#f57c00', bg: '#fff3e0' };
    case 'terminated':
      return { color: '#616161', bg: '#f5f5f5' };
    default:
      return { color: '#616161', bg: '#f5f5f5' };
  }
}

function StatusChip({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <Chip
      label={label}
      color={statusColor(label)}
      size="small"
      style={{ fontSize: 10, height: 20 }}
    />
  );
}

// ── Sparkline Color Helper ────────────────────────────────────────────────────

function getSparklineColor(index: number): string {
  if (index === 0) return '#d32f2f';
  if (index === 1) return '#f57c00';
  return '#1976d2';
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = '#0469E3',
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const w = 80;
  const h = 28;
  const max = Math.max(...data, 0.01);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4)}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 4 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ── Cost Card ─────────────────────────────────────────────────────────────────

function ServiceCostCard({ service }: { service: ServiceCost }) {
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;
  const sparkData = service.periods.map(p => p.amount);
  return (
    <Paper
      elevation={1}
      style={{ padding: '12px 16px', minWidth: 140, display: 'inline-block' }}
    >
      <Typography variant="caption" color="textSecondary" noWrap>
        {service.serviceName.replace('Amazon ', '').replace('AWS ', '')}
      </Typography>
      <Typography variant="h6" style={{ fontWeight: 600, lineHeight: 1.2 }}>
        {fmt(service.total)}
      </Typography>
      <Sparkline data={sparkData} />
    </Paper>
  );
}

// ── ECS Cluster Summary ────────────────────────────────────────────────────────

function EcsClusterCard({ cluster }: { cluster: EcsCluster }) {
  const stat = (label: string, value: number | string) => (
    <Box textAlign="center" px={2}>
      <Typography variant="h5" style={{ fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
    </Box>
  );
  return (
    <Paper elevation={1} style={{ padding: '16px 24px', marginBottom: 16 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {cluster.clusterName}
          </Typography>
          <StatusChip label={cluster.status} />
        </Box>
        {cluster.capacityProviders && cluster.capacityProviders.length > 0 && (
          <Typography variant="caption" color="textSecondary">
            {cluster.capacityProviders.join(', ')}
          </Typography>
        )}
      </Box>
      <Divider style={{ marginBottom: 12 }} />
      <Box display="flex" flexWrap="wrap">
        {stat('Active Services', cluster.activeServicesCount)}
        {stat('Running Tasks', cluster.runningTasksCount)}
        {stat('Pending Tasks', cluster.pendingTasksCount)}
        {cluster.registeredContainerInstancesCount > 0 &&
          stat('EC2 Instances', cluster.registeredContainerInstancesCount)}
      </Box>
    </Paper>
  );
}

// ── ECS Service Card ──────────────────────────────────────────────────────────

function EcsServiceCard({
  service,
  taskGroup,
}: {
  service: EcsService;
  taskGroup?: EcsServiceTasksGroup;
}) {
  const [showEvents, setShowEvents] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  const activeDeployment = service.deployments.find(
    d => d.status === 'PRIMARY',
  );

  return (
    <Paper elevation={1} style={{ padding: 16, marginBottom: 12 }}>
      {/* Service header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
            {service.serviceName}
          </Typography>
          <StatusChip label={service.status} />
          {service.launchType && (
            <Chip
              label={service.launchType}
              size="small"
              style={{ fontSize: 10, height: 20 }}
            />
          )}
        </Box>
        {service.taskDefinition && (
          <Typography variant="caption" color="textSecondary">
            {service.taskDefinition}
          </Typography>
        )}
      </Box>

      {/* Counts row */}
      <Box display="flex" style={{ gap: 24 }} mb={1}>
        <Box>
          <Typography variant="caption" color="textSecondary">
            Desired
          </Typography>
          <Typography variant="body1" style={{ fontWeight: 600 }}>
            {service.desiredCount}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="textSecondary">
            Running
          </Typography>
          <Typography
            variant="body1"
            style={{
              fontWeight: 600,
              color:
                service.runningCount === service.desiredCount
                  ? '#2e7d32'
                  : '#f57c00',
            }}
          >
            {service.runningCount}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="textSecondary">
            Pending
          </Typography>
          <Typography
            variant="body1"
            style={{
              fontWeight: 600,
              color: service.pendingCount > 0 ? '#f57c00' : undefined,
            }}
          >
            {service.pendingCount}
          </Typography>
        </Box>
        {activeDeployment && (
          <Box>
            <Typography variant="caption" color="textSecondary">
              Deployment
            </Typography>
            <Box display="flex" alignItems="center" style={{ gap: 4 }}>
              <StatusChip label={activeDeployment.status} />
              <Typography variant="caption">
                {activeDeployment.runningCount}/{activeDeployment.desiredCount}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Events & Tasks toggles */}
      <Box display="flex" style={{ gap: 8 }}>
        {service.events.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowEvents(v => !v)}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            {showEvents ? 'Hide Events' : `Events (${service.events.length})`}
          </Button>
        )}
        {taskGroup && taskGroup.tasks.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowTasks(v => !v)}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            {showTasks ? 'Hide Tasks' : `Tasks (${taskGroup.tasks.length})`}
          </Button>
        )}
      </Box>

      {/* Events list */}
      {showEvents && service.events.length > 0 && (
        <Box
          mt={1}
          style={{
            background: '#f9f9f9',
            borderRadius: 4,
            padding: '8px 12px',
          }}
        >
          {service.events.map((ev, idx) => (
            <Box key={idx} mb={0.5}>
              <Typography variant="caption" color="textSecondary">
                {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                {' — '}
              </Typography>
              <Typography variant="caption">{ev.message}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Tasks list */}
      {showTasks && taskGroup && taskGroup.tasks.length > 0 && (
        <Box mt={1}>
          {taskGroup.tasks.map(task => (
            <Box
              key={task.taskArn}
              mb={1}
              style={{
                background: '#f9f9f9',
                borderRadius: 4,
                padding: '8px 12px',
              }}
            >
              <Box
                display="flex"
                alignItems="center"
                style={{ gap: 8 }}
                mb={0.5}
              >
                <StatusChip label={task.lastStatus} />
                {task.healthStatus && task.healthStatus !== 'UNKNOWN' && (
                  <StatusChip label={task.healthStatus} />
                )}
                {task.cpu && (
                  <Typography variant="caption" color="textSecondary">
                    CPU: {task.cpu}
                  </Typography>
                )}
                {task.memory && (
                  <Typography variant="caption" color="textSecondary">
                    Mem: {task.memory}
                  </Typography>
                )}
                {task.startedAt && (
                  <Typography variant="caption" color="textSecondary">
                    Started: {new Date(task.startedAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
              {task.containers.map(c => (
                <Box
                  key={c.name}
                  display="flex"
                  alignItems="center"
                  style={{ gap: 6 }}
                  ml={1}
                >
                  <Typography variant="caption" style={{ fontWeight: 600 }}>
                    {c.name}
                  </Typography>
                  <StatusChip label={c.lastStatus} />
                  {c.healthStatus && c.healthStatus !== 'UNKNOWN' && (
                    <StatusChip label={c.healthStatus} />
                  )}
                  {c.exitCode !== undefined && c.exitCode !== null && (
                    <Typography
                      variant="caption"
                      style={{
                        color: c.exitCode === 0 ? '#2e7d32' : '#c62828',
                      }}
                    >
                      exit: {c.exitCode}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}
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
    ecsClusterName: string;
    ecsServiceName: string;
  }) => Promise<void>;
}

function ConfigFormDialog({
  open,
  existing,
  onClose,
  onSave,
}: ConfigFormProps) {
  const [configName, setConfigName] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [ecsClusterName, setEcsClusterName] = useState('');
  const [ecsServiceName, setEcsServiceName] = useState('');
  const [changeCredentials, setChangeCredentials] = useState(false);
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
      setEcsClusterName(existing?.ecs_cluster_name ?? '');
      setEcsServiceName(existing?.ecs_service_name ?? '');
      setChangeCredentials(!existing); // show fields immediately for new configs
      setError('');
    }
  }, [open, existing]);

  const handleSave = async () => {
    if (!existing && (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim())) {
      setError('Access Key ID and Secret Access Key are required');
      return;
    }
    if (
      changeCredentials &&
      existing &&
      (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim())
    ) {
      setError(
        'Enter both Access Key ID and Secret Access Key to update credentials',
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        configName,
        // Send empty strings when not changing credentials on edit — backend ignores them
        awsAccessKeyId: changeCredentials ? awsAccessKeyId : '',
        awsSecretAccessKey: changeCredentials ? awsSecretAccessKey : '',
        awsSessionToken: changeCredentials ? awsSessionToken : '',
        awsRegion,
        awsAccountId,
        ecsClusterName,
        ecsServiceName,
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
      <DialogTitle>
        {existing ? 'Edit AWS Config' : 'Add AWS Config'}
      </DialogTitle>
      <DialogContent>
        <Box
          display="flex"
          flexDirection="column"
          style={{ gap: 16, marginTop: 4 }}
        >
          <TextField
            label="Config Name"
            value={configName}
            onChange={e => setConfigName(e.target.value)}
            size="small"
            fullWidth
          />

          {/* Credentials section */}
          {existing && !changeCredentials ? (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              style={{
                padding: '10px 14px',
                background: '#f0f7f0',
                border: '1px solid #c3e6c3',
                borderRadius: 4,
              }}
            >
              <Box>
                <Typography
                  variant="body2"
                  style={{ color: '#2e7d32', fontWeight: 600 }}
                >
                  ✓ AWS credentials are configured
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {existing.has_session_token
                    ? 'Auth: STS (session token)'
                    : 'Auth: IAM (access key + secret)'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setChangeCredentials(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                Change
              </Button>
            </Box>
          ) : (
            <>
              {existing && (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="caption" color="textSecondary">
                    Enter new credentials below (replaces the stored ones)
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setChangeCredentials(false)}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
              <TextField
                label="AWS Access Key ID"
                value={awsAccessKeyId}
                onChange={e => setAwsAccessKeyId(e.target.value)}
                type="password"
                size="small"
                fullWidth
                helperText="Stored securely in the database — never exposed to the browser"
              />
              <TextField
                label="AWS Secret Access Key"
                value={awsSecretAccessKey}
                onChange={e => setAwsSecretAccessKey(e.target.value)}
                type="password"
                size="small"
                fullWidth
              />
              <TextField
                label="AWS Session Token (optional)"
                value={awsSessionToken}
                onChange={e => setAwsSessionToken(e.target.value)}
                type="password"
                size="small"
                fullWidth
                placeholder="For STS temporary credentials only"
                helperText="Leave empty to use permanent IAM credentials (access key + secret only)."
              />
            </>
          )}
          <TextField
            label="AWS Region"
            value={awsRegion}
            onChange={e => setAwsRegion(e.target.value)}
            size="small"
            fullWidth
            helperText="Used for ECS calls. Cost Explorer always uses us-east-1."
          />
          <TextField
            label="AWS Account ID (optional)"
            value={awsAccountId}
            onChange={e => setAwsAccountId(e.target.value)}
            size="small"
            fullWidth
            placeholder="123456789012"
          />
          <Divider />
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ marginBottom: -8 }}
          >
            ECS Configuration (optional)
          </Typography>
          <TextField
            label="ECS Cluster Name"
            value={ecsClusterName}
            onChange={e => setEcsClusterName(e.target.value)}
            size="small"
            fullWidth
            placeholder="my-cluster"
            helperText="The ECS cluster to monitor. Leave blank to skip ECS dashboard."
          />
          <TextField
            label="ECS Service Name (optional)"
            value={ecsServiceName}
            onChange={e => setEcsServiceName(e.target.value)}
            size="small"
            fullWidth
            placeholder="my-service"
            helperText="Specific service to focus on. Leave blank to show all services in the cluster."
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
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving}
        >
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function AwsCostEntityTab() {
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [configs, setConfigs] = useState<AwsConfig[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  // Cost state
  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [period, setPeriod] = useState<Period>('3m');
  const [granularity, setGranularity] = useState<Granularity>('MONTHLY');

  // ECS state
  const [ecsData, setEcsData] = useState<EcsData | null>(null);
  const [ecsLoading, setEcsLoading] = useState(false);
  const [ecsError, setEcsError] = useState('');

  // Lambda Summary state (aggregated view)
  const [lambdaSummary, setLambdaSummary] = useState<LambdaSummaryData | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // EC2 state
  const [ec2Data, setEc2Data] = useState<Ec2Data | null>(null);
  const [ec2Loading, setEc2Loading] = useState(false);
  const [ec2Error, setEc2Error] = useState('');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AwsConfig | undefined>(
    undefined,
  );

  // Section tab (Cost | ECS) within a config
  const [sectionTab, setSectionTab] = useState(0);

  const getBase = useCallback(
    async () => discoveryApi.getBaseUrl('aws-cost-settings'),
    [discoveryApi],
  );

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const base = await getBase();
      const resp = await fetchApi.fetch(
        `${base}?entityRef=${encodeURIComponent(entityRef)}`,
      );
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
          const periodMonths: Record<string, number> = {
            '1m': 1,
            '3m': 3,
            '6m': 6,
          };
          const months = periodMonths[period] ?? 6;
          d.setMonth(d.getMonth() - months);
          return d.toISOString().split('T')[0];
        })();
        const url = `${base}/cost/${configId}?startDate=${start}&endDate=${end}&granularity=${granularity}`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp
            .json()
            .catch(() => ({ error: resp.statusText }));
          setCostError(err.error ?? 'Failed to fetch cost data');
          return;
        }
        const raw = await resp.json();
        const serviceMap = new Map<
          string,
          { total: number; periods: { date: string; amount: number }[] }
        >();
        for (const result of raw.ResultsByTime ?? []) {
          const date = result.TimePeriod?.Start ?? '';
          for (const group of result.Groups ?? []) {
            const svc = group.Keys?.[0] ?? 'Other';
            const amount = parseFloat(
              group.Metrics?.UnblendedCost?.Amount ?? '0',
            );
            if (!serviceMap.has(svc))
              serviceMap.set(svc, { total: 0, periods: [] });
            const entry = serviceMap.get(svc)!;
            entry.total += amount;
            entry.periods.push({ date, amount });
          }
        }
        const services: ServiceCost[] = Array.from(serviceMap.entries())
          .map(([serviceName, val]) => ({ serviceName, ...val }))
          .filter(s => s.total > 0.001)
          .sort((a, b) => b.total - a.total);
        const total = services.reduce((sum, s) => sum + s.total, 0);
        const currency =
          raw.ResultsByTime?.[0]?.Groups?.[0]?.Metrics?.UnblendedCost?.Unit ??
          'USD';
        setCostData({ total, services, currency });
      } catch (e: any) {
        setCostError(e.message ?? 'Unexpected error');
      } finally {
        setCostLoading(false);
      }
    },
    [getBase, fetchApi, period, granularity],
  );

  const loadEcs = useCallback(
    async (configId: number) => {
      setEcsLoading(true);
      setEcsError('');
      setEcsData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/ecs/${configId}`);
        if (!resp.ok) {
          const err = await resp
            .json()
            .catch(() => ({ error: resp.statusText }));
          setEcsError(err.error ?? 'Failed to fetch ECS data');
          return;
        }
        const data: EcsData = await resp.json();
        setEcsData(data);
      } catch (e: any) {
        setEcsError(e.message ?? 'Unexpected error');
      } finally {
        setEcsLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadLambdaSummary = useCallback(
    async (configId: number) => {
      setSummaryLoading(true);
      setSummaryError('');
      setLambdaSummary(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/lambda-summary/${configId}`);
        if (!resp.ok) {
          const err = await resp
            .json()
            .catch(() => ({ error: resp.statusText }));
          setSummaryError(err.error ?? 'Failed to fetch Lambda summary');
          return;
        }
        const data: LambdaSummaryData = await resp.json();
        setLambdaSummary(data);
      } catch (e: any) {
        setSummaryError(e.message ?? 'Unexpected error');
      } finally {
        setSummaryLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadEc2 = useCallback(
    async (configId: number) => {
      setEc2Loading(true);
      setEc2Error('');
      setEc2Data(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/ec2/${configId}`);
        if (!resp.ok) {
          const err = await resp
            .json()
            .catch(() => ({ error: resp.statusText }));
          setEc2Error(err.error ?? 'Failed to fetch EC2 data');
          return;
        }
        const data: Ec2Data = await resp.json();
        setEc2Data(data);
      } catch (e: any) {
        setEc2Error(e.message ?? 'Unexpected error');
      } finally {
        setEc2Loading(false);
      }
    },
    [getBase, fetchApi],
  );

  const activeConfig = configs[activeTab];

  // Build list of available section keys based on config
  const sectionKeys: string[] = React.useMemo(() => {
    const keys = ['cost'];
    if (activeConfig?.ecs_cluster_name) keys.push('ecs');
    keys.push('lambda', 'ec2');
    return keys;
  }, [activeConfig]);

  const activeSection = sectionKeys[sectionTab] ?? 'cost';

  // Reset section tab when switching configs
  useEffect(() => {
    setSectionTab(0);
    setCostData(null);
    setEcsData(null);
    setEc2Data(null);
  }, [activeTab]);

  // Load cost when on cost section
  useEffect(() => {
    if (activeConfig && activeSection === 'cost') loadCost(activeConfig.id);
  }, [activeConfig, activeSection, loadCost]);

  // Load ECS when on ECS section and cluster is configured
  useEffect(() => {
    if (activeConfig?.ecs_cluster_name && activeSection === 'ecs') {
      loadEcs(activeConfig.id);
    }
  }, [activeConfig, activeSection, loadEcs]);

  // Load Lambda summary when on Lambda section
  useEffect(() => {
    if (activeConfig && activeSection === 'lambda') {
      loadLambdaSummary(activeConfig.id);
    }
  }, [activeConfig, activeSection, loadLambdaSummary]);

  // Load EC2 when on EC2 section
  useEffect(() => {
    if (activeConfig && activeSection === 'ec2') {
      loadEc2(activeConfig.id);
    }
  }, [activeConfig, activeSection, loadEc2]);

  const handleSave = async (formData: {
    configName: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    awsRegion: string;
    awsAccountId: string;
    ecsClusterName: string;
    ecsServiceName: string;
  }) => {
    const base = await getBase();
    if (editTarget) {
      await fetchApi.fetch(`${base}/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, entityRef }),
      });
    } else {
      await fetchApi.fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, entityRef }),
      });
    }
    await loadConfigs();
  };

  const handleDelete = async (cfg: AwsConfig) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete config "${cfg.config_name}"?`)) return;
    const base = await getBase();
    await fetchApi.fetch(`${base}/${cfg.id}`, { method: 'DELETE' });
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
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="h6">AWS Insights</Typography>
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
        <Paper
          elevation={0}
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px dashed #ccc',
          }}
        >
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
              style={{ flexGrow: 1 }}
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
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(activeConfig)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>

          {activeConfig && (
            <>
              {/* Account / region / auth info */}
              <Box
                display="flex"
                alignItems="center"
                flexWrap="wrap"
                style={{ gap: 12 }}
                mb={2}
              >
                {activeConfig.aws_account_id && (
                  <Typography variant="caption" color="textSecondary">
                    Account: {activeConfig.aws_account_id}
                  </Typography>
                )}
                <Typography variant="caption" color="textSecondary">
                  Region: {activeConfig.aws_region}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Auth:{' '}
                  {activeConfig.has_session_token
                    ? 'STS (session token)'
                    : 'IAM (access key)'}
                </Typography>
                {activeConfig.ecs_cluster_name && (
                  <Typography variant="caption" color="textSecondary">
                    ECS: {activeConfig.ecs_cluster_name}
                    {activeConfig.ecs_service_name
                      ? ` / ${activeConfig.ecs_service_name}`
                      : ''}
                  </Typography>
                )}
              </Box>

              {/* Section tabs: Cost | ECS | Lambda | EC2 */}
              <Box mb={2}>
                <Tabs
                  value={sectionTab}
                  onChange={(_, v) => setSectionTab(v)}
                  indicatorColor="primary"
                  textColor="primary"
                  style={{ minHeight: 36 }}
                >
                  {sectionKeys.map(key => (
                    <Tab
                      key={key}
                      label={key.toUpperCase()}
                      style={{ minHeight: 36, minWidth: 80 }}
                    />
                  ))}
                </Tabs>
                <Divider />
              </Box>

              {/* ── Cost section ── */}
              {activeSection === 'cost' && (
                <>
                  <Box
                    display="flex"
                    alignItems="center"
                    style={{ gap: 12 }}
                    mb={2}
                  >
                    <Select
                      value={period}
                      onChange={e => setPeriod(e.target.value as Period)}
                      variant="outlined"
                      style={{ height: 28, fontSize: 12 }}
                    >
                      {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                        <MenuItem key={p} value={p} style={{ fontSize: 12 }}>
                          {PERIOD_LABELS[p]}
                        </MenuItem>
                      ))}
                    </Select>
                    <Select
                      value={granularity}
                      onChange={e =>
                        setGranularity(e.target.value as Granularity)
                      }
                      variant="outlined"
                      style={{ height: 28, fontSize: 12 }}
                    >
                      <MenuItem value="MONTHLY" style={{ fontSize: 12 }}>
                        Monthly
                      </MenuItem>
                      <MenuItem value="DAILY" style={{ fontSize: 12 }}>
                        Daily
                      </MenuItem>
                    </Select>
                    <Tooltip title="Refresh">
                      <IconButton
                        size="small"
                        onClick={() => loadCost(activeConfig.id)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {costLoading && (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress size={32} />
                    </Box>
                  )}
                  {!costLoading && costError && (
                    <Paper
                      elevation={0}
                      style={{
                        padding: 16,
                        background: '#fff3f3',
                        border: '1px solid #f5c6cb',
                      }}
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
                        <Typography variant="h4" style={{ fontWeight: 700 }}>
                          ${costData.total.toFixed(2)}{' '}
                          <Typography
                            component="span"
                            variant="caption"
                            color="textSecondary"
                          >
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

              {/* ── ECS section ── */}
              {activeSection === 'ecs' && activeConfig.ecs_cluster_name && (
                <>
                  <Box
                    display="flex"
                    alignItems="center"
                    mb={2}
                    style={{ gap: 8 }}
                  >
                    <Typography variant="body2" color="textSecondary">
                      Cluster: <strong>{activeConfig.ecs_cluster_name}</strong>
                    </Typography>
                    <Tooltip title="Refresh ECS">
                      <IconButton
                        size="small"
                        onClick={() => loadEcs(activeConfig.id)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {ecsLoading && (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress size={32} />
                    </Box>
                  )}
                  {!ecsLoading && ecsError && (
                    <Paper
                      elevation={0}
                      style={{
                        padding: 16,
                        background: '#fff3f3',
                        border: '1px solid #f5c6cb',
                      }}
                    >
                      <Typography color="error" variant="body2">
                        {ecsError}
                      </Typography>
                    </Paper>
                  )}
                  {!ecsLoading && !ecsError && ecsData && (
                    <>
                      {ecsData.cluster && (
                        <EcsClusterCard cluster={ecsData.cluster} />
                      )}
                      {ecsData.services.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">
                          No services found in this cluster.
                        </Typography>
                      ) : (
                        <>
                          <Typography
                            variant="subtitle2"
                            style={{ marginBottom: 8, fontWeight: 600 }}
                          >
                            Services ({ecsData.services.length})
                          </Typography>
                          {ecsData.services.map(svc => (
                            <EcsServiceCard
                              key={svc.serviceName}
                              service={svc}
                              taskGroup={ecsData.tasks.find(
                                t => t.serviceName === svc.serviceName,
                              )}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Lambda section ── */}
              {activeSection === 'lambda' && (
                <>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={2}
                  >
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      Lambda Functions ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh Lambda">
                      <IconButton
                        size="small"
                        onClick={() => loadLambdaSummary(activeConfig.id)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {summaryLoading && (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress size={32} />
                    </Box>
                  )}

                  {summaryError && (
                    <Paper
                      elevation={0}
                      style={{
                        padding: 16,
                        background: '#fff3f3',
                        border: '1px solid #f5c6cb',
                        marginBottom: 16,
                      }}
                    >
                      <Typography color="error" variant="body2">
                        {summaryError}
                      </Typography>
                    </Paper>
                  )}

                  {lambdaSummary && (
                    <>
                      {/* Summary Cards - AWS Console Style */}
                      <Paper
                        variant="outlined"
                        style={{ padding: 16, marginBottom: 16 }}
                      >
                        <Grid container spacing={2}>
                          <Grid item xs={6} md={3}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                Lambda function(s)
                              </Typography>
                              <Typography
                                variant="h3"
                                style={{
                                  fontWeight: 700,
                                  marginTop: 4,
                                  color: '#1976d2',
                                }}
                              >
                                {lambdaSummary.summary.totalFunctions}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                Code storage
                              </Typography>
                              <Typography
                                variant="h3"
                                style={{ fontWeight: 700, marginTop: 4 }}
                              >
                                {(
                                  lambdaSummary.summary.totalCodeSize /
                                  1024 /
                                  1024 /
                                  1024
                                ).toFixed(1)}{' '}
                                GB
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                (
                                {(
                                  (lambdaSummary.summary.totalCodeSize /
                                    1024 /
                                    1024 /
                                    1024 /
                                    75) *
                                  100
                                ).toFixed(1)}
                                % of 75 GB)
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                Full account concurrency
                              </Typography>
                              <Typography
                                variant="h3"
                                style={{ fontWeight: 700, marginTop: 4 }}
                              >
                                {lambdaSummary.summary.accountConcurrency}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                Unreserved account concurrency
                              </Typography>
                              <Typography
                                variant="h3"
                                style={{ fontWeight: 700, marginTop: 4 }}
                              >
                                {lambdaSummary.summary.unreservedConcurrency}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>

                      {/* Top 10 Functions - AWS Console Style */}
                      <Typography
                        variant="subtitle2"
                        color="textSecondary"
                        gutterBottom
                      >
                        Top 10 functions
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                        style={{ marginBottom: 16 }}
                      >
                        The charts below show the top 10 functions in each
                        category from the last 3 hours in this AWS region.
                      </Typography>

                      <Grid container spacing={2}>
                        {/* Errors Chart */}
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" style={{ padding: 16 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Errors
                            </Typography>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              display="block"
                              style={{ marginBottom: 16 }}
                            >
                              Count
                            </Typography>
                            {lambdaSummary.topFunctions.byErrors.length ===
                            0 ? (
                              <Typography variant="body2" color="textSecondary">
                                No errors in the last 3 hours
                              </Typography>
                            ) : (
                              <>
                                {lambdaSummary.topFunctions.byErrors
                                  .slice(0, 10)
                                  .map((func, idx) => (
                                    <Box key={func.functionName} mb={1}>
                                      <Box
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                      >
                                        <Typography
                                          variant="caption"
                                          style={{ fontSize: 11 }}
                                        >
                                          {idx + 1} - {func.functionName}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {func.errors.toFixed(0)}
                                        </Typography>
                                      </Box>
                                      {func.errorsDatapoints.length > 0 && (
                                        <svg
                                          width="100%"
                                          height="20"
                                          style={{
                                            display: 'block',
                                            marginTop: 2,
                                          }}
                                        >
                                          <polyline
                                            fill="none"
                                            stroke={getSparklineColor(idx)}
                                            strokeWidth="1.5"
                                            points={func.errorsDatapoints
                                              .map((dp, i) => {
                                                const x =
                                                  (i /
                                                    Math.max(
                                                      func.errorsDatapoints
                                                        .length - 1,
                                                      1,
                                                    )) *
                                                  100;
                                                const maxVal = Math.max(
                                                  ...func.errorsDatapoints.map(
                                                    d => d.Sum ?? 0,
                                                  ),
                                                  1,
                                                );
                                                const y =
                                                  18 -
                                                  ((dp.Sum ?? 0) / maxVal) * 16;
                                                return `${x}%,${y}`;
                                              })
                                              .join(' ')}
                                          />
                                        </svg>
                                      )}
                                    </Box>
                                  ))}
                              </>
                            )}
                          </Paper>
                        </Grid>

                        {/* Invocations Chart */}
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" style={{ padding: 16 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Invocations
                            </Typography>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              display="block"
                              style={{ marginBottom: 16 }}
                            >
                              Count
                            </Typography>
                            {lambdaSummary.topFunctions.byInvocations.length ===
                            0 ? (
                              <Typography variant="body2" color="textSecondary">
                                No invocations in the last 3 hours
                              </Typography>
                            ) : (
                              <>
                                {lambdaSummary.topFunctions.byInvocations
                                  .slice(0, 10)
                                  .map((func, idx) => (
                                    <Box key={func.functionName} mb={1}>
                                      <Box
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                      >
                                        <Typography
                                          variant="caption"
                                          style={{ fontSize: 11 }}
                                        >
                                          {idx + 1} - {func.functionName}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {func.invocations.toFixed(0)}
                                        </Typography>
                                      </Box>
                                      {func.invocationsDatapoints.length >
                                        0 && (
                                        <svg
                                          width="100%"
                                          height="20"
                                          style={{
                                            display: 'block',
                                            marginTop: 2,
                                          }}
                                        >
                                          <polyline
                                            fill="none"
                                            stroke={getSparklineColor(idx)}
                                            strokeWidth="1.5"
                                            points={func.invocationsDatapoints
                                              .map((dp, i) => {
                                                const x =
                                                  (i /
                                                    Math.max(
                                                      func.invocationsDatapoints
                                                        .length - 1,
                                                      1,
                                                    )) *
                                                  100;
                                                const maxVal = Math.max(
                                                  ...func.invocationsDatapoints.map(
                                                    d => d.Sum ?? 0,
                                                  ),
                                                  1,
                                                );
                                                const y =
                                                  18 -
                                                  ((dp.Sum ?? 0) / maxVal) * 16;
                                                return `${x}%,${y}`;
                                              })
                                              .join(' ')}
                                          />
                                        </svg>
                                      )}
                                    </Box>
                                  ))}
                              </>
                            )}
                          </Paper>
                        </Grid>

                        {/* Concurrent Executions Chart */}
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" style={{ padding: 16 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Concurrent Executions
                            </Typography>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              display="block"
                              style={{ marginBottom: 16 }}
                            >
                              Count
                            </Typography>
                            {lambdaSummary.topFunctions.byConcurrent.length ===
                            0 ? (
                              <Typography variant="body2" color="textSecondary">
                                No concurrent executions in the last 3 hours
                              </Typography>
                            ) : (
                              <>
                                {lambdaSummary.topFunctions.byConcurrent
                                  .slice(0, 10)
                                  .map((func, idx) => (
                                    <Box key={func.functionName} mb={1}>
                                      <Box
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                      >
                                        <Typography
                                          variant="caption"
                                          style={{ fontSize: 11 }}
                                        >
                                          {idx + 1} - {func.functionName}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {func.concurrentExecutions.toFixed(0)}
                                        </Typography>
                                      </Box>
                                      {func.concurrentDatapoints.length > 0 && (
                                        <svg
                                          width="100%"
                                          height="20"
                                          style={{
                                            display: 'block',
                                            marginTop: 2,
                                          }}
                                        >
                                          <polyline
                                            fill="none"
                                            stroke={getSparklineColor(idx)}
                                            strokeWidth="1.5"
                                            points={func.concurrentDatapoints
                                              .map((dp, i) => {
                                                const x =
                                                  (i /
                                                    Math.max(
                                                      func.concurrentDatapoints
                                                        .length - 1,
                                                      1,
                                                    )) *
                                                  100;
                                                const maxVal = Math.max(
                                                  ...func.concurrentDatapoints.map(
                                                    d => d.Maximum ?? 0,
                                                  ),
                                                  1,
                                                );
                                                const y =
                                                  18 -
                                                  ((dp.Maximum ?? 0) / maxVal) *
                                                    16;
                                                return `${x}%,${y}`;
                                              })
                                              .join(' ')}
                                          />
                                        </svg>
                                      )}
                                    </Box>
                                  ))}
                              </>
                            )}
                          </Paper>
                        </Grid>
                      </Grid>
                    </>
                  )}
                </>
              )}

              {/* ── EC2 section ── */}
              {activeSection === 'ec2' && (
                <>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={2}
                  >
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      EC2 Instances ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh EC2">
                      <IconButton
                        size="small"
                        onClick={() => loadEc2(activeConfig.id)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {ec2Loading && (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress size={32} />
                    </Box>
                  )}

                  {ec2Error && (
                    <Paper
                      elevation={0}
                      style={{
                        padding: 16,
                        background: '#fff3f3',
                        border: '1px solid #f5c6cb',
                        marginBottom: 16,
                      }}
                    >
                      <Typography color="error" variant="body2">
                        {ec2Error}
                      </Typography>
                    </Paper>
                  )}

                  {ec2Data && (
                    <>
                      {/* Summary row */}
                      <Paper
                        variant="outlined"
                        style={{ padding: 16, marginBottom: 16 }}
                      >
                        <Grid container spacing={2}>
                          <Grid item xs={4} md={2}>
                            <Box textAlign="center">
                              <Typography
                                variant="h4"
                                style={{ fontWeight: 700, color: '#1976d2' }}
                              >
                                {ec2Data.totalInstances}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Total Instances
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4} md={2}>
                            <Box textAlign="center">
                              <Typography
                                variant="h4"
                                style={{ fontWeight: 700, color: '#2e7d32' }}
                              >
                                {ec2Data.runningCount}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Running
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4} md={2}>
                            <Box textAlign="center">
                              <Typography
                                variant="h4"
                                style={{ fontWeight: 700, color: '#c62828' }}
                              >
                                {ec2Data.stoppedCount}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Stopped
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>

                      {/* Instance list */}
                      {ec2Data.instances.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">
                          No EC2 instances found in this region.
                        </Typography>
                      ) : (
                        ec2Data.instances.map(inst => {
                          const stateStyle = ec2StateStyle(inst.state);
                          return (
                            <Paper
                              key={inst.instanceId}
                              elevation={1}
                              style={{ padding: 16, marginBottom: 12 }}
                            >
                              {/* Instance header */}
                              <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                mb={1}
                              >
                                <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                                  <Typography
                                    variant="subtitle2"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {inst.name || inst.instanceId}
                                  </Typography>
                                  <Chip
                                    label={inst.state}
                                    size="small"
                                    style={{
                                      fontSize: 10,
                                      height: 20,
                                      color: stateStyle.color,
                                      backgroundColor: stateStyle.bg,
                                      fontWeight: 600,
                                    }}
                                  />
                                  <Chip
                                    label={inst.instanceType}
                                    size="small"
                                    variant="outlined"
                                    style={{ fontSize: 10, height: 20 }}
                                  />
                                  {inst.architecture && (
                                    <Chip
                                      label={inst.architecture}
                                      size="small"
                                      variant="outlined"
                                      style={{ fontSize: 10, height: 20 }}
                                    />
                                  )}
                                </Box>
                                {inst.name && (
                                  <Typography variant="caption" color="textSecondary">
                                    {inst.instanceId}
                                  </Typography>
                                )}
                              </Box>

                              {/* Details grid */}
                              <Box
                                display="flex"
                                flexWrap="wrap"
                                style={{ gap: 24 }}
                              >
                                {inst.privateIp && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Private IP
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.privateIp}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.publicIp && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Public IP
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.publicIp}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.availabilityZone && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      AZ
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.availabilityZone}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.vpcId && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      VPC
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.vpcId}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.subnetId && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Subnet
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.subnetId}
                                    </Typography>
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="caption" color="textSecondary">
                                    Platform
                                  </Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>
                                    {inst.platform}
                                  </Typography>
                                </Box>
                                {inst.keyName && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Key Pair
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.keyName}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.monitoring && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Monitoring
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {inst.monitoring}
                                    </Typography>
                                  </Box>
                                )}
                                {inst.launchTime && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      Launched
                                    </Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {new Date(inst.launchTime).toLocaleString()}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* Security groups */}
                              {inst.securityGroups.length > 0 && (
                                <Box mt={1} display="flex" alignItems="center" style={{ gap: 4 }}>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    style={{ marginRight: 4 }}
                                  >
                                    SGs:
                                  </Typography>
                                  {inst.securityGroups.map(sg => (
                                    <Chip
                                      key={sg.groupId}
                                      label={sg.groupName || sg.groupId}
                                      size="small"
                                      variant="outlined"
                                      style={{ fontSize: 10, height: 18 }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Paper>
                          );
                        })
                      )}
                    </>
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
