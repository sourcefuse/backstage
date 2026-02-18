import React from 'react';
import { Button, Grid } from '@material-ui/core';
import { NewRelicApmCard, isNewRelicApmAvailable } from '../newrelic/NewRelicApmCard';
import { NewRelicFacadesTab, isNewRelicFacadesTabAvailable } from '../newrelic/NewRelicFacadesTab';
import { EntityJiraOverviewCard, isJiraAvailable } from '@roadiehq/backstage-plugin-jira';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  EntityGrafanaAlertsCard,
  EntityGrafanaDashboardsCard,
  EntityOverviewDashboardViewer,
  isAlertSelectorAvailable,
  isDashboardSelectorAvailable,
  isOverviewDashboardAvailable,
} from '@backstage-community/plugin-grafana';
import {
  isNewRelicDashboardAvailable,
  EntityNewRelicDashboardContent,
  EntityNewRelicDashboardCard,
} from '@backstage-community/plugin-newrelic-dashboard';
import {
  EntityApiDefinitionCard,
  EntityConsumedApisCard,
  EntityConsumingComponentsCard,
  EntityHasApisCard,
  EntityProvidedApisCard,
  EntityProvidingComponentsCard,
} from '@backstage/plugin-api-docs';
import {
  EntityAboutCard,
  EntityDependsOnComponentsCard,
  EntityDependsOnResourcesCard,
  EntityHasComponentsCard,
  EntityHasResourcesCard,
  EntityHasSubcomponentsCard,
  EntityHasSystemsCard,
  EntityLayout,
  EntityLinksCard,
  EntitySwitch,
  isComponentType,
  isKind,
} from '@backstage/plugin-catalog';

import {
  EntityUserProfileCard,
  EntityGroupProfileCard,
  EntityMembersListCard,
  EntityOwnershipCard,
} from '@backstage/plugin-org';
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';
import { EmptyState } from '@backstage/core-components';
import {
  Direction,
  EntityCatalogGraphCard,
} from '@backstage/plugin-catalog-graph';
import {
  RELATION_API_CONSUMED_BY,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_HAS_PART,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';

import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { EntityTeamPullRequestsCard } from '@backstage-community/plugin-github-pull-requests-board';
import {
  Router as GithubPullRequestsRouter,
  EntityGithubPullRequestsOverviewCard,
} from '@roadiehq/backstage-plugin-github-pull-requests';
import { EntitySonarQubeCard } from '@backstage-community/plugin-sonarqube';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

import {
  EntityJenkinsContent,
  isJenkinsAvailable,
} from '@internal/backstage-plugin-jenkins-with-reporting';
import {
  EntityGithubActionsContent,
  isGithubActionsAvailable,
} from '@backstage-community/plugin-github-actions';

const techdocsContent = (
  <EntityTechdocsContent>
    <TechDocsAddons>
      <ReportIssue />
    </TechDocsAddons>
  </EntityTechdocsContent>
);

const cicdContent = (
  <EntitySwitch>
    <EntitySwitch.Case if={isGithubActionsAvailable}>
      <EntityGithubActionsContent />
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isJenkinsAvailable}>
      <EntityJenkinsContent />
    </EntitySwitch.Case>

    <EntitySwitch.Case>
      <EmptyState
        title="No CI/CD available for this entity"
        missing="info"
        description="You need to add an annotation to your component if you want to enable CI/CD for it. You can read more about annotations in Backstage by clicking the button below."
        action={
          <Button
            variant="contained"
            color="primary"
            href="https://backstage.io/docs/features/software-catalog/well-known-annotations"
          >
            Read more
          </Button>
        }
      />
    </EntitySwitch.Case>
  </EntitySwitch>
);


const OverviewContent = () => {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item md={6}>
        <EntityAboutCard variant="gridItem" />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityCatalogGraphCard variant="gridItem" height={400} />
      </Grid>

      <Grid item md={4} xs={12}>
        <EntityLinksCard />
      </Grid>
      <Grid item md={8} xs={12}>
        <EntityHasSubcomponentsCard variant="gridItem" />
      </Grid>
      <Grid item md={12}>
        <EntityGithubPullRequestsOverviewCard />
      </Grid>
      <EntitySwitch>
        <EntitySwitch.Case if={isNewRelicApmAvailable}>
          <Grid item md={6} xs={12}>
            <NewRelicApmCard />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={isNewRelicDashboardAvailable}>
          <Grid item md={6} xs={12}>
            <EntityNewRelicDashboardCard />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={isAlertSelectorAvailable}>
          <Grid item md={6} xs={12}>
            <EntityGrafanaAlertsCard />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={isDashboardSelectorAvailable}>
          <Grid item md={6} xs={12}>
            <EntityGrafanaDashboardsCard />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
    </Grid>
  );
};

const ServiceEntityPage = () => {
  const config = useApi(configApiRef);
  const isJiraConfigured = Boolean(config.getOptionalString('jira.token'));

  return (
    <EntityLayout>
      <EntityLayout.Route path="/" title="Overview">
        <OverviewContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/ci-cd" title="CI/CD">
        {cicdContent}
      </EntityLayout.Route>

      <EntityLayout.Route path="/jenkins" title="Jenkins" if={isJenkinsAvailable}>
        <EntityJenkinsContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/api" title="API">
        <Grid container spacing={3} alignItems="stretch">
          <Grid item md={6}>
            <EntityProvidedApisCard />
          </Grid>
          <Grid item md={6}>
            <EntityConsumedApisCard />
          </Grid>
        </Grid>
      </EntityLayout.Route>

      <EntityLayout.Route
        path="/kubernetes"
        title="Kubernetes"
        if={isKubernetesAvailable}
      >
        <EntityKubernetesContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/dependencies" title="Dependencies">
        <Grid container spacing={3} alignItems="stretch">
          <Grid item md={6}>
            <EntityDependsOnComponentsCard variant="gridItem" />
          </Grid>
          <Grid item md={6}>
            <EntityDependsOnResourcesCard variant="gridItem" />
          </Grid>
        </Grid>
      </EntityLayout.Route>

      <EntityLayout.Route path="/docs" title="Docs">
        {techdocsContent}
      </EntityLayout.Route>
      <EntityLayout.Route path="/codequality" title="Code Quality">
        <EntitySonarQubeCard />
      </EntityLayout.Route>
      <EntityLayout.Route path="/pull-requests" title="Pull Requests">
        <GithubPullRequestsRouter />
      </EntityLayout.Route>
      {isJiraConfigured && (
        <EntityLayout.Route path="/jira" title="Jira" if={isJiraAvailable}>
          <EntityJiraOverviewCard />
        </EntityLayout.Route>
      )}
      <EntityLayout.Route
        path="/newrelic-dashboard"
        title="New Relic"
        if={isNewRelicDashboardAvailable}
      >
        <EntityNewRelicDashboardContent />
      </EntityLayout.Route>
      <EntityLayout.Route
        path="/newrelic-apm"
        title="New Relic APM"
        if={isNewRelicFacadesTabAvailable}
      >
        <NewRelicFacadesTab />
      </EntityLayout.Route>
      <EntityLayout.Route
        path="/grafana"
        title="Grafana"
        if={isOverviewDashboardAvailable}
      >
        <EntityOverviewDashboardViewer />
      </EntityLayout.Route>
    </EntityLayout>
  );
};

const WebsiteEntityPage = () => {
  const config = useApi(configApiRef);
  const isJiraConfigured = Boolean(config.getOptionalString('jira.token'));

  return (
    <EntityLayout>
      <EntityLayout.Route path="/" title="Overview">
        <OverviewContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/ci-cd" title="CI/CD">
        {cicdContent}
      </EntityLayout.Route>

      <EntityLayout.Route path="/dependencies" title="Dependencies">
        <Grid container spacing={3} alignItems="stretch">
          <Grid item md={6}>
            <EntityDependsOnComponentsCard variant="gridItem" />
          </Grid>
          <Grid item md={6}>
            <EntityDependsOnResourcesCard variant="gridItem" />
          </Grid>
        </Grid>
      </EntityLayout.Route>

      <EntityLayout.Route path="/docs" title="Docs">
        {techdocsContent}
      </EntityLayout.Route>

      <EntityLayout.Route path="/codequality" title="Code Quality">
        <EntitySonarQubeCard />
      </EntityLayout.Route>

      <EntityLayout.Route path="/pull-requests" title="Pull Requests">
        <GithubPullRequestsRouter />
      </EntityLayout.Route>
      {isJiraConfigured && (
        <EntityLayout.Route path="/jira" title="Jira" if={isJiraAvailable}>
          <EntityJiraOverviewCard />
        </EntityLayout.Route>
      )}
      <EntityLayout.Route
        path="/newrelic-dashboard"
        title="New Relic"
        if={isNewRelicDashboardAvailable}
      >
        <EntityNewRelicDashboardContent />
      </EntityLayout.Route>
    </EntityLayout>
  );
};

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const defaultEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <OverviewContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isComponentType('service')}>
      <ServiceEntityPage />
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isComponentType('website')}>
      <WebsiteEntityPage />
    </EntitySwitch.Case>

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);

const apiPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
            <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid container item md={12}>
          <Grid item md={6}>
            <EntityProvidingComponentsCard />
          </Grid>
          <Grid item md={6}>
            <EntityConsumingComponentsCard />
          </Grid>
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/definition" title="Definition">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <EntityApiDefinitionCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const userPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
          <EntityUserProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const groupPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
          <EntityGroupProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityMembersListCard />
        </Grid>
        <Grid item xs={12}>
          <EntityTeamPullRequestsCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityLinksCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const systemPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
            <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid item md={8}>
          <EntityHasComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasApisCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/diagram" title="Diagram">
      <EntityCatalogGraphCard
        variant="gridItem"
        direction={Direction.TOP_BOTTOM}
        title="System Diagram"
        height={700}
        relations={[
          RELATION_PART_OF,
          RELATION_HAS_PART,
          RELATION_API_CONSUMED_BY,
          RELATION_API_PROVIDED_BY,
          RELATION_CONSUMES_API,
          RELATION_PROVIDES_API,
          RELATION_DEPENDENCY_OF,
          RELATION_DEPENDS_ON,
        ]}
        unidirectional={false}
      />
    </EntityLayout.Route>
  </EntityLayout>
);

const domainPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
            <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasSystemsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

export const entityPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isKind('component')} children={componentPage} />
    <EntitySwitch.Case if={isKind('api')} children={apiPage} />
    <EntitySwitch.Case if={isKind('group')} children={groupPage} />
    <EntitySwitch.Case if={isKind('user')} children={userPage} />
    <EntitySwitch.Case if={isKind('system')} children={systemPage} />
    <EntitySwitch.Case if={isKind('domain')} children={domainPage} />

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
