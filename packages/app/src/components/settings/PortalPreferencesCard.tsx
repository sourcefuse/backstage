import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

export const PORTAL_LANDING_PAGE_KEY = 'portal.landingPage';
export const PORTAL_HIDE_ANNOUNCEMENTS_KEY = 'portal.hideAnnouncements';
export const PORTAL_PREFERENCES_EVENT = 'portalPreferencesChanged';

const landingPages = [
  { value: '/home', label: 'Home' },
  { value: '/catalog', label: 'Catalog' },
  { value: '/docs', label: 'Docs' },
  { value: '/create', label: 'Create' },
];

function dispatchPreference(key: string, value: string) {
  window.dispatchEvent(
    new CustomEvent(PORTAL_PREFERENCES_EVENT, { detail: { key, value } }),
  );
}

const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
  caption: {
    marginTop: theme.spacing(0.5),
    display: 'block',
  },
}));

export const PortalPreferencesCard = () => {
  const classes = useStyles();

  const [landingPage, setLandingPage] = useState(
    () => localStorage.getItem(PORTAL_LANDING_PAGE_KEY) || '/home',
  );
  const [showBanner, setShowBanner] = useState(
    () => localStorage.getItem(PORTAL_HIDE_ANNOUNCEMENTS_KEY) !== 'true',
  );

  const handleLandingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLandingPage(value);
    localStorage.setItem(PORTAL_LANDING_PAGE_KEY, value);
    dispatchPreference(PORTAL_LANDING_PAGE_KEY, value);
  };

  const handleBannerToggle = () => {
    const next = !showBanner;
    setShowBanner(next);
    const stored = next ? 'false' : 'true';
    localStorage.setItem(PORTAL_HIDE_ANNOUNCEMENTS_KEY, stored);
    dispatchPreference(PORTAL_HIDE_ANNOUNCEMENTS_KEY, stored);
  };

  return (
    <Card>
      <CardHeader
        title="Portal Preferences"
        subheader="Customize your portal experience"
      />
      <Divider />
      <CardContent>
        <Box className={classes.section}>
          <TextField
            select
            fullWidth
            size="small"
            label="Default Landing Page"
            variant="outlined"
            value={landingPage}
            onChange={handleLandingChange}
          >
            {landingPages.map(p => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="textSecondary" className={classes.caption}>
            The page shown after sign-in.
          </Typography>
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={showBanner}
                onChange={handleBannerToggle}
                color="primary"
              />
            }
            label="Show announcement banner"
          />
          <Typography variant="caption" color="textSecondary" className={classes.caption}>
            Toggle the announcement bar at the top of every page.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
