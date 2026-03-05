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
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useSharedTabSettings } from '../tab-settings/TabSettingsContext';

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

// ── S3 Types ──────────────────────────────────────────────────────────────────

interface S3Bucket {
  name: string;
  creationDate: string | null;
  region: string | null;
}

interface S3Data {
  totalBuckets: number;
  buckets: S3Bucket[];
}

// ── RDS Types ─────────────────────────────────────────────────────────────────

interface RdsInstance {
  dbInstanceIdentifier: string;
  dbInstanceClass: string;
  engine: string;
  engineVersion: string;
  status: string;
  endpoint: string | null;
  port: number | null;
  allocatedStorage: number;
  multiAZ: boolean;
  availabilityZone: string | null;
  storageType: string;
  storageEncrypted: boolean;
  enabledCloudwatchLogsExports: string[];
}

interface RdsData {
  totalInstances: number;
  instances: RdsInstance[];
}

interface RdsLogFile {
  logFileName: string;
  lastWritten: number;
  size: number;
}

// ── CloudFront Types ──────────────────────────────────────────────────────────

interface CloudFrontDistribution {
  id: string;
  domainName: string;
  status: string;
  enabled: boolean;
  aliases: string[];
  origins: string[];
  priceClass: string;
  lastModified: string | null;
}

interface CloudFrontData {
  totalDistributions: number;
  distributions: CloudFrontDistribution[];
}

// ── OpenSearch Types ──────────────────────────────────────────────────────────

interface OpenSearchLogOption {
  enabled: boolean;
  cloudWatchLogsLogGroupArn: string;
}

interface OpenSearchDomain {
  domainName: string;
  engineVersion: string;
  endpoint: string | null;
  instanceType: string;
  instanceCount: number;
  storageType: string;
  ebsVolumeSize: number | null;
  processing: boolean;
  created: boolean;
  deleted: boolean;
  logPublishingOptions: Record<string, OpenSearchLogOption>;
}

interface OpenSearchData {
  totalDomains: number;
  domains: OpenSearchDomain[];
}

interface OpenSearchLogEvent {
  timestamp: number;
  message: string;
  logStream: string;
}

const OS_LOG_TYPE_LABELS: Record<string, string> = {
  INDEX_SLOW_LOGS: 'Index Slow Logs',
  SEARCH_SLOW_LOGS: 'Search Slow Logs',
  ES_APPLICATION_LOGS: 'Application Logs',
  AUDIT_LOGS: 'Audit Logs',
};

// ── CodeBuild Types ───────────────────────────────────────────────────────────

interface CodeBuildLastBuild {
  id: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  initiator: string | null;
}

interface CodeBuildProject {
  name: string;
  arn: string;
  description: string | null;
  sourceType: string;
  sourceLocation: string | null;
  environmentType: string;
  environmentImage: string;
  created: string | null;
  lastModified: string | null;
  lastBuild: CodeBuildLastBuild | null;
}

interface CodeBuildData {
  totalProjects: number;
  projects: CodeBuildProject[];
}

interface CodeBuildPhase {
  name: string;
  status: string;
  durationSeconds: number | null;
}

interface CodeBuildBuild {
  id: string;
  buildNumber: number | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  initiator: string | null;
  sourceVersion: string | null;
  resolvedSourceVersion: string | null;
  phases: CodeBuildPhase[];
}

// ── CodePipeline Types ─────────────────────────────────────────────────────────

interface PipelineAction {
  name: string;
  status: string;
  lastStatusChange: string | null;
  externalExecutionUrl: string | null;
  errorDetails: string | null;
}

interface PipelineStage {
  name: string;
  status: string;
  lastChangedAt: string | null;
  actions: PipelineAction[];
}

interface PipelineLatestExecution {
  status: string;
  startTime: string | null;
  lastUpdateTime: string | null;
  trigger: string | null;
}

interface CodePipelineEntry {
  name: string;
  version: number;
  created: string | null;
  updated: string | null;
  stages: PipelineStage[];
  latestExecution: PipelineLatestExecution | null;
}

interface CodePipelineData {
  totalPipelines: number;
  pipelines: CodePipelineEntry[];
}

function buildStatusStyle(status: string): { color: string; bg: string } {
  switch (status) {
    case 'SUCCEEDED': case 'Succeeded': return { color: '#2e7d32', bg: '#e8f5e9' };
    case 'FAILED': case 'Failed': return { color: '#c62828', bg: '#ffebee' };
    case 'IN_PROGRESS': case 'InProgress': return { color: '#1565c0', bg: '#e3f2fd' };
    case 'STOPPED': case 'Stopped': return { color: '#e65100', bg: '#fff3e0' };
    case 'TIMED_OUT': return { color: '#6a1a1a', bg: '#ffebee' };
    default: return { color: '#616161', bg: '#f5f5f5' };
  }
}

function pipelineStatusStyle(status: string): { color: string; bg: string } {
  switch (status) {
    case 'Succeeded': return { color: '#2e7d32', bg: '#e8f5e9' };
    case 'Failed': return { color: '#c62828', bg: '#ffebee' };
    case 'InProgress': return { color: '#1565c0', bg: '#e3f2fd' };
    case 'Stopped': case 'Stopping': return { color: '#e65100', bg: '#fff3e0' };
    case 'Superseded': return { color: '#6a1a1a', bg: '#fce4ec' };
    default: return { color: '#616161', bg: '#f5f5f5' };
  }
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

  // S3 state
  const [s3Data, setS3Data] = useState<S3Data | null>(null);
  const [s3Loading, setS3Loading] = useState(false);
  const [s3Error, setS3Error] = useState('');

  // RDS state
  const [rdsData, setRdsData] = useState<RdsData | null>(null);
  const [rdsLoading, setRdsLoading] = useState(false);
  const [rdsError, setRdsError] = useState('');
  const [rdsLogsExpanded, setRdsLogsExpanded] = useState<Record<string, boolean>>({});
  const [rdsLogFiles, setRdsLogFiles] = useState<Record<string, RdsLogFile[]>>({});
  const [rdsLogFilesLoading, setRdsLogFilesLoading] = useState<Record<string, boolean>>({});
  const [rdsLogFilesError, setRdsLogFilesError] = useState<Record<string, string>>({});
  const [rdsSelectedLogFile, setRdsSelectedLogFile] = useState<Record<string, string>>({});
  const [rdsLogContent, setRdsLogContent] = useState<Record<string, string>>({});
  const [rdsLogContentLoading, setRdsLogContentLoading] = useState<Record<string, boolean>>({});
  const [rdsLogContentError, setRdsLogContentError] = useState<Record<string, string>>({});

  // CloudFront state
  const [cfData, setCfData] = useState<CloudFrontData | null>(null);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');

  // OpenSearch state
  const [osData, setOsData] = useState<OpenSearchData | null>(null);
  const [osLoading, setOsLoading] = useState(false);
  const [osError, setOsError] = useState('');
  const [osLogsExpanded, setOsLogsExpanded] = useState<Record<string, boolean>>({});
  const [osLogsType, setOsLogsType] = useState<Record<string, string>>({});
  const [osLogsData, setOsLogsData] = useState<Record<string, OpenSearchLogEvent[]>>({});
  const [osLogsLoading, setOsLogsLoading] = useState<Record<string, boolean>>({});
  const [osLogsError, setOsLogsError] = useState<Record<string, string>>({});

  // CodeBuild state
  const [cbData, setCbData] = useState<CodeBuildData | null>(null);
  const [cbLoading, setCbLoading] = useState(false);
  const [cbError, setCbError] = useState('');
  const [cbExpanded, setCbExpanded] = useState<Record<string, boolean>>({});
  const [cbBuilds, setCbBuilds] = useState<Record<string, CodeBuildBuild[]>>({});
  const [cbBuildsLoading, setCbBuildsLoading] = useState<Record<string, boolean>>({});
  const [cbBuildsError, setCbBuildsError] = useState<Record<string, string>>({});

  // CodePipeline state
  const [cpData, setCpData] = useState<CodePipelineData | null>(null);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AwsConfig | undefined>(
    undefined,
  );

  // Section tab (Cost | ECS) within a config
  const [sectionTab, setSectionTab] = useState(0);

  const { isTabEnabled: isSubTabEnabled } = useSharedTabSettings();

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

  const loadS3 = useCallback(
    async (configId: number) => {
      setS3Loading(true);
      setS3Error('');
      setS3Data(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/s3/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setS3Error(err.error ?? 'Failed to fetch S3 data');
          return;
        }
        setS3Data(await resp.json());
      } catch (e: any) {
        setS3Error(e.message ?? 'Unexpected error');
      } finally {
        setS3Loading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadRds = useCallback(
    async (configId: number) => {
      setRdsLoading(true);
      setRdsError('');
      setRdsData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/rds/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setRdsError(err.error ?? 'Failed to fetch RDS data');
          return;
        }
        setRdsData(await resp.json());
      } catch (e: any) {
        setRdsError(e.message ?? 'Unexpected error');
      } finally {
        setRdsLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadCloudFront = useCallback(
    async (configId: number) => {
      setCfLoading(true);
      setCfError('');
      setCfData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/cloudfront/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setCfError(err.error ?? 'Failed to fetch CloudFront data');
          return;
        }
        setCfData(await resp.json());
      } catch (e: any) {
        setCfError(e.message ?? 'Unexpected error');
      } finally {
        setCfLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadOpenSearch = useCallback(
    async (configId: number) => {
      setOsLoading(true);
      setOsError('');
      setOsData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/opensearch/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setOsError(err.error ?? 'Failed to fetch OpenSearch data');
          return;
        }
        setOsData(await resp.json());
      } catch (e: any) {
        setOsError(e.message ?? 'Unexpected error');
      } finally {
        setOsLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadOsLogs = useCallback(
    async (configId: number, domainName: string, logGroupArn: string) => {
      const key = `${configId}:${domainName}`;
      setOsLogsLoading(prev => ({ ...prev, [key]: true }));
      setOsLogsError(prev => ({ ...prev, [key]: '' }));
      setOsLogsData(prev => ({ ...prev, [key]: [] }));
      try {
        const base = await getBase();
        const url = `${base}/opensearch/${configId}/logs?logGroupArn=${encodeURIComponent(logGroupArn)}&limit=100`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setOsLogsError(prev => ({ ...prev, [key]: err.error ?? 'Failed to fetch logs' }));
          return;
        }
        const data = await resp.json();
        setOsLogsData(prev => ({ ...prev, [key]: data.events ?? [] }));
      } catch (e: any) {
        setOsLogsError(prev => ({ ...prev, [key]: e.message ?? 'Unexpected error' }));
      } finally {
        setOsLogsLoading(prev => ({ ...prev, [key]: false }));
      }
    },
    [getBase, fetchApi],
  );

  const loadRdsLogFiles = useCallback(
    async (configId: number, dbInstanceId: string) => {
      setRdsLogFilesLoading(prev => ({ ...prev, [dbInstanceId]: true }));
      setRdsLogFilesError(prev => ({ ...prev, [dbInstanceId]: '' }));
      setRdsLogFiles(prev => ({ ...prev, [dbInstanceId]: [] }));
      try {
        const base = await getBase();
        const url = `${base}/rds/${configId}/logfiles?dbInstanceId=${encodeURIComponent(dbInstanceId)}`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setRdsLogFilesError(prev => ({ ...prev, [dbInstanceId]: err.error ?? 'Failed to fetch log files' }));
          return;
        }
        const data = await resp.json();
        setRdsLogFiles(prev => ({ ...prev, [dbInstanceId]: data.files ?? [] }));
      } catch (e: any) {
        setRdsLogFilesError(prev => ({ ...prev, [dbInstanceId]: e.message ?? 'Unexpected error' }));
      } finally {
        setRdsLogFilesLoading(prev => ({ ...prev, [dbInstanceId]: false }));
      }
    },
    [getBase, fetchApi],
  );

  const loadRdsLogContent = useCallback(
    async (configId: number, dbInstanceId: string, logFileName: string) => {
      const key = `${dbInstanceId}:${logFileName}`;
      setRdsLogContentLoading(prev => ({ ...prev, [key]: true }));
      setRdsLogContentError(prev => ({ ...prev, [key]: '' }));
      setRdsLogContent(prev => ({ ...prev, [key]: '' }));
      try {
        const base = await getBase();
        const url = `${base}/rds/${configId}/logcontent?dbInstanceId=${encodeURIComponent(dbInstanceId)}&logFileName=${encodeURIComponent(logFileName)}`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setRdsLogContentError(prev => ({ ...prev, [key]: err.error ?? 'Failed to fetch log content' }));
          return;
        }
        const data = await resp.json();
        setRdsLogContent(prev => ({ ...prev, [key]: data.logFileData ?? '' }));
      } catch (e: any) {
        setRdsLogContentError(prev => ({ ...prev, [key]: e.message ?? 'Unexpected error' }));
      } finally {
        setRdsLogContentLoading(prev => ({ ...prev, [key]: false }));
      }
    },
    [getBase, fetchApi],
  );

  const loadCodeBuild = useCallback(
    async (configId: number) => {
      setCbLoading(true);
      setCbError('');
      setCbData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/codebuild/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setCbError(err.error ?? 'Failed to fetch CodeBuild data');
          return;
        }
        setCbData(await resp.json());
      } catch (e: any) {
        setCbError(e.message ?? 'Unexpected error');
      } finally {
        setCbLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const loadCbBuilds = useCallback(
    async (configId: number, projectName: string) => {
      setCbBuildsLoading(prev => ({ ...prev, [projectName]: true }));
      setCbBuildsError(prev => ({ ...prev, [projectName]: '' }));
      setCbBuilds(prev => ({ ...prev, [projectName]: [] }));
      try {
        const base = await getBase();
        const url = `${base}/codebuild/${configId}/builds?projectName=${encodeURIComponent(projectName)}`;
        const resp = await fetchApi.fetch(url);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setCbBuildsError(prev => ({ ...prev, [projectName]: err.error ?? 'Failed to fetch builds' }));
          return;
        }
        const data = await resp.json();
        setCbBuilds(prev => ({ ...prev, [projectName]: data.builds ?? [] }));
      } catch (e: any) {
        setCbBuildsError(prev => ({ ...prev, [projectName]: e.message ?? 'Unexpected error' }));
      } finally {
        setCbBuildsLoading(prev => ({ ...prev, [projectName]: false }));
      }
    },
    [getBase, fetchApi],
  );

  const loadCodePipeline = useCallback(
    async (configId: number) => {
      setCpLoading(true);
      setCpError('');
      setCpData(null);
      try {
        const base = await getBase();
        const resp = await fetchApi.fetch(`${base}/codepipeline/${configId}`);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setCpError(err.error ?? 'Failed to fetch CodePipeline data');
          return;
        }
        setCpData(await resp.json());
      } catch (e: any) {
        setCpError(e.message ?? 'Unexpected error');
      } finally {
        setCpLoading(false);
      }
    },
    [getBase, fetchApi],
  );

  const activeConfig = configs[activeTab];

  // Build list of available section keys based on config and visibility settings
  const sectionKeys: string[] = React.useMemo(() => {
    const keys: string[] = [];
    if (isSubTabEnabled('aws-cost/cost')) keys.push('cost');
    if (activeConfig?.ecs_cluster_name) keys.push('ecs');
    if (isSubTabEnabled('aws-cost/lambda')) keys.push('lambda');
    if (isSubTabEnabled('aws-cost/ec2')) keys.push('ec2');
    if (isSubTabEnabled('aws-cost/s3')) keys.push('s3');
    if (isSubTabEnabled('aws-cost/rds')) keys.push('rds');
    if (isSubTabEnabled('aws-cost/cloudfront')) keys.push('cloudfront');
    if (isSubTabEnabled('aws-cost/opensearch')) keys.push('opensearch');
    if (isSubTabEnabled('aws-cost/codebuild')) keys.push('codebuild');
    if (isSubTabEnabled('aws-cost/codepipeline')) keys.push('codepipeline');
    return keys;
  }, [activeConfig, isSubTabEnabled]);

  const activeSection = sectionKeys[sectionTab] ?? 'cost';

  // Reset section tab when switching configs
  useEffect(() => {
    setSectionTab(0);
    setCostData(null);
    setEcsData(null);
    setEc2Data(null);
    setS3Data(null);
    setRdsData(null);
    setCfData(null);
    setOsData(null);
    setCbData(null);
    setCpData(null);
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

  // Load S3 when on S3 section
  useEffect(() => {
    if (activeConfig && activeSection === 's3') loadS3(activeConfig.id);
  }, [activeConfig, activeSection, loadS3]);

  // Load RDS when on RDS section
  useEffect(() => {
    if (activeConfig && activeSection === 'rds') loadRds(activeConfig.id);
  }, [activeConfig, activeSection, loadRds]);

  // Load CloudFront when on CloudFront section
  useEffect(() => {
    if (activeConfig && activeSection === 'cloudfront') loadCloudFront(activeConfig.id);
  }, [activeConfig, activeSection, loadCloudFront]);

  // Load OpenSearch when on OpenSearch section
  useEffect(() => {
    if (activeConfig && activeSection === 'opensearch') loadOpenSearch(activeConfig.id);
  }, [activeConfig, activeSection, loadOpenSearch]);

  useEffect(() => {
    if (activeConfig && activeSection === 'codebuild') loadCodeBuild(activeConfig.id);
  }, [activeConfig, activeSection, loadCodeBuild]);

  useEffect(() => {
    if (activeConfig && activeSection === 'codepipeline') loadCodePipeline(activeConfig.id);
  }, [activeConfig, activeSection, loadCodePipeline]);

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

              {/* ── S3 section ── */}
              {activeSection === 's3' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      S3 Buckets
                    </Typography>
                    <Tooltip title="Refresh S3">
                      <IconButton size="small" onClick={() => loadS3(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {s3Loading && (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>
                  )}
                  {s3Error && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{s3Error}</Typography>
                    </Paper>
                  )}
                  {s3Data && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>
                            {s3Data.totalBuckets}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Total Buckets</Typography>
                        </Box>
                      </Paper>
                      {s3Data.buckets.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No S3 buckets found.</Typography>
                      ) : (
                        s3Data.buckets.map(b => (
                          <Paper key={b.name} elevation={1} style={{ padding: 16, marginBottom: 12 }}>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>{b.name}</Typography>
                              {b.region && <Chip label={b.region} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />}
                            </Box>
                            {b.creationDate && (
                              <Typography variant="caption" color="textSecondary">
                                Created: {new Date(b.creationDate).toLocaleString()}
                              </Typography>
                            )}
                          </Paper>
                        ))
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── RDS section ── */}
              {activeSection === 'rds' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      RDS Instances ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh RDS">
                      <IconButton size="small" onClick={() => loadRds(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {rdsLoading && (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>
                  )}
                  {rdsError && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{rdsError}</Typography>
                    </Paper>
                  )}
                  {rdsData && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>
                            {rdsData.totalInstances}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Total DB Instances</Typography>
                        </Box>
                      </Paper>
                      {rdsData.instances.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No RDS instances found.</Typography>
                      ) : (
                        rdsData.instances.map(db => {
                          const dbId = db.dbInstanceIdentifier;
                          const isOpen = rdsLogsExpanded[dbId] ?? false;
                          const logFiles = rdsLogFiles[dbId] ?? [];
                          const selectedFile = rdsSelectedLogFile[dbId] ?? '';
                          const contentKey = `${dbId}:${selectedFile}`;

                          const handleToggle = () => {
                            const opening = !isOpen;
                            setRdsLogsExpanded(prev => ({ ...prev, [dbId]: opening }));
                            if (opening && !rdsLogFiles[dbId]) {
                              loadRdsLogFiles(activeConfig.id, dbId);
                            }
                          };

                          const handleFileSelect = (fileName: string) => {
                            setRdsSelectedLogFile(prev => ({ ...prev, [dbId]: fileName }));
                            loadRdsLogContent(activeConfig.id, dbId, fileName);
                          };

                          return (
                            <Paper key={dbId} elevation={1} style={{ marginBottom: 12, overflow: 'hidden' }}>
                              {/* Accordion header */}
                              <Box
                                display="flex"
                                alignItems="center"
                                style={{
                                  gap: 8,
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  background: isOpen ? '#f5f8ff' : 'transparent',
                                  transition: 'background 0.2s',
                                }}
                                onClick={handleToggle}
                              >
                                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>{dbId}</Typography>
                                <Chip
                                  label={db.status}
                                  size="small"
                                  style={{
                                    fontSize: 10, height: 20, fontWeight: 600,
                                    color: db.status === 'available' ? '#2e7d32' : '#c62828',
                                    backgroundColor: db.status === 'available' ? '#e8f5e9' : '#ffebee',
                                  }}
                                />
                                <Chip label={`${db.engine} ${db.engineVersion}`} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                                <Chip label={db.dbInstanceClass} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                                <Box ml="auto" display="flex" alignItems="center" style={{ gap: 6 }}>
                                  <Typography variant="caption" color="textSecondary" style={{ fontSize: 11 }}>
                                    {isOpen ? 'Hide Logs' : 'View Logs'}
                                  </Typography>
                                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </Box>
                              </Box>

                              {/* Instance details */}
                              <Box display="flex" flexWrap="wrap" style={{ gap: 24, padding: '0 16px 12px' }}>
                                {db.endpoint && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">Endpoint</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>{db.endpoint}:{db.port}</Typography>
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Storage</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{db.allocatedStorage} GB ({db.storageType})</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Multi-AZ</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{db.multiAZ ? 'Yes' : 'No'}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Encrypted</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{db.storageEncrypted ? 'Yes' : 'No'}</Typography>
                                </Box>
                                {db.availabilityZone && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">AZ</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>{db.availabilityZone}</Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* Logs accordion body */}
                              {isOpen && (
                                <Box style={{ borderTop: '1px solid #e0e0e0' }}>
                                  <Box p={2}>
                                    {rdsLogFilesLoading[dbId] && (
                                      <Box display="flex" justifyContent="center" p={2}><CircularProgress size={24} /></Box>
                                    )}
                                    {rdsLogFilesError[dbId] && (
                                      <Typography color="error" variant="caption">{rdsLogFilesError[dbId]}</Typography>
                                    )}
                                    {!rdsLogFilesLoading[dbId] && logFiles.length === 0 && !rdsLogFilesError[dbId] && (
                                      <Typography variant="caption" color="textSecondary">No log files found.</Typography>
                                    )}
                                    {logFiles.length > 0 && (
                                      <>
                                        {/* Log file list as chips */}
                                        <Box display="flex" alignItems="center" mb={1} style={{ gap: 6 }}>
                                          <Typography variant="caption" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Log File:</Typography>
                                          <Box display="flex" flexWrap="wrap" style={{ gap: 6, flex: 1 }}>
                                            {logFiles.map(f => (
                                              <Chip
                                                key={f.logFileName}
                                                label={f.logFileName.split('/').pop()}
                                                title={f.logFileName}
                                                size="small"
                                                clickable
                                                onClick={() => handleFileSelect(f.logFileName)}
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: selectedFile === f.logFileName ? 700 : 400,
                                                  background: selectedFile === f.logFileName ? '#1976d2' : '#f0f0f0',
                                                  color: selectedFile === f.logFileName ? '#fff' : '#333',
                                                  maxWidth: 220,
                                                }}
                                              />
                                            ))}
                                          </Box>
                                          <IconButton
                                            size="small"
                                            title="Refresh log files"
                                            disabled={rdsLogFilesLoading[dbId]}
                                            onClick={e => { e.stopPropagation(); loadRdsLogFiles(activeConfig.id, dbId); }}
                                          >
                                            <RefreshIcon fontSize="small" />
                                          </IconButton>
                                        </Box>

                                        {/* Log content */}
                                        {selectedFile && (
                                          <>
                                            {rdsLogContentLoading[contentKey] && (
                                              <Box display="flex" justifyContent="center" p={2}><CircularProgress size={24} /></Box>
                                            )}
                                            {rdsLogContentError[contentKey] && (
                                              <Typography color="error" variant="caption">{rdsLogContentError[contentKey]}</Typography>
                                            )}
                                            {rdsLogContent[contentKey] !== undefined && rdsLogContent[contentKey] !== '' && !rdsLogContentLoading[contentKey] && (
                                              <Box
                                                component="pre"
                                                style={{
                                                  background: '#1e1e1e',
                                                  color: '#d4d4d4',
                                                  padding: 12,
                                                  borderRadius: 4,
                                                  fontSize: 11,
                                                  overflowX: 'auto',
                                                  maxHeight: 420,
                                                  overflowY: 'auto',
                                                  fontFamily: 'monospace',
                                                  margin: 0,
                                                  whiteSpace: 'pre-wrap',
                                                  wordBreak: 'break-all',
                                                }}
                                              >
                                                {rdsLogContent[contentKey]}
                                              </Box>
                                            )}
                                            {rdsLogContent[contentKey] === '' && !rdsLogContentLoading[contentKey] && !rdsLogContentError[contentKey] && (
                                              <Typography variant="caption" color="textSecondary">Log file is empty.</Typography>
                                            )}
                                          </>
                                        )}
                                      </>
                                    )}
                                  </Box>
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

              {/* ── CloudFront section ── */}
              {activeSection === 'cloudfront' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      CloudFront Distributions
                    </Typography>
                    <Tooltip title="Refresh CloudFront">
                      <IconButton size="small" onClick={() => loadCloudFront(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {cfLoading && (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>
                  )}
                  {cfError && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{cfError}</Typography>
                    </Paper>
                  )}
                  {cfData && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>
                            {cfData.totalDistributions}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Total Distributions</Typography>
                        </Box>
                      </Paper>
                      {cfData.distributions.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No CloudFront distributions found.</Typography>
                      ) : (
                        cfData.distributions.map(dist => (
                          <Paper key={dist.id} elevation={1} style={{ padding: 16, marginBottom: 12 }}>
                            <Box display="flex" alignItems="center" style={{ gap: 8 }} mb={1}>
                              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>{dist.id}</Typography>
                              <Chip
                                label={dist.status}
                                size="small"
                                style={{
                                  fontSize: 10, height: 20, fontWeight: 600,
                                  color: dist.status === 'Deployed' ? '#2e7d32' : '#ed6c02',
                                  backgroundColor: dist.status === 'Deployed' ? '#e8f5e9' : '#fff3e0',
                                }}
                              />
                              <Chip label={dist.enabled ? 'Enabled' : 'Disabled'} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                              <Chip label={dist.priceClass} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                            </Box>
                            <Box display="flex" flexWrap="wrap" style={{ gap: 24 }}>
                              <Box>
                                <Typography variant="caption" color="textSecondary">Domain</Typography>
                                <Typography variant="body2" style={{ fontWeight: 500 }}>{dist.domainName}</Typography>
                              </Box>
                              {dist.aliases.length > 0 && (
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Aliases</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{dist.aliases.join(', ')}</Typography>
                                </Box>
                              )}
                              {dist.origins.length > 0 && (
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Origins</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{dist.origins.join(', ')}</Typography>
                                </Box>
                              )}
                            </Box>
                          </Paper>
                        ))
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── OpenSearch section ── */}
              {activeSection === 'opensearch' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      OpenSearch Domains ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh OpenSearch">
                      <IconButton size="small" onClick={() => loadOpenSearch(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {osLoading && (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>
                  )}
                  {osError && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{osError}</Typography>
                    </Paper>
                  )}
                  {osData && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>
                            {osData.totalDomains}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Total Domains</Typography>
                        </Box>
                      </Paper>
                      {osData.domains.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No OpenSearch domains found.</Typography>
                      ) : (
                        osData.domains.map(d => {
                          const logKey = `${activeConfig.id}:${d.domainName}`;
                          const enabledLogTypes = Object.entries(d.logPublishingOptions ?? {})
                            .filter(([, opt]) => opt.enabled && opt.cloudWatchLogsLogGroupArn)
                            .map(([t]) => t);
                          const selectedLogType = osLogsType[logKey] ?? enabledLogTypes[0] ?? '';
                          const isOpen = osLogsExpanded[logKey] ?? false;

                          const handleToggle = () => {
                            const opening = !isOpen;
                            setOsLogsExpanded(prev => ({ ...prev, [logKey]: opening }));
                            // Auto-fetch on first open if logs not yet loaded
                            if (opening && enabledLogTypes.length > 0 && !osLogsData[logKey]) {
                              const type = osLogsType[logKey] ?? enabledLogTypes[0];
                              const arn = d.logPublishingOptions[type]?.cloudWatchLogsLogGroupArn;
                              if (arn) loadOsLogs(activeConfig.id, d.domainName, arn);
                            }
                          };

                          const handleLogTypeChange = (newType: string) => {
                            setOsLogsType(prev => ({ ...prev, [logKey]: newType }));
                            const arn = d.logPublishingOptions[newType]?.cloudWatchLogsLogGroupArn;
                            if (arn) loadOsLogs(activeConfig.id, d.domainName, arn);
                          };

                          return (
                            <Paper key={d.domainName} elevation={1} style={{ marginBottom: 12, overflow: 'hidden' }}>
                              {/* Accordion header — click to expand */}
                              <Box
                                display="flex"
                                alignItems="center"
                                style={{
                                  gap: 8,
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  background: isOpen ? '#f5f8ff' : 'transparent',
                                  transition: 'background 0.2s',
                                }}
                                onClick={handleToggle}
                              >
                                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>{d.domainName}</Typography>
                                <Chip
                                  label={d.processing ? 'Processing' : d.deleted ? 'Deleted' : 'Active'}
                                  size="small"
                                  style={{
                                    fontSize: 10, height: 20, fontWeight: 600,
                                    color: d.deleted ? '#c62828' : d.processing ? '#ed6c02' : '#2e7d32',
                                    backgroundColor: d.deleted ? '#ffebee' : d.processing ? '#fff3e0' : '#e8f5e9',
                                  }}
                                />
                                <Chip label={d.engineVersion} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                                <Box ml="auto" display="flex" alignItems="center" style={{ gap: 6 }}>
                                  {enabledLogTypes.length > 0 && (
                                    <Typography variant="caption" color="textSecondary" style={{ fontSize: 11 }}>
                                      {isOpen ? 'Hide Logs' : 'View Logs'}
                                    </Typography>
                                  )}
                                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </Box>
                              </Box>

                              {/* Domain details — always visible */}
                              <Box display="flex" flexWrap="wrap" style={{ gap: 24, padding: '0 16px 12px' }}>
                                {d.endpoint && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">Endpoint</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>{d.endpoint}</Typography>
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Instance</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{d.instanceType} x{d.instanceCount}</Typography>
                                </Box>
                                {d.ebsVolumeSize && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">Storage</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>{d.ebsVolumeSize} GB ({d.storageType})</Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* Logs panel — accordion body */}
                              {isOpen && (
                                <Box style={{ borderTop: '1px solid #e0e0e0' }}>
                                  {enabledLogTypes.length === 0 ? (
                                    <Box p={2}>
                                      <Typography variant="caption" color="textSecondary">
                                        No log publishing configured for this domain.
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Box p={2}>
                                      {/* Log type tabs */}
                                      <Box display="flex" alignItems="center" style={{ gap: 8 }} mb={2}>
                                        {enabledLogTypes.map(t => (
                                          <Chip
                                            key={t}
                                            label={OS_LOG_TYPE_LABELS[t] ?? t}
                                            size="small"
                                            clickable
                                            onClick={e => { e.stopPropagation(); handleLogTypeChange(t); }}
                                            style={{
                                              fontSize: 11,
                                              fontWeight: selectedLogType === t ? 700 : 400,
                                              background: selectedLogType === t ? '#1976d2' : '#f0f0f0',
                                              color: selectedLogType === t ? '#fff' : '#333',
                                            }}
                                          />
                                        ))}
                                        <Box ml="auto">
                                          <IconButton
                                            size="small"
                                            title="Refresh logs"
                                            disabled={osLogsLoading[logKey]}
                                            onClick={e => {
                                              e.stopPropagation();
                                              const arn = d.logPublishingOptions[selectedLogType]?.cloudWatchLogsLogGroupArn;
                                              if (arn) loadOsLogs(activeConfig.id, d.domainName, arn);
                                            }}
                                          >
                                            <RefreshIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Box>

                                      {osLogsLoading[logKey] && (
                                        <Box display="flex" justifyContent="center" p={3}>
                                          <CircularProgress size={24} />
                                        </Box>
                                      )}
                                      {osLogsError[logKey] && (
                                        <Typography color="error" variant="caption">{osLogsError[logKey]}</Typography>
                                      )}
                                      {osLogsData[logKey] && osLogsData[logKey].length === 0 && !osLogsLoading[logKey] && !osLogsError[logKey] && (
                                        <Typography variant="caption" color="textSecondary">No log events found.</Typography>
                                      )}
                                      {osLogsData[logKey] && osLogsData[logKey].length > 0 && (
                                        <Box
                                          component="pre"
                                          style={{
                                            background: '#1e1e1e',
                                            color: '#d4d4d4',
                                            padding: 12,
                                            borderRadius: 4,
                                            fontSize: 11,
                                            overflowX: 'auto',
                                            maxHeight: 420,
                                            overflowY: 'auto',
                                            fontFamily: 'monospace',
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                          }}
                                        >
                                          {osLogsData[logKey].map((ev, i) => (
                                            <Box key={i} mb={0.5}>
                                              <span style={{ color: '#569cd6' }}>
                                                [{new Date(ev.timestamp).toISOString()}]
                                              </span>
                                              {' '}
                                              <span style={{ color: '#9cdcfe', fontSize: 10 }}>({ev.logStream})</span>
                                              {'\n'}
                                              {ev.message}
                                            </Box>
                                          ))}
                                        </Box>
                                      )}
                                    </Box>
                                  )}
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

              {/* ── CodeBuild section ── */}
              {activeSection === 'codebuild' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      CodeBuild Projects ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh CodeBuild">
                      <IconButton size="small" onClick={() => loadCodeBuild(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {cbLoading && <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>}
                  {cbError && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{cbError}</Typography>
                    </Paper>
                  )}
                  {cbData && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>{cbData.totalProjects}</Typography>
                          <Typography variant="caption" color="textSecondary">Total Projects</Typography>
                        </Box>
                      </Paper>
                      {cbData.projects.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No CodeBuild projects found.</Typography>
                      ) : (
                        cbData.projects.map(proj => {
                          const isOpen = cbExpanded[proj.name] ?? false;
                          const builds = cbBuilds[proj.name] ?? [];
                          const handleToggle = () => {
                            const opening = !isOpen;
                            setCbExpanded(prev => ({ ...prev, [proj.name]: opening }));
                            if (opening && !cbBuilds[proj.name]) {
                              loadCbBuilds(activeConfig.id, proj.name);
                            }
                          };
                          const lastBuildStyle = proj.lastBuild ? buildStatusStyle(proj.lastBuild.status) : { color: '#616161', bg: '#f5f5f5' };
                          return (
                            <Paper key={proj.name} elevation={1} style={{ marginBottom: 12, overflow: 'hidden' }}>
                              {/* Accordion header */}
                              <Box
                                display="flex" alignItems="center" style={{ gap: 8, padding: '12px 16px', cursor: 'pointer', userSelect: 'none', background: isOpen ? '#f5f8ff' : 'transparent', transition: 'background 0.2s' }}
                                onClick={handleToggle}
                              >
                                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>{proj.name}</Typography>
                                <Chip label={proj.sourceType} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                                {proj.lastBuild && (
                                  <Chip
                                    label={proj.lastBuild.status}
                                    size="small"
                                    style={{ fontSize: 10, height: 20, fontWeight: 600, color: lastBuildStyle.color, backgroundColor: lastBuildStyle.bg }}
                                  />
                                )}
                                <Box ml="auto" display="flex" alignItems="center" style={{ gap: 6 }}>
                                  <Typography variant="caption" color="textSecondary" style={{ fontSize: 11 }}>
                                    {isOpen ? 'Hide Builds' : 'Build History'}
                                  </Typography>
                                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </Box>
                              </Box>

                              {/* Project details */}
                              <Box display="flex" flexWrap="wrap" style={{ gap: 24, padding: '0 16px 12px' }}>
                                {proj.sourceLocation && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">Source</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500, wordBreak: 'break-all' }}>{proj.sourceLocation}</Typography>
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="caption" color="textSecondary">Environment</Typography>
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>{proj.environmentImage}</Typography>
                                </Box>
                                {proj.lastBuild?.startTime && (
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">Last Build</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                      {new Date(proj.lastBuild.startTime).toLocaleString()}
                                      {proj.lastBuild.initiator ? ` · ${proj.lastBuild.initiator}` : ''}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* Build history accordion body */}
                              {isOpen && (
                                <Box style={{ borderTop: '1px solid #e0e0e0' }}>
                                  <Box p={2}>
                                    <Box display="flex" alignItems="center" mb={1} style={{ gap: 8 }}>
                                      <Typography variant="caption" style={{ fontWeight: 600 }}>Recent Builds</Typography>
                                      <Box ml="auto">
                                        <IconButton size="small" disabled={cbBuildsLoading[proj.name]} onClick={e => { e.stopPropagation(); loadCbBuilds(activeConfig.id, proj.name); }}>
                                          <RefreshIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    </Box>
                                    {cbBuildsLoading[proj.name] && <Box display="flex" justifyContent="center" p={2}><CircularProgress size={22} /></Box>}
                                    {cbBuildsError[proj.name] && <Typography color="error" variant="caption">{cbBuildsError[proj.name]}</Typography>}
                                    {builds.length === 0 && !cbBuildsLoading[proj.name] && !cbBuildsError[proj.name] && (
                                      <Typography variant="caption" color="textSecondary">No builds found.</Typography>
                                    )}
                                    {builds.map(b => {
                                      const s = buildStatusStyle(b.status);
                                      return (
                                        <Box key={b.id} display="flex" alignItems="center" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                          <Chip label={b.status} size="small" style={{ fontSize: 10, height: 18, fontWeight: 600, color: s.color, backgroundColor: s.bg, minWidth: 90 }} />
                                          <Box flex={1}>
                                            <Typography variant="caption" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                              #{b.buildNumber ?? '—'} · {b.resolvedSourceVersion?.slice(0, 8) ?? b.sourceVersion ?? '—'}
                                            </Typography>
                                            {b.initiator && <Typography variant="caption" color="textSecondary" style={{ marginLeft: 8 }}>by {b.initiator}</Typography>}
                                          </Box>
                                          <Typography variant="caption" color="textSecondary" style={{ whiteSpace: 'nowrap' }}>
                                            {b.startTime ? new Date(b.startTime).toLocaleString() : '—'}
                                          </Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
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

              {/* ── CodePipeline section ── */}
              {activeSection === 'codepipeline' && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      CodePipeline ({activeConfig.aws_region})
                    </Typography>
                    <Tooltip title="Refresh CodePipeline">
                      <IconButton size="small" onClick={() => loadCodePipeline(activeConfig.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {cpLoading && <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} /></Box>}
                  {cpError && (
                    <Paper elevation={0} style={{ padding: 16, background: '#fff3f3', border: '1px solid #f5c6cb', marginBottom: 16 }}>
                      <Typography color="error" variant="body2">{cpError}</Typography>
                    </Paper>
                  )}
                  {cpData && (
                    <>
                      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                        <Box textAlign="center">
                          <Typography variant="h4" style={{ fontWeight: 700, color: '#1976d2' }}>{cpData.totalPipelines}</Typography>
                          <Typography variant="caption" color="textSecondary">Total Pipelines</Typography>
                        </Box>
                      </Paper>
                      {cpData.pipelines.length === 0 ? (
                        <Typography color="textSecondary" variant="body2">No pipelines found.</Typography>
                      ) : (
                        cpData.pipelines.map(pipe => {
                          const execStyle = pipe.latestExecution ? pipelineStatusStyle(pipe.latestExecution.status) : { color: '#616161', bg: '#f5f5f5' };
                          return (
                            <Paper key={pipe.name} elevation={1} style={{ padding: 16, marginBottom: 16 }}>
                              {/* Pipeline header */}
                              <Box display="flex" alignItems="center" style={{ gap: 8 }} mb={2}>
                                <Typography variant="subtitle1" style={{ fontWeight: 700 }}>{pipe.name}</Typography>
                                <Chip label={`v${pipe.version}`} size="small" variant="outlined" style={{ fontSize: 10, height: 20 }} />
                                {pipe.latestExecution && (
                                  <Chip
                                    label={pipe.latestExecution.status}
                                    size="small"
                                    style={{ fontSize: 10, height: 20, fontWeight: 600, color: execStyle.color, backgroundColor: execStyle.bg }}
                                  />
                                )}
                                {pipe.latestExecution?.lastUpdateTime && (
                                  <Typography variant="caption" color="textSecondary" style={{ marginLeft: 'auto' }}>
                                    {pipe.latestExecution.trigger && `${pipe.latestExecution.trigger} · `}
                                    {new Date(pipe.latestExecution.lastUpdateTime).toLocaleString()}
                                  </Typography>
                                )}
                              </Box>

                              {/* Stage flow */}
                              <Box display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 0 }}>
                                {pipe.stages.map((stage, si) => {
                                  const ss = pipelineStatusStyle(stage.status);
                                  return (
                                    <React.Fragment key={stage.name}>
                                      {si > 0 && (
                                        <Box style={{ width: 20, height: 2, background: '#bdbdbd', flexShrink: 0 }} />
                                      )}
                                      <Tooltip
                                        title={
                                          <Box>
                                            {stage.actions.map(a => (
                                              <Box key={a.name} mb={0.5}>
                                                <Typography variant="caption" style={{ fontWeight: 600 }}>{a.name}</Typography>
                                                {' — '}
                                                <Typography variant="caption">{a.status}</Typography>
                                                {a.errorDetails && <Typography variant="caption" style={{ color: '#ff8a80', display: 'block' }}>{a.errorDetails}</Typography>}
                                              </Box>
                                            ))}
                                            {stage.lastChangedAt && (
                                              <Typography variant="caption" color="inherit" style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
                                                {new Date(stage.lastChangedAt).toLocaleString()}
                                              </Typography>
                                            )}
                                          </Box>
                                        }
                                      >
                                        <Box
                                          style={{
                                            padding: '8px 14px',
                                            borderRadius: 6,
                                            border: `1px solid ${ss.color}`,
                                            background: ss.bg,
                                            cursor: 'default',
                                            minWidth: 90,
                                            textAlign: 'center',
                                          }}
                                        >
                                          <Typography variant="caption" style={{ fontWeight: 700, color: ss.color, display: 'block', fontSize: 11 }}>
                                            {stage.name}
                                          </Typography>
                                          <Typography variant="caption" style={{ color: ss.color, fontSize: 10 }}>
                                            {stage.status}
                                          </Typography>
                                        </Box>
                                      </Tooltip>
                                    </React.Fragment>
                                  );
                                })}
                              </Box>
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
