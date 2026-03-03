import React, { useEffect, useState, useCallback } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { InfoCard } from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

interface TagDefinition {
  id: number;
  tag_name: string;
  color: string;
}

const useStyles = makeStyles(theme => ({
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  empty: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    fontSize: '0.85rem',
  },
  link: {
    color: theme.palette.primary.main,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '0.85rem',
  },
}));

export const EntityTagsCard = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);

  const [allTags, setAllTags] = useState<TagDefinition[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      const [tagsRes, assignRes] = await Promise.all([
        fetchApi.fetch(`${baseUrl}/tags`),
        fetchApi.fetch(`${baseUrl}/assignments/${encodeURIComponent(entityRef)}`),
      ]);
      if (tagsRes.ok) setAllTags(await tagsRes.json());
      if (assignRes.ok) setAssignedIds(new Set(await assignRes.json()));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi, entityRef]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTag = async (tagId: number) => {
    const newAssigned = new Set(assignedIds);
    if (newAssigned.has(tagId)) {
      newAssigned.delete(tagId);
    } else {
      newAssigned.add(tagId);
    }
    // Optimistic update
    setAssignedIds(newAssigned);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      await fetchApi.fetch(`${baseUrl}/assignments/${encodeURIComponent(entityRef)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: Array.from(newAssigned) }),
      });
    } catch {
      // Revert on error
      load();
    }
  };

  if (loading) return null;

  const tagsContent = allTags.length === 0 ? (
    <Box p={1}>
      <Typography className={classes.empty}>
        No tags defined.{' '}
        <a href="/settings/custom-tags" className={classes.link}>
          Create tags in Settings
        </a>
      </Typography>
    </Box>
  ) : (
    <Box className={classes.tagList} p={1}>
      {allTags.map(tag => {
        const isAssigned = assignedIds.has(tag.id);
        return (
          <Chip
            key={tag.id}
            label={tag.tag_name}
            clickable
            onClick={() => toggleTag(tag.id)}
            variant={isAssigned ? 'default' : 'outlined'}
            style={
              isAssigned
                ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color }
                : { borderColor: tag.color, color: tag.color }
            }
          />
        );
      })}
    </Box>
  );

  return (
    <InfoCard title="My Tags">
      {tagsContent}
    </InfoCard>
  );
};

export const EntityTagsDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);

  const [allTags, setAllTags] = useState<TagDefinition[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      const [tagsRes, assignRes] = await Promise.all([
        fetchApi.fetch(`${baseUrl}/tags`),
        fetchApi.fetch(`${baseUrl}/assignments/${encodeURIComponent(entityRef)}`),
      ]);
      if (tagsRes.ok) setAllTags(await tagsRes.json());
      if (assignRes.ok) setAssignedIds(new Set(await assignRes.json()));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi, entityRef]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggleTag = async (tagId: number) => {
    const newAssigned = new Set(assignedIds);
    if (newAssigned.has(tagId)) {
      newAssigned.delete(tagId);
    } else {
      newAssigned.add(tagId);
    }
    setAssignedIds(newAssigned);
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      await fetchApi.fetch(`${baseUrl}/assignments/${encodeURIComponent(entityRef)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: Array.from(newAssigned) }),
      });
    } catch {
      load();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        My Tags
        <IconButton
          aria-label="close"
          onClick={onClose}
          style={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? null : allTags.length === 0 ? (
          <Box p={1}>
            <Typography className={classes.empty}>
              No tags defined.{' '}
              <a href="/settings/custom-tags" className={classes.link}>
                Create tags in Settings
              </a>
            </Typography>
          </Box>
        ) : (
          <Box className={classes.tagList} p={1}>
            {allTags.map(tag => {
              const isAssigned = assignedIds.has(tag.id);
              return (
                <Chip
                  key={tag.id}
                  label={tag.tag_name}
                  clickable
                  onClick={() => toggleTag(tag.id)}
                  variant={isAssigned ? 'default' : 'outlined'}
                  style={
                    isAssigned
                      ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color }
                      : { borderColor: tag.color, color: tag.color }
                  }
                />
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
