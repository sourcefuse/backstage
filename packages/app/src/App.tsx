import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import './App.css';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import { createTheme, lightTheme, BackstageTheme } from '@backstage/theme';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import { BackstageOverrides } from '@backstage/core-components';
import loginBg from './assets/images/login-bg.jpg';
import sfLogoMinimal from './assets/images/sf-minimal-logo.png';

import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import { TechRadarPage } from '@backstage/plugin-tech-radar';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
// import { CustomCatalogPage } from './components/catalog/CustomCatalogIndexPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';

import {
  AlertDisplay,
  OAuthRequestDialog,
  SignInProviderConfig,
  SignInPage,
} from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { githubAuthApiRef } from '@backstage/core-plugin-api';
import { Box } from '@material-ui/core';
import { EntitySnykContent } from 'backstage-plugin-snyk';

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
      type:{
        color:"#000000"
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
      }
    },    
    MuiSvgIcon: {
      root: {
        color: 'black',
      }
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
      textPrimary:{
        color:'#E81823'
      },
      root: {
        borderRadius: 4,
      },
      contained: {
        boxShadow: 'none',
      },
      containedPrimary: {
        backgroundColor:'#E81823',
        '&:hover': {
          backgroundColor: '#E81823',
        },
        '&:active': {
          backgroundColor: '#E81823',
        },
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

const app = createApp({
  apis,
  components: {
    SignInPage: props => (
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
    ),
  },
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(scaffolderPlugin.externalRoutes, {
      registerComponent: catalogImportPlugin.routes.importPage,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },
  themes: [
    {
      id: 'custom-theme',
      title: 'My Custom Theme',
      variant: 'light',
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
    <Route path="/" element={<Navigate to="catalog" />} />
    <Route path="/catalog" element={<CatalogIndexPage />} />
    {/* <CustomCatalogPage />
    </Route> */}
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      {entityPage}
    </Route>
    <Route path="/docs" element={<TechDocsIndexPage />} />
    <Route
      path="/docs/:namespace/:kind/:name/*"
      element={<TechDocsReaderPage />}
    >
      <TechDocsAddons>
        <ReportIssue />
      </TechDocsAddons>
    </Route>
    <Route path="/create" element={<ScaffolderPage />} />
    <Route path="/api-docs" element={<ApiExplorerPage />} />
    <Route
      path="/tech-radar"
      element={<TechRadarPage width={1500} height={800} />}
    />
    <Route path="/snyk" element={<EntitySnykContent />}/>
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
    <Route path="/settings" element={<UserSettingsPage />} />
    <Route path="/catalog-graph" element={<CatalogGraphPage />} />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);
