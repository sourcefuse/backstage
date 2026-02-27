import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';

const themes = [
  {
    name: 'Light',
    description: 'Default Backstage light theme.',
    colors: ['#1F5493', '#FFFFFF', '#2E2E2E'],
  },
  {
    name: 'Dark',
    description: 'Standard dark mode with reduced glare.',
    colors: ['#90CAF9', '#424242', '#FFFFFF'],
  },
  {
    name: 'My Custom Theme',
    description: 'SourceFuse brand \u2014 Gotham font, red buttons, white sidebar.',
    colors: ['#0469E3', '#E81823', '#212D38', '#FFFFFF'],
  },
];

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 0),
    '&:not(:last-child)': {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  swatches: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: `1px solid ${theme.palette.divider}`,
  },
  info: {
    minWidth: 0,
  },
  hint: {
    marginTop: theme.spacing(2),
    fontStyle: 'italic',
  },
}));

export const ThemeGuideCard = () => {
  const classes = useStyles();

  return (
    <Card>
      <CardHeader
        title="Theme Guide"
        subheader="Available portal themes and their color palettes"
      />
      <Divider />
      <CardContent>
        {themes.map(t => (
          <Box key={t.name} className={classes.row}>
            <Box className={classes.swatches}>
              {t.colors.map(c => (
                <Box
                  key={c}
                  className={classes.swatch}
                  style={{ backgroundColor: c }}
                />
              ))}
            </Box>
            <Box className={classes.info}>
              <Typography variant="subtitle2">{t.name}</Typography>
              <Typography variant="caption" color="textSecondary">
                {t.description}
              </Typography>
            </Box>
          </Box>
        ))}
        <Typography variant="caption" color="textSecondary" className={classes.hint}>
          Switch themes using the Appearance card above.
        </Typography>
      </CardContent>
    </Card>
  );
};
