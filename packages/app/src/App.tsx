import React, { useEffect, useState } from 'react';
import { Navigate, Route } from 'react-router-dom';
import './App.css';
import { apiDocsPlugin } from '@backstage/plugin-api-docs';
import { CustomApiExplorerPage } from './components/catalog/CustomApiExplorerPage';
import {
  createTheme,
  lightTheme,
  BackstageTheme,
  themes,
  UnifiedThemeProvider,
} from '@backstage/theme';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import PaletteIcon from '@material-ui/icons/Palette';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import {
  BackstageOverrides,
  SignInProviderConfig,
  AlertDisplay,
  OAuthRequestDialog,
  SignInPage,
} from '@backstage/core-components'; // NOSONAR
import loginBg from './assets/images/login-bg.jpg';
import sfLogoMinimal from './assets/images/sf-minimal-logo.png';
import { HomePageContent } from './components/home/HomePage';
import {
  HomepageCompositionRoot,
  VisitListener,
} from '@backstage/plugin-home';
import { useApi, identityApiRef, oauthRequestApiRef } from '@backstage/core-plugin-api';

import { CatalogEntityPage, catalogPlugin } from '@backstage/plugin-catalog';
import { CustomCatalogPage } from './components/catalog/CustomCatalogIndexPage';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { scaffolderPlugin, ScaffolderPage } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';

import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import {
  SettingsLayout,
  UserSettingsAppearanceCard,
  UserSettingsAuthProviders,
  UserSettingsFeatureFlags,
  UserSettingsIdentityCard,
  UserSettingsProfileCard,
} from '@backstage/plugin-user-settings';
import { CustomLogoSettings } from './components/settings/CustomLogoSettings';
import { PortalBadgeSettings } from './components/settings/PortalBadgeSettings';
import { ThemeGuideCard } from './components/settings/ThemeGuideCard';
import {
  PortalPreferencesCard,
  PORTAL_HIDE_ANNOUNCEMENTS_KEY,
  PORTAL_LANDING_PAGE_KEY,
  PORTAL_PREFERENCES_EVENT,
} from './components/settings/PortalPreferencesCard';
import { FeatureFlagsInfoBanner } from './components/settings/FeatureFlagsInfoBanner';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';

import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { NewRelicPage } from '@backstage-community/plugin-newrelic';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { githubAuthApiRef } from '@backstage/core-plugin-api';
import { Box, Grid, Typography } from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { AutoLogout } from './components/AutoLogout';
import { TechRadarPage } from '@backstage-community/plugin-tech-radar';
import { PrometheusGlobalPage } from './components/prometheus/PrometheusGlobalPage';
import {
  AnnouncementsPage,
  NewAnnouncementBanner,
} from '@backstage-community/plugin-announcements';
import { AnnouncementsEnhancer } from './components/announcements/AnnouncementsEnhancer';

/* My Custom Theme */
const customTheme = createTheme({
  palette: {
    ...lightTheme.palette,
    primary: {
      main: '#0469E3',
    },
    secondary: {
      main: '#565a6e',
    },
    error: {
      main: '#D7373F',
    },
    warning: {
      main: '#F5E8C7',
    },
    info: {
      main: '#0469E3',
    },
    success: {
      main: '#2D9D78',
    },
    background: {
      default: '#FFFFFF',
      //  paper: '#d5d6db',
    },
    banner: {
      info: '#34548a',
      error: '#8c4351',
      text: '#343b58',
      link: '#565a6e',
    },
    errorBackground: '#EC6986',
    warningBackground: '#F5E8C7',
    infoBackground: '#FFFFFF',
    navigation: {
      background: '#FFFFFF',
      indicator: '#8f5e15',
      color: '#222222',
      selectedColor: '#222222',
      navItem: {
        hoverBackground: '#F6F6F6',
      },
    },
  },
  fontFamily: 'Gotham, sans-serif',
  defaultPageTheme: 'home',
});

export const createCustomThemeOverrides = (): // theme: BackstageTheme,
  BackstageOverrides => {
  return {
    BackstageHeader: {
      header: {
        padding: '24px',
        boxShadow: 'none',
        backgroundImage: 'none',

        // borderBottom: `4px solid ${theme.palette.primary.main}`,
      },
      type: {
        color: '#000000',
      },
      title: {
        fontSize: '30px',
        color: '#000000',
      },
      subtitle: {
        fontSize: '12px',
        color: '#000000',
        fontWeight: 400,
        marginTop: 0,
      },
    },

    BackstageHeaderLabel: {
      value: {
        color: 'black',
      },
      label: {
        color: 'black',
      },
    },
    MuiSvgIcon: {
      root: {
        color: 'black',
      },
    },
    BackstageContentHeader: {
      title: {
        fontSize: '20px',
      },
    },
    BackstageTableToolbar: {
      root: {
        padding: '16px 0px 16px 20px',
      },
    },
    BackstageSidebar: {
      drawer: {
        background: '#FFFFFF',
        borderRight: '1px solid #D1D1D1',
      },
    },
    MuiPaper: {
      elevation1: {
        boxShadow: '0px 0px 3px 1px rgba(0,0,0,0.2)',
      },
    },
    MuiTypography: {
      body1: {
        fontSize: '0.875rem',
      },
      h5: {
        fontSize: '16px',
      },
    },
    MuiFormLabel: {
      root: {
        fontSize: '13px!important',
        lineHeight: '17.7px',
        fontWeight: 'lighter',
      },
    },
    MuiSelect: {
      select: {
        padding: '7px 26px 7px 12px!important',
        formLabel: {
          fontWeight: 'lighter',
        },
      },
    },
    MuiTableCell: {
      root: {
        whiteSpace: 'nowrap',
      },
    },
    BackstageSelect: {
      root: {
        formLabel: {
          fontWeight: 'lighter',
        },
      },
    },
    BackstageSidebarItem: {
      root: {
        textDecoration: 'none',
        color: '#222222',
      },
      selected: {
        position: 'relative',
        borderLeft: 'none!important',
        backgroundColor: '#F6F6F6',
        color: '#E81823!important',
        '&:after': {
          content: '""',
          width: '2px',
          height: '100%',
          backgroundColor: '#525252',
          position: 'absolute',
          top: 0,
          right: '0px',
        },
      },
      iconContainer: {
        marginLeft: '0px!important',
      },
      label: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: '13.4px',
      },
      buttonItem: {
        width: '90%!important',
        margin: '0 auto 20px',
        border: '1px solid #D1D1D1',
        height: '38px',
        borderRadius: 0,
      },
    },
    MuiButton: {
      textPrimary: {
        color: '#E81823',
      },
      root: {
        borderRadius: 4,
      },
      contained: {
        boxShadow: 'none',
      },
      containedPrimary: {
        backgroundColor: '#E81823',
        '&:hover': {
          backgroundColor: '#E81823',
        },
        '&:active': {
          backgroundColor: '#E81823',
        },
      },
    },
    BackstageInfoCard: {
      headerTitle: {
        color: '#212D38',
        fontWeight: 700,
        fontFamily: 'Gotham, sans-serif',
      },
      header: {
        color: '#525252',
      },
    },
    MuiCard: {
      root: {
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
      },
    },
    MuiCardContent: {
      root: {
        backgroundColor: '#FFFFFF',
      },
    },
    MuiCardHeader: {
      root: {
        backgroundColor: '#FFFFFF',
        backgroundImage: 'none',
      },
      title: {
        color: '#212D38',
        fontWeight: 700,
        fontSize: '1rem',
      },
    },
  };
};

const customfinalTheme: BackstageTheme = {
  ...lightTheme,
  ...customTheme,
  overrides: {
    // overrides that Backstage applies to `material-ui` components
    ...lightTheme.overrides,
    // custom overrides, either to `material-ui` or Backstage components.
    // ...createCustomThemeOverrides(lightTheme),
    ...createCustomThemeOverrides(),
  },
};

const githubProvider: SignInProviderConfig = {
  id: 'github-auth-provider',
  title: 'GitHub',
  message: 'Sign in using GitHub',
  apiRef: githubAuthApiRef,
};

const css = `
body{
  background-image: url(${loginBg});
  background-size: cover;
  background-position: center;
}
.sign-in-box > main{
  align-items: center;
  min-width: 400px;
  height: auto;
}

.sign-in-box > main > header{
  display: none;
}

`;

function GuestAwareOAuthDialog() {
  const identityApi = useApi(identityApiRef);
  const oauthRequestApi = useApi(oauthRequestApiRef);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    console.log('[GuestAwareOAuthDialog] Checking identity...');
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        console.log('[GuestAwareOAuthDialog] Identity:', identity.userEntityRef);
        if (identity.userEntityRef === 'user:development/guest') {
          console.log('[GuestAwareOAuthDialog] Setting guest mode');
          setIsGuest(true);
        }
      })
      .catch(error => {
        console.error('[GuestAwareOAuthDialog] Identity check error:', error);
      });
  }, [identityApi]);

  useEffect(() => {
    if (!isGuest) {
      console.log('[GuestAwareOAuthDialog] Not guest, skipping OAuth rejection');
      return undefined;
    }
    console.log('[GuestAwareOAuthDialog] Setting up OAuth request subscription');
    const subscription = oauthRequestApi.authRequest$().subscribe(requests => {
      console.log('[GuestAwareOAuthDialog] OAuth requests received:', requests.length);
      requests.forEach(request => {
        console.log('[GuestAwareOAuthDialog] Rejecting request for:', request.provider.id);
        request.reject();
      });
    });
    return () => {
      console.log('[GuestAwareOAuthDialog] Unsubscribing from OAuth requests');
      subscription.unsubscribe();
    };
  }, [isGuest, oauthRequestApi]);

  if (isGuest) return null;
  return <OAuthRequestDialog />;
}

function AnnouncementBannerWrapper() {
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(PORTAL_HIDE_ANNOUNCEMENTS_KEY) === 'true',
  );
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === PORTAL_HIDE_ANNOUNCEMENTS_KEY) {
        setHidden(detail.value === 'true');
      }
    };
    window.addEventListener(PORTAL_PREFERENCES_EVENT, handler);
    return () => window.removeEventListener(PORTAL_PREFERENCES_EVENT, handler);
  }, []);
  if (hidden) return null;
  return (
    <div className="announcement-banner-wrapper">
      <NewAnnouncementBanner max={1} />
    </div>
  );
}

function LandingRedirect() {
  const target = localStorage.getItem(PORTAL_LANDING_PAGE_KEY) || '/home';
  return <Navigate to={target.replace(/^\//, '')} />;
}

const app = createApp({
  apis,
  components: {
    SignInPage: props => {
      React.useEffect(() => {
        console.log('[SignInPageWrapper] SignInPage component mounted');
        console.log('[SignInPageWrapper] Provider:', githubProvider);
      }, []);

      return (
        <Box
          style={{
            display: 'grid',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
          className="sign-in-page"
        >
          <style>{css}</style>
          <Box
            style={{
              display: 'grid',
              alignSelf: 'center',
              padding: '3rem',
              boxShadow:
                'rgba(0, 0, 0, 0.16) 0px 10px 36px 0px, rgba(0, 0, 0, 0.06) 0px 0px 0px 1px',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: '15px',
              justifyContent: 'center',
            }}
            className="sign-in-box"
          >
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div>
                <img
                  src={sfLogoMinimal}
                  width={60}
                  alt="SourceFuse Backstage"
                  style={{ margin: '0 auto' }}
                />
              </div>
              <h1>BackStage</h1>
            </Box>
            <SignInPage {...props} provider={githubProvider} />
          </Box>
        </Box>
      );
    },
  },
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
      createFromTemplate: scaffolderPlugin.routes.selectedTemplate,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(scaffolderPlugin.externalRoutes, {
      registerComponent: catalogImportPlugin.routes.importPage,
      viewTechDoc: techdocsPlugin.routes.docRoot,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },

  themes: [
    {
      id: 'light',
      title: 'Light',
      variant: 'light',
      icon: <Brightness7Icon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={themes.light} children={children} />
      ),
    },
    {
      id: 'dark',
      title: 'Dark',
      variant: 'dark',
      icon: <Brightness4Icon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={themes.dark} children={children} />
      ),
    },
    {
      id: 'custom-theme',
      title: 'My Custom Theme',
      variant: 'light',
      icon: <PaletteIcon />,
      Provider: ({ children }) => (
        <ThemeProvider theme={customfinalTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      ),
    },
  ],
});

const routes = (
  <FlatRoutes>
    <Route path="/" element={<LandingRedirect />} />
    <Route
      path="/home"
      element={
        <HomepageCompositionRoot>
          <HomePageContent />
        </HomepageCompositionRoot>
      }
    />
    <Route
      path="/catalog"
      element={<CustomCatalogPage initiallySelectedFilter="all" />}
    />
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CatalogEntityPage />
        </RequirePermission>
      }
    >
      {entityPage}
    </Route>
    <Route path="/docs" element={
      <>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px={3}
          py={2}
          mx={3}
          mt={2}
          borderRadius={10}
          style={{
            background: 'linear-gradient(135deg, #212D38 0%, #060C3A 100%)',
            color: '#FFFFFF',
          }}
        >
          <Box display="flex" alignItems="center">
            <InfoOutlinedIcon style={{ color: '#FF6B78', marginRight: 14, fontSize: 28 }} />
            <Box>
              <Typography variant="subtitle1" style={{ color: '#FFFFFF', fontWeight: 700, fontFamily: 'Gotham, sans-serif' }}>
                Add docs for your service
              </Typography>
              <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                Add a <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4 }}>mkdocs.yml</code> and{' '}
                <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4 }}>docs/</code> folder to your repo, then register it in the catalog.
              </Typography>
            </Box>
          </Box>
          <a
            href="https://backstage.io/docs/features/techdocs/creating-and-publishing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              backgroundColor: '#E81823',
              color: '#FFFFFF',
              padding: '8px 20px',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              fontFamily: 'Gotham, sans-serif',
            }}
          >
            TechDocs Guide &rarr;
          </a>
        </Box>
        <TechDocsIndexPage initialFilter="all" />
      </>
    } />
    <Route
      path="/docs/:namespace/:kind/:name/*"
      element={<TechDocsReaderPage />}
    >
      <TechDocsAddons>
        <ReportIssue />
      </TechDocsAddons>
    </Route>
    <Route path="/create" element={
      <ScaffolderPage
        headerOptions={{
          title: 'Create a New Component',
          subtitle: 'Scaffolder',
        }}
        groups={[{ title: 'All Templates', filter: () => true }]}
      />
    } />
    <Route path="/api-docs" element={<CustomApiExplorerPage />} />
    <Route path="/tech-radar" element={<TechRadarPage width={1500} height={800} />} />
    <Route
      path="/catalog-import"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CatalogImportPage />
        </RequirePermission>
      }
    />
    <Route path="/search" element={<SearchPage />}>
      {searchPage}
    </Route>
    <Route
      path="/settings"
      element={
        <SettingsLayout>
          <SettingsLayout.Route path="general" title="General">
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <UserSettingsProfileCard />
              </Grid>
              <Grid item xs={12} md={6}>
                <UserSettingsAppearanceCard />
              </Grid>
              <Grid item xs={12} md={6}>
                <ThemeGuideCard />
              </Grid>
              <Grid item xs={12} md={6}>
                <CustomLogoSettings />
              </Grid>
              <Grid item xs={12} md={6}>
                <PortalBadgeSettings />
              </Grid>
              <Grid item xs={12} md={6}>
                <PortalPreferencesCard />
              </Grid>
              <Grid item xs={12} md={6}>
                <UserSettingsIdentityCard />
              </Grid>
            </Grid>
          </SettingsLayout.Route>
          <SettingsLayout.Route path="auth-providers" title="Authentication">
            <UserSettingsAuthProviders />
          </SettingsLayout.Route>
          <SettingsLayout.Route path="feature-flags" title="Feature Flags">
            <>
              <FeatureFlagsInfoBanner />
              <UserSettingsFeatureFlags />
            </>
          </SettingsLayout.Route>
        </SettingsLayout>
      }
    />
    <Route path="/catalog-graph" element={<CatalogGraphPage />} />
    <Route path="/newrelic" element={<NewRelicPage />} />
    <Route path="/prometheus" element={<PrometheusGlobalPage />} />
    <Route path="/announcements" element={<AnnouncementsPage />} />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <GuestAwareOAuthDialog />
    <AutoLogout
      idleTimeoutMinutes={30}
      promptBeforeIdleSeconds={30}
      useWorkerTimers={false}
      logoutIfDisconnected={false}
    />
    <AppRouter>
      <VisitListener
        toEntityRef={({ pathname }: { pathname: string }) => {
          // Map known non-entity pages to pseudo entity refs so the
          // Recently Visited / Top Visited widgets show a proper kind
          // chip instead of "other".
          const knownPages: Record<string, string> = {
            '/announcements': 'resource:default/announcements',
            '/tech-radar': 'resource:default/tech-radar',
            '/api-docs': 'api:default/api-docs',
            '/create': 'template:default/scaffolding',
            '/docs': 'resource:default/docs',
          };
          // Check exact match first
          if (knownPages[pathname]) return knownPages[pathname];
          // Then check prefix matches for sub-pages
          const prefix = Object.keys(knownPages).find(p => p !== '/' && pathname.startsWith(p + '/'));
          if (prefix) return knownPages[prefix];
          // Fall back to default catalog entity ref parsing
          const match = pathname.match(/^\/catalog\/([^/]+)\/([^/]+)\/([^/]+)/);
          if (match) return `${match[2]}:${match[1]}/${match[3]}`;
          return undefined;
        }}
      />
      <Root>
        <AnnouncementBannerWrapper />
        <AnnouncementsEnhancer />
        {routes}
      </Root>
    </AppRouter>
  </>,
);
