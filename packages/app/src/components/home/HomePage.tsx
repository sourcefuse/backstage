import React from 'react';
import {
  HomePageTopVisited,
  HomePageRecentlyVisited,
  HomePageStarredEntities,
  HomePageToolkit,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, makeStyles, Typography } from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import LanguageIcon from '@material-ui/icons/Language';

/* ── SourceFuse brand tokens ─────────────────────────────────────────── */
const SF = {
  red: '#E81823',
  navy: '#212D38',
  darkBlue: '#060C3A',
  bodyText: '#525252',
  lightBg: '#F7F8F9',
  white: '#FFFFFF',
  border: '#E4E4E4',
  cardShadow: '0 2px 16px rgba(33, 45, 56, 0.08)',
};

const useStyles = makeStyles(() => ({
  /* Full-page wrapper – covers the dark Backstage page-theme gradient */
  root: {
    backgroundColor: SF.lightBg,
    minHeight: '100vh',
    /* bleed past the 24px padding that Content adds */
    margin: '-24px -24px 0',
    padding: 0,
    overflowX: 'hidden',
  },

  /* ── Hero banner ─────────────────────────────────────────────────── */
  hero: {
    background: `linear-gradient(135deg, ${SF.navy} 0%, ${SF.darkBlue} 100%)`,
    padding: '56px 40px 68px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  /* decorative glow circles */
  heroDeco1: {
    position: 'absolute',
    top: '-80px',
    right: '-80px',
    width: '360px',
    height: '360px',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${SF.red}33 0%, transparent 65%)`,
    pointerEvents: 'none',
  },
  heroDeco2: {
    position: 'absolute',
    bottom: '-100px',
    left: '4%',
    width: '280px',
    height: '280px',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${SF.red}22 0%, transparent 65%)`,
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '680px',
    margin: '0 auto',
  },
  heroBadge: {
    display: 'inline-block',
    backgroundColor: `${SF.red}22`,
    color: '#FF6B78',
    border: `1px solid ${SF.red}55`,
    borderRadius: '20px',
    padding: '4px 18px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase' as const,
    marginBottom: '20px',
    fontFamily: 'Gotham, sans-serif',
  },
  heroTitle: {
    color: SF.white,
    fontSize: '2.6rem',
    fontWeight: 700,
    lineHeight: 1.18,
    marginBottom: '14px',
    fontFamily: 'Gotham, sans-serif',
  },
  heroRed: {
    color: SF.red,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: '1rem',
    lineHeight: 1.65,
    marginBottom: '40px',
    fontFamily: 'Gotham, sans-serif',
  },

  /* ── Search bar inside hero ──────────────────────────────────────── */
  searchWrapper: {
    maxWidth: '580px',
    margin: '0 auto',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 6px 28px rgba(0,0,0,0.35)',
    '& .MuiPaper-root': {
      borderRadius: '8px !important',
      boxShadow: 'none !important',
      backgroundColor: `${SF.white} !important`,
    },
    '& .MuiInputBase-root': {
      borderRadius: '8px',
      backgroundColor: `${SF.white} !important`,
    },
    '& .MuiOutlinedInput-root': {
      backgroundColor: `${SF.white} !important`,
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none !important',
    },
    '& input': {
      backgroundColor: `${SF.white} !important`,
      color: '#333333 !important',
    },
    '& .MuiSvgIcon-root': {
      color: '#999999 !important',
    },
    /* CLEAR button */
    '& .MuiButton-root, & button': {
      color: `${SF.navy} !important`,
    },
  },

  /* ── Thin accent divider ─────────────────────────────────────────── */
  accentStrip: {
    height: '4px',
    background: `linear-gradient(90deg, ${SF.red} 0%, ${SF.navy} 55%, ${SF.lightBg} 100%)`,
  },

  /* ── Main content area ───────────────────────────────────────────── */
  mainContent: {
    padding: '36px 32px 56px',
    maxWidth: '1400px',
    margin: '0 auto',
  },

  /* ── Card wrapper ────────────────────────────────────────────────── */
  cardWrapper: {
    backgroundColor: SF.white,
    borderRadius: '10px',
    boxShadow: SF.cardShadow,
    border: `1px solid ${SF.border}`,
    overflow: 'hidden',
    height: '100%',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: '0 6px 24px rgba(33, 45, 56, 0.14)',
    },
    /* Force white backgrounds on ALL inner MUI card elements */
    '& .MuiCard-root': {
      backgroundColor: `${SF.white} !important`,
      backgroundImage: 'none !important',
      boxShadow: 'none !important',
      borderRadius: 0,
    },
    '& .MuiCardContent-root': {
      backgroundColor: `${SF.white} !important`,
    },
    '& .MuiCardHeader-root': {
      backgroundColor: `${SF.white} !important`,
      backgroundImage: 'none !important',
      borderBottom: `2px solid ${SF.red}`,
      paddingBottom: '12px',
    },
    '& .MuiCardHeader-title': {
      color: `${SF.navy} !important`,
      fontWeight: '700 !important',
      fontSize: '1rem !important',
      fontFamily: 'Gotham, sans-serif !important',
    },
    '& .MuiPaper-root': {
      backgroundColor: `${SF.white} !important`,
    },
    /* Dividers */
    '& .MuiDivider-root': {
      backgroundColor: `${SF.border}`,
    },
    /* Link colours: navy default, red on hover */
    '& a': {
      color: `${SF.navy}`,
      textDecoration: 'none',
    },
    '& a:hover': {
      color: `${SF.red}`,
      textDecoration: 'underline',
    },
    /* Chips / badges */
    '& .MuiChip-root': {
      backgroundColor: `${SF.navy} !important`,
      color: `${SF.white} !important`,
    },
    /* Toolkit icon circles — SF navy */
    '& .MuiListItemIcon-root': {
      backgroundColor: `${SF.navy} !important`,
      color: `${SF.white} !important`,
    },
    '& .MuiListItemIcon-root svg': {
      color: `${SF.white} !important`,
      fill: `${SF.white} !important`,
    },
    /* VIEW MORE button */
    '& .MuiButton-root': {
      color: `${SF.red} !important`,
      fontWeight: 600,
    },
    /* Secondary text (count, time) */
    '& .MuiTypography-colorTextSecondary': {
      color: `${SF.bodyText} !important`,
    },
  },
}));

/* ── Toolkit quick-links ─────────────────────────────────────────────── */
const toolkitTools = [
  {
    url: 'https://backstage.io/docs',
    label: 'Docs',
    icon: <MenuBookIcon />,
  },
  {
    url: 'https://github.com/sourcefuse',
    label: 'GitHub',
    icon: <GitHubIcon />,
  },
  {
    url: 'https://sourcefuse.com',
    label: 'SourceFuse',
    icon: <LanguageIcon />,
  },
];

/* ── Component ───────────────────────────────────────────────────────── */
export const HomePageContent = () => {
  const classes = useStyles();

  return (
    <SearchContextProvider>
      <div className={classes.root}>

        {/* ── Hero ── */}
        <div className={classes.hero}>
          <div className={classes.heroDeco1} />
          <div className={classes.heroDeco2} />

          <div className={classes.heroInner}>
            <div className={classes.heroBadge}>ARC · Developer Portal</div>

            <Typography component="h1" className={classes.heroTitle}>
              Welcome to&nbsp;
              <span className={classes.heroRed}>SF</span>
              &nbsp;BackStage
            </Typography>

            <Typography className={classes.heroSubtitle}>
              Discover, manage and build software with SourceFuse&apos;s
              unified developer platform.
            </Typography>

            <div className={classes.searchWrapper}>
              <HomePageSearchBar placeholder="Search services, APIs, docs…" />
            </div>
          </div>
        </div>

        {/* ── Red → navy accent divider ── */}
        <div className={classes.accentStrip} />

        {/* ── Content grid ── */}
        <div className={classes.mainContent}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <div className={classes.cardWrapper}>
                <HomePageTopVisited />
              </div>
            </Grid>

            <Grid item xs={12} md={6}>
              <div className={classes.cardWrapper}>
                <HomePageRecentlyVisited />
              </div>
            </Grid>

            <Grid item xs={12} md={6}>
              <div className={classes.cardWrapper}>
                <HomePageStarredEntities />
              </div>
            </Grid>

            <Grid item xs={12} md={6}>
              <div className={classes.cardWrapper}>
                <HomePageToolkit tools={toolkitTools} />
              </div>
            </Grid>
          </Grid>
        </div>

      </div>
    </SearchContextProvider>
  );
};
