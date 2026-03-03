import React, { useCallback, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Switch,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

const useStyles = makeStyles(theme => ({
  dialogField: {
    marginBottom: theme.spacing(2),
  },
  successBox: {
    textAlign: 'center' as const,
    padding: theme.spacing(2),
  },
}));

type Branch = {
  name: string;
};

export const CreatePrCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const projectSlug =
    entity.metadata?.annotations?.['github.com/project-slug'];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [head, setHead] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>('main');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdPr, setCreatedPr] = useState<{ html_url: string; number: number } | null>(null);

  const getBaseUrl = useCallback(async () => {
    return discoveryApi.getBaseUrl('github-pr');
  }, [discoveryApi]);

  const fetchBranches = useCallback(async () => {
    if (!projectSlug) return;
    setBranchesLoading(true);
    try {
      const baseUrl = await getBaseUrl();
      const [owner, repo] = projectSlug.split('/');
      const resp = await fetchApi.fetch(
        `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setBranches(data);
    } catch {
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }, [projectSlug, getBaseUrl, fetchApi]);

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setHead(null);
    setBase('main');
    setTitle('');
    setBody('');
    setDraft(false);
    setSubmitError(null);
    setCreatedPr(null);
    fetchBranches();
  };

  const handleSubmit = async () => {
    if (!projectSlug || !head || !base || !title) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const baseUrl = await getBaseUrl();
      const [owner, repo] = projectSlug.split('/');
      const resp = await fetchApi.fetch(
        `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, head, base, draft }),
        },
      );
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        throw new Error(b.error || `HTTP ${resp.status}`);
      }
      const pr = await resp.json();
      setCreatedPr({ html_url: pr.html_url, number: pr.number });
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to create PR');
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectSlug) {
    return null;
  }

  return (
    <>
      <Box display="flex" justifyContent="flex-end" mb={1}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Create Pull Request
        </Button>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        {createdPr ? (
          <>
            <DialogTitle>Pull Request Created</DialogTitle>
            <DialogContent>
              <Box className={classes.successBox}>
                <Typography variant="h6" gutterBottom>
                  PR #{createdPr.number} created successfully
                </Typography>
                <Link
                  href={createdPr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  View on GitHub <OpenInNewIcon fontSize="small" />
                </Link>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)} color="primary">
                Close
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>Create Pull Request</DialogTitle>
            <DialogContent>
              <Autocomplete
                className={classes.dialogField}
                options={branches.map(b => b.name)}
                loading={branchesLoading}
                value={head}
                onChange={(_, v) => setHead(v)}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Source branch"
                    variant="outlined"
                    size="small"
                    required
                  />
                )}
              />
              <Autocomplete
                className={classes.dialogField}
                options={branches.map(b => b.name)}
                loading={branchesLoading}
                value={base}
                onChange={(_, v) => setBase(v)}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Target branch"
                    variant="outlined"
                    size="small"
                    required
                  />
                )}
              />
              <TextField
                className={classes.dialogField}
                label="Title"
                variant="outlined"
                size="small"
                fullWidth
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <TextField
                className={classes.dialogField}
                label="Description"
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={4}
                value={body}
                onChange={e => setBody(e.target.value)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft}
                    onChange={e => setDraft(e.target.checked)}
                    color="primary"
                  />
                }
                label="Draft"
              />
              {submitError && (
                <Box mt={1}>
                  <Typography variant="body2" color="error">
                    {submitError}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                color="primary"
                variant="contained"
                disabled={submitting || !head || !base || !title}
              >
                {submitting ? <CircularProgress size={20} /> : 'Create'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};
