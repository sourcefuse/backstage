import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(4, 105, 227, 0.08)',
    border: '1px solid rgba(4, 105, 227, 0.25)',
    borderRadius: 8,
    padding: theme.spacing(2, 3),
    marginBottom: theme.spacing(3),
  },
  icon: {
    color: '#0469E3',
    marginRight: theme.spacing(2),
    marginTop: 2,
    flexShrink: 0,
  },
}));

export const FeatureFlagsInfoBanner = () => {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <InfoOutlinedIcon className={classes.icon} />
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          About Feature Flags
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Feature flags let plugins register optional capabilities you can toggle
          per user. When a plugin registers a flag it appears in the list below.
          If the list is empty, no plugins have registered flags yet.
        </Typography>
      </Box>
    </Box>
  );
};
