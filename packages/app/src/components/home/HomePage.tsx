import React from 'react';
import {
  HomePageTopVisited,
  HomePageRecentlyVisited,
  HomePageStarredEntities,
  HomePageToolkit,
  TemplateBackstageLogoIcon,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, makeStyles } from '@material-ui/core';
import LogoFull from '../Root/LogoFull';

const useStyles = makeStyles(theme => ({
  searchBar: {
    display: 'flex',
    maxWidth: '60vw',
    margin: 'auto',
    padding: theme.spacing(1, 0),
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: theme.spacing(2),
    paddingTop: theme.spacing(4),
  },
}));

const toolkitTools = [
  {
    url: 'https://backstage.io/docs',
    label: 'Docs',
    icon: <TemplateBackstageLogoIcon />,
  },
  {
    url: 'https://github.com/sourcefuse',
    label: 'GitHub',
    icon: <TemplateBackstageLogoIcon />,
  },
  {
    url: 'https://sourcefuse.com',
    label: 'SourceFuse',
    icon: <TemplateBackstageLogoIcon />,
  },
];

export const HomePageContent = () => {
  const classes = useStyles();
  return (
    <SearchContextProvider>
      <div className={classes.logoContainer}>
        <LogoFull />
      </div>
      <div className={classes.searchBar}>
        <HomePageSearchBar placeholder="Search in Backstage" />
      </div>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <HomePageTopVisited />
        </Grid>
        <Grid item xs={12} md={6}>
          <HomePageRecentlyVisited />
        </Grid>
        <Grid item xs={12} md={6}>
          <HomePageStarredEntities />
        </Grid>
        <Grid item xs={12} md={6}>
          <HomePageToolkit tools={toolkitTools} />
        </Grid>
      </Grid>
    </SearchContextProvider>
  );
};
