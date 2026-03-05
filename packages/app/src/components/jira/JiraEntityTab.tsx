import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useEntity} from '@backstage/plugin-catalog-react';
import {InfoCard, Progress, WarningPanel} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {stringifyEntityRef} from '@backstage/catalog-model';
import {EntityJiraOverviewCard} from '@roadiehq/backstage-plugin-jira';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Link,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
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

type JiraConfig = {
  id: number;
  entity_ref: string;
  config_name: string;
  jira_url: string;
  project_key: string;
  component_name: string;
  labels: string;
  jira_token: string; // masked on GET
  data_scope: string; // 'current_sprint' | 'all'
};

type FormState = {
  configName: string;
  jiraUrl: string;
  projectKey: string;
  componentName: string;
  labels: string;
  dataScope: string;
  jiraEmail: string;
  jiraApiToken: string;
};

type JiraIssue = {
  key: string;
  fields: {
    summary: string;
    status: {name: string};
    assignee: {
      displayName: string;
      avatarUrls?: Record<string, string>;
    } | null;
    priority: {name: string; iconUrl?: string} | null;
    issuetype: {name: string; iconUrl?: string};
    created: string;
    updated: string;
  };
};

type IssueTypeCount = {
  name: string;
  iconUrl?: string;
  count: number;
};

const emptyForm = (): FormState => ({
  configName: '',
  jiraUrl: 'https://sourcefuse.atlassian.net',
  projectKey: '',
  componentName: '',
  labels: '',
  dataScope: 'current_sprint',
  jiraEmail: '',
  jiraApiToken: '',
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
  statusChip: {
    fontWeight: 600,
    fontSize: '0.7rem',
    height: 22,
  },
  issueKey: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  statsContainer: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap' as const,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: theme.spacing(2, 3),
    borderRadius: 8,
    minWidth: 120,
    flex: '1 1 0',
  },
  statCount: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    marginTop: 4,
  },
  projectHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  projectAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  statusBar: {
    display: 'flex',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
  },
  // ── Issue type grid ──
  issueTypeGrid: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap' as const,
  },
  issueTypeItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: theme.spacing(1.5, 2),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    minWidth: 80,
  },
  // ── Status filter chips ──
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap' as const,
  },
  // ── Activity stream ──
  activityContainer: {
    maxHeight: 290,
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    backgroundColor:
      theme.palette.type === 'dark'
        ? theme.palette.background.default
        : theme.palette.grey[50],
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityTime: {
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// ─── Issue type grid ────────────────────────────────────────────────────────

function IssueTypeGrid({
  issueTypeCounts,
  loading,
}: {
  issueTypeCounts: IssueTypeCount[];
  loading?: boolean;
}) {
  const classes = useStyles();
  if (loading) {
    return (
      <Box className={classes.issueTypeGrid} justifyContent="center" p={1}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (issueTypeCounts.length === 0) return null;

  return (
    <Box className={classes.issueTypeGrid}>
      {issueTypeCounts.map(({name, iconUrl, count}) => (
        <Box key={name} className={classes.issueTypeItem}>
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              width={24}
              height={24}
              style={{marginBottom: 4}}
            />
          )}
          <Typography variant="caption" color="textSecondary">
            {name}
          </Typography>
          <Typography variant="h6" style={{lineHeight: 1.2}}>
            {count}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Issues table ────────────────────────────────────────────────────────────

function IssuesTable({
  issues,
  jiraUrl,
}: {
  issues: JiraIssue[];
  jiraUrl: string;
}) {
  const classes = useStyles();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when issues change (e.g. from filter)
  useEffect(() => {
    setPage(0);
  }, [issues.length]);

  if (issues.length === 0) {
    return (
      <Typography color="textSecondary" style={{padding: 16}}>
        No Jira tickets available.
      </Typography>
    );
  }

  const paged = issues.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Summary</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell>Assignee</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.map(issue => (
            <TableRow key={issue.key}>
              <TableCell>
                <Link
                  href={`${jiraUrl}/browse/${issue.key}`}
                  target="_blank"
                  rel="noopener"
                  className={classes.issueKey}
                >
                  {issue.key}
                </Link>
              </TableCell>
              <TableCell>{issue.fields.summary}</TableCell>
              <TableCell>
                {issue.fields.priority?.iconUrl ? (
                  <Tooltip title={issue.fields.priority.name}>
                    <img
                      src={issue.fields.priority.iconUrl}
                      alt={issue.fields.priority.name}
                      width={16}
                      height={16}
                    />
                  </Tooltip>
                ) : (
                  <Typography variant="body2">
                    {issue.fields.priority?.name ?? '--'}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{issue.fields.status?.name}</TableCell>
              <TableCell>{formatDate(issue.fields.created)}</TableCell>
              <TableCell>{formatDate(issue.fields.updated)}</TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" style={{gap: 6}}>
                  {issue.fields.assignee?.avatarUrls?.['16x16'] && (
                    <img
                      src={issue.fields.assignee.avatarUrls['16x16']}
                      alt=""
                      width={16}
                      height={16}
                      style={{borderRadius: '50%'}}
                    />
                  )}
                  {issue.fields.assignee ? (
                    <Typography variant="body2">
                      {issue.fields.assignee.displayName}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      Unassigned
                    </Typography>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={issues.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onChangeRowsPerPage={e => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </>
  );
}

// ─── Activity stream ─────────────────────────────────────────────────────────

function ActivityStream({
  issues,
  jiraUrl,
}: {
  issues: JiraIssue[];
  jiraUrl: string;
}) {
  const classes = useStyles();

  const sorted = useMemo(
    () =>
      [...issues]
        .sort(
          (a, b) =>
            new Date(b.fields.updated).getTime() -
            new Date(a.fields.updated).getTime(),
        )
        .slice(0, 25),
    [issues],
  );

  if (sorted.length === 0) return null;

  return (
    <Box mt={3}>
      <Typography variant="subtitle1" gutterBottom>
        Activity Stream
      </Typography>
      <Box className={classes.activityContainer}>
        {sorted.map(issue => (
          <Box key={`${issue.key}-activity`} className={classes.activityItem}>
            {issue.fields.issuetype?.iconUrl && (
              <Tooltip title={issue.fields.issuetype.name}>
                <img
                  src={issue.fields.issuetype.iconUrl}
                  alt=""
                  width={16}
                  height={16}
                  style={{marginTop: 2, flexShrink: 0}}
                />
              </Tooltip>
            )}
            <Box className={classes.activityContent}>
              <Box display="flex" alignItems="center" style={{gap: 6}}>
                <Link
                  href={`${jiraUrl}/browse/${issue.key}`}
                  target="_blank"
                  rel="noopener"
                  style={{fontWeight: 600, fontSize: '0.85rem'}}
                >
                  {issue.key}
                </Link>
                <Typography
                  variant="body2"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {issue.fields.summary}
                </Typography>
              </Box>
              <Box
                display="flex"
                alignItems="center"
                style={{gap: 6, marginTop: 2}}
              >
                <Chip
                  label={issue.fields.status?.name}
                  size="small"
                  style={{height: 18, fontSize: '0.7rem'}}
                />
                <Typography variant="caption" color="textSecondary">
                  {issue.fields.assignee?.displayName ?? 'Unassigned'}
                </Typography>
              </Box>
            </Box>
            <Tooltip
              title={new Date(issue.fields.updated).toLocaleString()}
            >
              <Typography
                variant="caption"
                color="textSecondary"
                className={classes.activityTime}
              >
                {timeAgo(issue.fields.updated)}
              </Typography>
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── Status colours ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, {bg: string; fg: string; bar: string}> = {
  total: {bg: '#e3f2fd', fg: '#1565c0', bar: '#1565c0'},
  'To Do': {bg: '#e8eaf6', fg: '#424242', bar: '#9e9e9e'},
  'In Progress': {bg: '#fff3e0', fg: '#e65100', bar: '#fb8c00'},
  Done: {bg: '#e8f5e9', fg: '#2e7d32', bar: '#43a047'},
};

// ─── Jira data viewer ────────────────────────────────────────────────────────

type ProjectInfo = {
  name: string;
  key: string;
  projectTypeKey?: string;
  lead?: {displayName: string};
  avatarUrls?: Record<string, string>;
};

type StatusCounts = {
  total: number | null;
  toDo: number | null;
  inProgress: number | null;
  done: number | null;
};

function JiraDataViewer({
  config,
  apiBase,
}: {
  config: JiraConfig;
  apiBase: string;
}) {
  const fetchApi = useApi(fetchApiRef);
  const classes = useStyles();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [counts, setCounts] = useState<StatusCounts>({
    total: null,
    toDo: null,
    inProgress: null,
    done: null,
  });
  const [issueTypeCounts, setIssueTypeCounts] = useState<IssueTypeCount[]>([]);
  const [issueTypeCountsLoading, setIssueTypeCountsLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const proxy = `${apiBase}/proxy/${config.id}`;

  // Build JQL with component/labels/sprint filters
  const buildJql = useCallback(() => {
    let jql = `project = "${config.project_key}"`;
    if (config.component_name) {
      jql += ` AND component = "${config.component_name}"`;
    }
    if (config.labels) {
      const labelList = config.labels
        .split(',')
        .map(l => `"${l.trim()}"`)
        .join(', ');
      jql += ` AND labels IN (${labelList})`;
    }
    if (config.data_scope === 'current_sprint') {
      jql += ' AND sprint in openSprints()';
    }
    return jql;
  }, [config.project_key, config.component_name, config.labels, config.data_scope]);

  // Helper: run a JQL search and return the total count
  // The new Jira search/jql API uses cursor-based pagination (no "total" field).
  const fetchCount = useCallback(
    async (baseJql: string, extraFilter?: string): Promise<number> => {
      const jql = extraFilter ? `${baseJql} AND ${extraFilter}` : baseJql;
      let count = 0;
      let nextPageToken: string | undefined;
      for (;;) {
        const qs = new URLSearchParams({
          jql,
          maxResults: '100',
          fields: 'id',
        });
        if (nextPageToken) qs.set('nextPageToken', nextPageToken);
        const resp = await fetchApi.fetch(
          `${proxy}/rest/api/3/search/jql?${qs.toString()}`,
        );
        if (!resp.ok) return count;
        const data = await resp.json();
        count += (data.issues ?? []).length;
        if (data.isLast || !data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
      }
      return count;
    },
    [proxy, fetchApi],
  );

  // Fetch total count AND accumulate issue type counts in one pass
  const fetchTotalWithTypes = useCallback(
    async (
      baseJql: string,
    ): Promise<{total: number; typeCounts: IssueTypeCount[]}> => {
      const typeMap = new Map<string, {iconUrl?: string; count: number}>();
      let total = 0;
      let nextPageToken: string | undefined;
      for (;;) {
        const qs = new URLSearchParams({
          jql: baseJql,
          maxResults: '100',
          fields: 'issuetype',
        });
        if (nextPageToken) qs.set('nextPageToken', nextPageToken);
        const resp = await fetchApi.fetch(
          `${proxy}/rest/api/3/search/jql?${qs.toString()}`,
        );
        if (!resp.ok) break;
        const data = await resp.json();
        const issues = data.issues ?? [];
        total += issues.length;
        for (const issue of issues) {
          const name = issue.fields?.issuetype?.name ?? 'Unknown';
          const existing = typeMap.get(name);
          if (existing) {
            existing.count++;
          } else {
            typeMap.set(name, {
              iconUrl: issue.fields?.issuetype?.iconUrl,
              count: 1,
            });
          }
        }
        if (data.isLast || !data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
      }
      const typeCounts: IssueTypeCount[] = [];
      typeMap.forEach((val, name) => typeCounts.push({name, ...val}));
      return {total, typeCounts};
    },
    [proxy, fetchApi],
  );

  const load = useCallback(() => {
    setProjectLoading(true);
    setIssuesLoading(true);
    setError(null);
    setCounts({total: null, toDo: null, inProgress: null, done: null});
    setIssueTypeCounts([]);
    setIssueTypeCountsLoading(true);

    const baseJql = buildJql();

    // Load project info (fast, single API call)
    (async () => {
      try {
        const resp = await fetchApi.fetch(
          `${proxy}/rest/api/3/project/${encodeURIComponent(config.project_key)}`,
        );
        if (resp.ok) {
          setProject(await resp.json());
        } else {
          setProject({name: config.project_key, key: config.project_key});
        }
      } catch {
        setProject({name: config.project_key, key: config.project_key});
      } finally {
        setProjectLoading(false);
      }
    })();

    // Load issues list (fast, single page fetch)
    (async () => {
      try {
        const resp = await fetchApi.fetch(
          `${proxy}/rest/api/3/search/jql?jql=${encodeURIComponent(baseJql + ' ORDER BY created DESC')}&maxResults=100&fields=summary,status,assignee,priority,issuetype,created,updated`,
        );
        if (resp.ok) {
          const data = await resp.json();
          setIssues(data.issues ?? []);
        } else {
          const body = await resp.json().catch(() => ({}));
          setError(
            body.errorMessages?.[0] ??
              body.error ??
              `Jira returned HTTP ${resp.status}`,
          );
        }
      } catch (e: any) {
        setError(e.message ?? 'Failed to fetch Jira issues');
      } finally {
        setIssuesLoading(false);
      }
    })();

    // Load counts progressively (slow, paginates through all issues)
    (async () => {
      try {
        const totalP = fetchTotalWithTypes(baseJql).then(({total, typeCounts}) => {
          setCounts(prev => ({...prev, total}));
          setIssueTypeCounts(typeCounts);
          setIssueTypeCountsLoading(false);
          return total;
        });
        const toDoP = fetchCount(baseJql, 'statusCategory = "To Do"').then(
          v => {
            setCounts(prev => ({...prev, toDo: v}));
            return v;
          },
        );
        const inProgressP = fetchCount(
          baseJql,
          'statusCategory = "In Progress"',
        ).then(v => {
          setCounts(prev => ({...prev, inProgress: v}));
          return v;
        });
        const [total, toDo, inProgress] = await Promise.all([
          totalP,
          toDoP,
          inProgressP,
        ]);
        setCounts(prev => ({
          ...prev,
          done: Math.max(0, total - toDo - inProgress),
        }));
      } catch {
        setIssueTypeCountsLoading(false);
        // Counts failed — stat cards stay as spinners or partial
      }
    })();
  }, [
    config.id,
    config.project_key,
    proxy,
    apiBase,
    fetchApi,
    fetchCount,
    fetchTotalWithTypes,
    buildJql,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // Derive available statuses for filter
  const allStatuses = useMemo(
    () => [
      ...new Set(
        issues.map(i => i.fields.status?.name).filter(Boolean) as string[],
      ),
    ],
    [issues],
  );

  // Filter issues by selected statuses
  const filteredIssues = useMemo(
    () =>
      statusFilter.length > 0
        ? issues.filter(i => statusFilter.includes(i.fields.status?.name))
        : issues,
    [issues, statusFilter],
  );

  const toggleStatus = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status],
    );
  };

  if (projectLoading && issuesLoading) return <Progress />;

  const avatarUrl =
    project?.avatarUrls?.['48x48'] ?? project?.avatarUrls?.['32x32'];

  return (
    <Box>
      {error && (
        <Box mb={2}>
          <WarningPanel title="Jira Error" message={error} />
        </Box>
      )}
      {/* ── Project header ─────────────────────────────────────── */}
      <Box className={classes.projectHeader}>
        {avatarUrl && (
          <img src={avatarUrl} alt="" className={classes.projectAvatar} />
        )}
        <Box>
          <Typography variant="h6" style={{lineHeight: 1.3}}>
            {project?.name ?? config.project_key}
            <Typography
              component="span"
              variant="body2"
              color="textSecondary"
              style={{marginLeft: 8}}
            >
              {config.project_key}
            </Typography>
          </Typography>
          {project?.lead && (
            <Typography variant="caption" color="textSecondary">
              Lead: {project.lead.displayName}
            </Typography>
          )}
        </Box>
        <Box flex={1} />
        <Link
          href={`${config.jira_url}/browse/${config.project_key}`}
          target="_blank"
          rel="noopener"
        >
          <Tooltip title="Open in Jira">
            <IconButton size="small">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Link>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Status bar ─────────────────────────────────────────── */}
      {counts.done !== null && counts.total !== null && counts.total > 0 && (
        <Box className={classes.statusBar}>
          {counts.done > 0 && (
            <Box
              style={{
                flex: counts.done,
                backgroundColor: STATUS_COLORS.Done.bar,
              }}
            />
          )}
          {(counts.inProgress ?? 0) > 0 && (
            <Box
              style={{
                flex: counts.inProgress ?? 0,
                backgroundColor: STATUS_COLORS['In Progress'].bar,
              }}
            />
          )}
          {(counts.toDo ?? 0) > 0 && (
            <Box
              style={{
                flex: counts.toDo ?? 0,
                backgroundColor: STATUS_COLORS['To Do'].bar,
              }}
            />
          )}
        </Box>
      )}

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <Box className={classes.statsContainer}>
        {(
          [
            ['Total', counts.total, STATUS_COLORS.total],
            ['To Do', counts.toDo, STATUS_COLORS['To Do']],
            ['In Progress', counts.inProgress, STATUS_COLORS['In Progress']],
            ['Done', counts.done, STATUS_COLORS.Done],
          ] as [string, number | null, {bg: string; fg: string}][]
        ).map(([label, count, colors]) => (
          <Box
            key={label}
            className={classes.statCard}
            style={{backgroundColor: colors.bg}}
          >
            {count === null ? (
              <CircularProgress size={24} style={{color: colors.fg}} />
            ) : (
              <Typography
                className={classes.statCount}
                style={{color: colors.fg}}
              >
                {count}
              </Typography>
            )}
            <Typography
              className={classes.statLabel}
              style={{color: colors.fg}}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Issue type grid ────────────────────────────────────── */}
      <IssueTypeGrid issueTypeCounts={issueTypeCounts} loading={issueTypeCountsLoading} />

      {/* ── Status filter ──────────────────────────────────────── */}
      {allStatuses.length > 1 && (
        <Box className={classes.filterBar}>
          <Typography variant="caption" color="textSecondary">
            Filter:
          </Typography>
          {allStatuses.map(status => (
            <Chip
              key={status}
              label={status}
              size="small"
              onClick={() => toggleStatus(status)}
              color={statusFilter.includes(status) ? 'primary' : 'default'}
              variant={statusFilter.includes(status) ? 'default' : 'outlined'}
              style={{cursor: 'pointer'}}
            />
          ))}
          {statusFilter.length > 0 && (
            <Chip
              label="Clear"
              size="small"
              variant="outlined"
              onClick={() => setStatusFilter([])}
              onDelete={() => setStatusFilter([])}
              style={{cursor: 'pointer'}}
            />
          )}
        </Box>
      )}

      {/* ── Issues table ───────────────────────────────────────── */}
      <Typography variant="subtitle2" gutterBottom>
        Issues
      </Typography>
      {issuesLoading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <IssuesTable issues={filteredIssues} jiraUrl={config.jira_url} />
      )}

      {/* ── Activity stream ────────────────────────────────────── */}
      <ActivityStream issues={issues} jiraUrl={config.jira_url} />
    </Box>
  );
}

// ─── Config form ─────────────────────────────────────────────────────────────

function ConfigForm({
  initial,
  saving,
  isEdit,
  onSave,
  onCancel,
}: {
  initial: FormState;
  saving: boolean;
  isEdit?: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({...prev, [k]: e.target.value}));

  return (
    <Grid container spacing={2} direction="column">
      <Grid item xs={12} md={8}>
        <TextField
          label="Config Name"
          placeholder="e.g. Sprint Board, Backlog"
          value={form.configName}
          onChange={set('configName')}
          fullWidth
          variant="outlined"
          helperText="A label for this Jira configuration (shown as a tab)"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Jira URL"
          placeholder="https://yourcompany.atlassian.net"
          value={form.jiraUrl}
          onChange={set('jiraUrl')}
          fullWidth
          variant="outlined"
          required
          helperText="The base URL of your Jira instance"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Jira Email"
          placeholder="you@company.com"
          value={form.jiraEmail}
          onChange={set('jiraEmail')}
          fullWidth
          variant="outlined"
          helperText={
            isEdit
              ? 'Leave both email and API token blank to keep existing credentials'
              : 'The email address associated with the Jira API token'
          }
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Jira API Token"
          placeholder="Your Jira API token"
          value={form.jiraApiToken}
          onChange={set('jiraApiToken')}
          fullWidth
          variant="outlined"
          type="password"
          helperText={
            isEdit
              ? 'Leave both email and API token blank to keep existing credentials'
              : 'API token from https://id.atlassian.net/manage-profile/security/api-tokens'
          }
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Project Key"
          placeholder="e.g. BB, PROJ"
          value={form.projectKey}
          onChange={set('projectKey')}
          fullWidth
          variant="outlined"
          required
          helperText="The Jira project key"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Component (optional)"
          placeholder="e.g. Backend, Frontend"
          value={form.componentName}
          onChange={set('componentName')}
          fullWidth
          variant="outlined"
          helperText="Filter issues by Jira component"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          label="Labels (optional)"
          placeholder="e.g. bug,sprint-1"
          value={form.labels}
          onChange={set('labels')}
          fullWidth
          variant="outlined"
          helperText="Comma-separated list of labels to filter issues"
        />
      </Grid>
      <Grid item xs={12} md={8}>
        <TextField
          select
          label="Data Scope"
          value={form.dataScope}
          onChange={set('dataScope')}
          fullWidth
          variant="outlined"
          helperText="Current Sprint shows only issues in active sprints; All Issues shows everything"
        >
          <MenuItem value="current_sprint">Current Sprint</MenuItem>
          <MenuItem value="all">All Issues</MenuItem>
        </TextField>
      </Grid>
      <Grid item>
        <Box display="flex" style={{gap: 8}}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.projectKey || !form.jiraUrl}
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

export function JiraEntityTab() {
  const {entity} = useEntity();
  const entityRef = stringifyEntityRef(entity);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const classes = useStyles();

  const [configs, setConfigs] = useState<JiraConfig[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiBase, setApiBase] = useState<string>('');

  type UIMode = 'view' | 'add' | {mode: 'edit'; config: JiraConfig};
  const [uiMode, setUiMode] = useState<UIMode>('view');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('jira-settings');
      setApiBase(base);
      const resp = await fetchApi.fetch(
        `${base}?entityRef=${encodeURIComponent(entityRef)}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: JiraConfig[] = await resp.json();
      setConfigs(data);
      setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load Jira settings');
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
      const base = await discoveryApi.getBaseUrl('jira-settings');
      const resp = await fetchApi.fetch(base, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          entityRef,
          configName: form.configName || 'Default',
          jiraUrl: form.jiraUrl,
          projectKey: form.projectKey,
          componentName: form.componentName,
          labels: form.labels,
          dataScope: form.dataScope,
          jiraEmail: form.jiraEmail,
          jiraApiToken: form.jiraApiToken,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const created: JiraConfig = await resp.json();
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
      const base = await discoveryApi.getBaseUrl('jira-settings');
      const resp = await fetchApi.fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          configName: form.configName || 'Default',
          jiraUrl: form.jiraUrl,
          projectKey: form.projectKey,
          componentName: form.componentName,
          labels: form.labels,
          dataScope: form.dataScope,
          jiraEmail: form.jiraEmail,
          jiraApiToken: form.jiraApiToken,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const updated: JiraConfig = await resp.json();
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
      const base = await discoveryApi.getBaseUrl('jira-settings');
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
        title="Add Jira Project"
        subheader="Configure a Jira project for this component"
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
        subheader="Update the Jira project settings"
      >
        {error && (
          <Box mb={2}>
            <WarningPanel title="Error" message={error} />
          </Box>
        )}
        <ConfigForm
          initial={{
            configName: c.config_name,
            jiraUrl: c.jira_url,
            projectKey: c.project_key,
            componentName: c.component_name,
            labels: c.labels,
            dataScope: c.data_scope || 'current_sprint',
            jiraEmail: '',
            jiraApiToken: '',
          }}
          saving={saving}
          isEdit
          onSave={form => handleUpdate(c.id, form)}
          onCancel={() => setUiMode('view')}
        />
      </InfoCard>
    );
  }

  // ── No DB configs → show original Roadie dashboard + Add button ──────────

  if (configs.length === 0) {
    return (
      <Box>
        <Box display="flex" justifyContent="flex-end" mb={1}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setUiMode('add')}
          >
            Add Jira Project
          </Button>
        </Box>
        <EntityJiraOverviewCard />
      </Box>
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
                  onClick={() =>
                    setUiMode({mode: 'edit', config: currentConfig})
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
                style={{margin: '4px 4px'}}
              />
            </>
          )}
          <Tooltip title="Add another Jira project">
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

      {/* Jira data */}
      {currentConfig && (
        <JiraDataViewer
          key={currentConfig.id}
          config={currentConfig}
          apiBase={apiBase}
        />
      )}
    </Box>
  );
}
