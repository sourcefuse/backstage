import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Divider from '@material-ui/core/Divider';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

export const PORTAL_BADGE_KEY = 'hero_badge_text';
export const PORTAL_BADGE_EVENT = 'portalBadgeTextChanged';

const useStyles = makeStyles(theme => ({
  actions: {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  preview: {
    display: 'inline-block',
    backgroundColor: 'rgba(232,24,35,0.13)',
    color: '#FF6B78',
    border: '1px solid rgba(232,24,35,0.33)',
    borderRadius: '20px',
    padding: '4px 18px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase' as const,
    marginBottom: theme.spacing(2),
  },
}));

export const PortalBadgeSettings = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    discoveryApi.getBaseUrl('portal-settings').then(baseUrl => {
      fetchApi
        .fetch(`${baseUrl}?key=${PORTAL_BADGE_KEY}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.value) {
            setText(data.value);
            setSavedText(data.value);
          }
        })
        .catch(() => {});
    });
  }, [discoveryApi, fetchApi]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const baseUrl = await discoveryApi.getBaseUrl('portal-settings');
      await fetchApi.fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: PORTAL_BADGE_KEY, value: text }),
      });
      setSavedText(text);
      window.dispatchEvent(new CustomEvent(PORTAL_BADGE_EVENT, { detail: text }));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultText = 'ARC · Developer Portal';
    setText(defaultText);
    setSaving(true);
    try {
      const baseUrl = await discoveryApi.getBaseUrl('portal-settings');
      await fetchApi.fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: PORTAL_BADGE_KEY, value: defaultText }),
      });
      setSavedText(defaultText);
      window.dispatchEvent(new CustomEvent(PORTAL_BADGE_EVENT, { detail: defaultText }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Portal Badge Text"
        subheader="Customize the badge shown in the home page hero banner"
      />
      <Divider />
      <CardContent>
        <Typography variant="body2" gutterBottom>
          Preview
        </Typography>
        <div className={classes.preview}>{text || 'ARC · Developer Portal'}</div>

        <TextField
          fullWidth
          size="small"
          label="Badge Text"
          variant="outlined"
          value={text}
          onChange={e => setText(e.target.value)}
          inputProps={{ maxLength: 80 }}
        />

        <Box className={classes.actions}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={saving || text === savedText || !text.trim()}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={saving}
            onClick={handleReset}
          >
            Reset to Default
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
