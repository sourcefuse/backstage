import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Chip,
  InputAdornment,
  makeStyles,
  createStyles,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CloseIcon from '@material-ui/icons/Close';
import GitHubIcon from '@material-ui/icons/GitHub';
import SyncIcon from '@material-ui/icons/Sync';
import RetryIcon from '@material-ui/icons/Replay';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { scmAuthApiRef } from '@backstage/integration-react';
import {
  GithubActionsClient,
  GITHUB_ACTIONS_ANNOTATION,
} from '@backstage-community/plugin-github-actions';
import {
  Table,
  Link,
  StatusPending,
  StatusRunning,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusAborted,
  EmptyState,
} from '@backstage/core-components';
import { ANNOTATION_SOURCE_LOCATION, ANNOTATION_LOCATION } from '@backstage/catalog-model';
// @ts-ignore - no type declarations available
import gitUrlParse from 'git-url-parse';

const useStyles = makeStyles(theme =>
  createStyles({
    searchBar: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
    resultCard: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      border: `2px solid ${theme.palette.primary.main}`,
      position: 'relative',
    },
    resultRow: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    },
    resultField: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 120,
    },
    closeBtn: {
      position: 'absolute',
      top: theme.spacing(0.5),
      right: theme.spacing(0.5),
    },
    errorText: {
      color: theme.palette.error.main,
      marginLeft: theme.spacing(1),
    },
  }),
);

type WorkflowRunRow = {
  id: string;
  message: string;
  source: { branchName?: string; commit: { hash: string } };
  workflowName?: string;
  status?: string;
  conclusion?: string;
  githubUrl?: string;
  onReRunClick: () => Promise<void>;
};

type WorkflowRunResult = {
  id: number;
  name: string;
  head_branch: string;
  head_commit: { id: string; message: string } | null;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
};

function WorkflowRunStatusIcon({ status, conclusion }: { status?: string; conclusion?: string }) {
  if (!status) return null;
  switch (status.toLocaleLowerCase('en-US')) {
    case 'queued':
      return <StatusPending />;
    case 'in_progress':
      return <StatusRunning />;
    case 'completed':
      switch (conclusion?.toLocaleLowerCase('en-US')) {
        case 'skipped':
        case 'cancelled':
          return <StatusAborted />;
        case 'timed_out':
          return <StatusWarning />;
        case 'failure':
          return <StatusError />;
        default:
          return <StatusOK />;
      }
    default:
      return <StatusPending />;
  }
}

function getStatusText(status?: string, conclusion?: string): string {
  if (!status) return '';
  switch (status.toLocaleLowerCase('en-US')) {
    case 'queued': return 'Queued';
    case 'in_progress': return 'In progress';
    case 'completed':
      switch (conclusion?.toLocaleLowerCase('en-US')) {
        case 'skipped':
        case 'cancelled': return 'Aborted';
        case 'timed_out': return 'Timed out';
        case 'failure': return 'Error';
        default: return 'Completed';
      }
    default: return 'Pending';
  }
}

const resultStatusColor = (conclusion: string | null): 'default' | 'primary' | 'secondary' => {
  if (conclusion === 'success') return 'primary';
  if (conclusion === 'failure') return 'secondary';
  return 'default';
};

const columns = [
  {
    title: 'ID',
    field: 'id',
    type: 'numeric' as const,
    width: '150px',
  },
  {
    title: 'Message',
    field: 'message',
    highlight: true,
    render: (row: WorkflowRunRow) =>
      row.githubUrl ? (
        <Link to={row.githubUrl} target="_blank" rel="noopener">
          {row.message}
        </Link>
      ) : (
        row.message
      ),
  },
  {
    title: 'Source',
    render: (row: WorkflowRunRow) => (
      <Typography variant="body2" noWrap>
        <Typography paragraph variant="body2">{row.source?.branchName}</Typography>
        <Typography paragraph variant="body2">{row.source?.commit.hash}</Typography>
      </Typography>
    ),
  },
  {
    title: 'Workflow',
    field: 'workflowName',
  },
  {
    title: 'Status',
    render: (row: WorkflowRunRow) => (
      <Box display="flex" alignItems="center">
        <WorkflowRunStatusIcon status={row.status} conclusion={row.conclusion} />
        <Typography variant="body2">{getStatusText(row.status, row.conclusion)}</Typography>
      </Box>
    ),
    customSort: (a: WorkflowRunRow, b: WorkflowRunRow) =>
      getStatusText(a.status, a.conclusion).localeCompare(getStatusText(b.status, b.conclusion)),
  },
  {
    title: 'Actions',
    render: (row: WorkflowRunRow) => (
      <IconButton onClick={row.onReRunClick} size="small" title="Rerun workflow">
        <RetryIcon />
      </IconButton>
    ),
    width: '10%',
  },
];

function getHostnameFromEntity(entity: any): string | undefined {
  const location =
    entity?.metadata?.annotations?.[ANNOTATION_SOURCE_LOCATION] ??
    entity?.metadata?.annotations?.[ANNOTATION_LOCATION];
  return location?.startsWith('url:') ? gitUrlParse(location.slice(4)).resource : undefined;
}

export const GithubActionsContent = () => {
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const scmAuthApi = useApi(scmAuthApiRef);
  const api = useMemo(
    () => new GithubActionsClient({ configApi, scmAuthApi }),
    [configApi, scmAuthApi],
  );
  const classes = useStyles();

  const projectSlug = entity.metadata.annotations?.[GITHUB_ACTIONS_ANNOTATION] ?? '';
  const [owner, repo] = projectSlug.split('/');
  const hostname = getHostnameFromEntity(entity);

  // --- Table state ---
  const [runs, setRuns] = useState<WorkflowRunRow[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);

  const loadRuns = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await api.listWorkflowRuns({
        hostname,
        owner,
        repo,
        pageSize,
        page: page + 1,
      });
      setTotalCount(data.total_count);
      setRuns(
        data.workflow_runs.map(run => ({
          id: `${run.id}`,
          message: run.head_commit?.message ?? '',
          source: {
            branchName: run.head_branch ?? undefined,
            commit: { hash: run.head_commit?.id ?? '' },
          },
          workflowName: run.name ?? undefined,
          status: run.status ?? undefined,
          conclusion: run.conclusion ?? undefined,
          githubUrl: run.html_url,
          onReRunClick: async () => {
            try {
              await api.reRunWorkflow({ hostname, owner, repo, runId: run.id });
            } catch (_e) {
              // ignore
            }
          },
        })),
      );
    } catch (_e) {
      setRuns([]);
    } finally {
      setTableLoading(false);
    }
  }, [api, hostname, owner, repo, page, pageSize]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // --- ID Search state ---
  const [searchId, setSearchId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<WorkflowRunResult | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = searchId.trim();
    if (!trimmed) return;

    const numericId = Number(trimmed);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setSearchError('Please enter a valid numeric workflow run ID');
      setSearchResult(null);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const run = await api.getWorkflowRun({ hostname, owner, repo, id: numericId });
      setSearchResult(run as unknown as WorkflowRunResult);
    } catch (e: any) {
      if (e?.message?.includes('404') || e?.response?.status === 404) {
        setSearchError(`Workflow run ${trimmed} not found in ${projectSlug}`);
      } else {
        setSearchError(`Failed to fetch run: ${e.message || e}`);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [searchId, api, hostname, owner, repo, projectSlug]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearResult = () => {
    setSearchResult(null);
    setSearchError(null);
    setSearchId('');
  };

  if (!projectSlug) {
    return <EmptyState missing="info" title="No GitHub Actions annotation" description={`Add the "${GITHUB_ACTIONS_ANNOTATION}" annotation to this entity to enable GitHub Actions.`} />;
  }

  return (
    <>
      {/* ID Search Bar */}
      <Paper className={classes.searchBar} variant="outlined">
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search by Workflow Run ID (e.g. 21518012483)"
          value={searchId}
          onChange={e => setSearchId(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={searchLoading}
          style={{ width: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSearch}
          disabled={searchLoading || !searchId.trim()}
          size="small"
        >
          <SearchIcon />
        </IconButton>
        {searchError && (
          <Typography variant="body2" className={classes.errorText}>
            {searchError}
          </Typography>
        )}
        {searchLoading && (
          <Typography variant="body2" color="textSecondary">
            Searching...
          </Typography>
        )}
      </Paper>

      {/* Search Result Card */}
      {searchResult && (
        <Paper className={classes.resultCard} variant="outlined">
          <IconButton className={classes.closeBtn} size="small" onClick={clearResult}>
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle2" gutterBottom>
            Workflow Run Found
          </Typography>
          <Box className={classes.resultRow}>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">ID</Typography>
              <Typography variant="body2">{searchResult.id}</Typography>
            </Box>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">Workflow</Typography>
              <Typography variant="body2">{searchResult.name}</Typography>
            </Box>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">Branch</Typography>
              <Typography variant="body2">{searchResult.head_branch}</Typography>
            </Box>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">Commit</Typography>
              <Typography variant="body2" noWrap style={{ maxWidth: 200 }}>
                {searchResult.head_commit?.message || searchResult.head_commit?.id || '-'}
              </Typography>
            </Box>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">Status</Typography>
              <Chip
                size="small"
                label={searchResult.conclusion || searchResult.status}
                color={resultStatusColor(searchResult.conclusion)}
              />
            </Box>
            <Box className={classes.resultField}>
              <Typography variant="caption" color="textSecondary">Created</Typography>
              <Typography variant="body2">
                {new Date(searchResult.created_at).toLocaleString()}
              </Typography>
            </Box>
            <IconButton
              size="small"
              href={searchResult.html_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* Workflow Runs Table */}
      <Table
        isLoading={tableLoading}
        options={{ paging: true, pageSize, padding: 'dense' }}
        totalCount={totalCount}
        page={page}
        actions={[
          {
            icon: () => <SyncIcon />,
            tooltip: 'Reload workflow runs',
            isFreeAction: true,
            onClick: () => loadRuns(),
          },
        ]}
        data={runs}
        onPageChange={setPage}
        onRowsPerPageChange={setPageSize}
        style={{ width: '100%' }}
        title={
          <Box display="flex" alignItems="center">
            <GitHubIcon />
            <Box mr={1} />
            <Typography variant="h6">{projectSlug}</Typography>
          </Box>
        }
        columns={columns}
      />
    </>
  );
};
