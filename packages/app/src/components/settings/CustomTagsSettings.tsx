import React, { useEffect, useState, useCallback } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

interface TagDefinition {
  id: number;
  tag_name: string;
  color: string;
}

const PRESET_COLORS = [
  '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2',
  '#0097a7', '#c2185b', '#455a64', '#5d4037', '#1565c0',
];

const useStyles = makeStyles(theme => ({
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  colorPicker: {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: 0,
  },
  presetColors: {
    display: 'flex',
    gap: 4,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    cursor: 'pointer',
    border: '2px solid transparent',
    '&:hover': {
      border: '2px solid #333',
    },
  },
  colorDotSelected: {
    border: '2px solid #333',
  },
  empty: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
}));

export const CustomTagsSettings = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#1976d2');
  const [saving, setSaving] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      const res = await fetchApi.fetch(`${baseUrl}/tags`);
      if (res.ok) {
        setTags(await res.json());
      }
    } catch {
      // ignore load errors
    }
  }, [discoveryApi, fetchApi]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleAdd = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      const res = await fetchApi.fetch(`${baseUrl}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        setNewName('');
        await loadTags();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      await fetchApi.fetch(`${baseUrl}/tags/${id}`, { method: 'DELETE' });
      await loadTags();
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader
        title="Custom Tags"
        subheader="Create private tags to organize catalog entities. Tags are only visible to you."
      />
      <Divider />
      <CardContent>
        {tags.length === 0 ? (
          <Typography className={classes.empty} variant="body2" gutterBottom>
            No tags yet. Create your first tag below.
          </Typography>
        ) : (
          <Box className={classes.tagList}>
            {tags.map(tag => (
              <Chip
                key={tag.id}
                label={tag.tag_name}
                style={{ backgroundColor: tag.color, color: '#fff' }}
                onDelete={() => handleDelete(tag.id)}
                deleteIcon={
                  <IconButton size="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              />
            ))}
          </Box>
        )}

        <Divider style={{ margin: '12px 0' }} />
        <Typography variant="subtitle2" gutterBottom>Add new tag</Typography>

        <Box className={classes.presetColors}>
          {PRESET_COLORS.map(c => (
            <div
              key={c}
              className={`${classes.colorDot} ${newColor === c ? classes.colorDotSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </Box>

        <Box className={classes.addRow}>
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className={classes.colorPicker}
            title="Custom color"
          />
          <TextField
            size="small"
            variant="outlined"
            placeholder="Tag name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            inputProps={{ maxLength: 50 }}
            style={{ flex: 1 }}
          />
          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={saving || !newName.trim()}
            onClick={handleAdd}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
