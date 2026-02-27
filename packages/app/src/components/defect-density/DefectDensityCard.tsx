import React, { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { InfoCard } from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  CircularProgress,
  Typography,
  Tooltip,
  makeStyles,
} from '@material-ui/core';
import BugReportIcon from '@material-ui/icons/BugReport';
import CodeIcon from '@material-ui/icons/Code';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';

const useStyles = makeStyles(theme => ({
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  metricLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  metricValue: {
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  densityBox: {
    textAlign: 'center',
    padding: '16px 0 8px',
  },
  densityValue: {
    fontSize: '2.2rem',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  densityLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  weekLabel: {
    fontSize: '0.7rem',
    color: theme.palette.text.hint,
    marginTop: 2,
  },
  cached: {
    fontSize: '0.65rem',
    color: theme.palette.text.hint,
    textAlign: 'right',
    marginTop: 8,
  },
}));

type DensityData = {
  projectSlug: string;
  branch: string;
  week: number;
  year: number;
  bugCount: number;
  linesChanged: number;
  defectDensity: number;
  mergedPrCount: number;
  cached: boolean;
};

function getDensityColor(density: number): string {
  if (density === 0) return '#4CAF50'; // green — no bugs
  if (density < 1) return '#8BC34A';   // light green
  if (density < 5) return '#FF9800';   // orange
  return '#F44336';                     // red — high density
}

export const DefectDensityCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [data, setData] = useState<DensityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectSlug =
    entity.metadata?.annotations?.['github.com/project-slug'];

  const fetchDensity = useCallback(async () => {
    if (!projectSlug) {
      setError('Missing github.com/project-slug annotation');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const baseUrl = await discoveryApi.getBaseUrl('defect-density');
      const resp = await fetchApi.fetch(
        `${baseUrl}/?projectSlug=${encodeURIComponent(projectSlug)}`,
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const result = await resp.json();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, discoveryApi, fetchApi]);

  useEffect(() => {
    fetchDensity();
  }, [fetchDensity]);

  if (!projectSlug) {
    return null; // Don't render if no GitHub annotation
  }

  return (
    <InfoCard title="Defect Density" variant="gridItem">
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {error && !loading && (
        <Box py={2} px={1}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      )}

      {data && !loading && (
        <Box px={1}>
          {/* Main density value */}
          <div className={classes.densityBox}>
            <Tooltip
              title="Bug issues closed this week / thousand lines changed in merged PRs"
              arrow
            >
              <Typography
                className={classes.densityValue}
                style={{ color: getDensityColor(data.defectDensity) }}
              >
                {data.defectDensity.toFixed(2)}
              </Typography>
            </Tooltip>
            <Typography className={classes.densityLabel}>
              bugs / KLOC
            </Typography>
            <Typography className={classes.weekLabel}>
              Week {data.week}, {data.year} · {data.branch}
            </Typography>
          </div>

          {/* Breakdown metrics */}
          <div className={classes.metricRow}>
            <span className={classes.metricLabel}>
              <BugReportIcon fontSize="small" />
              Bug issues closed
            </span>
            <span className={classes.metricValue}>{data.bugCount}</span>
          </div>

          <div className={classes.metricRow}>
            <span className={classes.metricLabel}>
              <CodeIcon fontSize="small" />
              Lines changed
            </span>
            <span className={classes.metricValue}>
              {data.linesChanged.toLocaleString()}
            </span>
          </div>

          <div className={classes.metricRow}>
            <span className={classes.metricLabel}>
              <MergeTypeIcon fontSize="small" />
              Merged PRs
            </span>
            <span className={classes.metricValue}>{data.mergedPrCount}</span>
          </div>

          {data.defectDensity === 0 && data.linesChanged > 0 && (
            <div className={classes.metricRow}>
              <span className={classes.metricLabel}>
                <TrendingDownIcon fontSize="small" style={{ color: '#4CAF50' }} />
                <span style={{ color: '#4CAF50' }}>No defects this week</span>
              </span>
            </div>
          )}

          {data.cached && (
            <Typography className={classes.cached}>cached result</Typography>
          )}
        </Box>
      )}
    </InfoCard>
  );
};
