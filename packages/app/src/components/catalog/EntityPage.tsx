import React, { useState } from 'react';
import { Grid } from '@material-ui/core';
import { NewRelicFacadesTab, isNewRelicFacadesTabAvailable } from '../newrelic/NewRelicFacadesTab';
import {
  isNewRelicDashboardAvailable,
  EntityNewRelicDashboardContent,
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
  EntityGithubPullRequestsContent,
} from '@roadiehq/backstage-plugin-github-pull-requests';
import { EntitySonarQubeCard } from '@backstage-community/plugin-sonarqube';
import {JiraEntityTab} from '../jira/JiraEntityTab';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

import {
  isGithubActionsAvailable,
} from '@backstage-community/plugin-github-actions';
import {GithubActionsContent} from '../github-actions/GithubActionsContent';

import {
  EntityGrafanaAlertsCard,
  EntityGrafanaDashboardsCard,
  isAlertSelectorAvailable,
  isDashboardSelectorAvailable,
} from '@backstage-community/plugin-grafana';
import {GrafanaEntityTab} from '../grafana/GrafanaEntityTab';
import {PrometheusEntityTab} from '../prometheus/PrometheusEntityTab';
import {AwsCostEntityTab} from '../aws/AwsCostEntityTab';
import {JenkinsEntityTab} from '../jenkins/JenkinsEntityTab';
import {DefectDensityCard} from '../defect-density/DefectDensityCard';
import {EntityTagsCard, EntityTagsDialog} from '../entity-tags/EntityTagsCard';
import {CreatePrCard} from '../github-pr/CreatePrCard';
import VisibilityIcon from '@material-ui/icons/Visibility';
import LabelIcon from '@material-ui/icons/Label';
import { TabDefinition } from '../tab-settings/types';
import { TabSettingsProvider, useSharedTabSettings } from '../tab-settings/TabSettingsContext';
import { TabVisibilityDialog } from '../tab-settings/TabSettingsCard';

const SERVICE_TABS: TabDefinition[] = [
  { id: 'ci-cd', title: 'CI/CD' },
  { id: 'jenkins', title: 'Jenkins' },
  { id: 'api', title: 'API' },
  { id: 'kubernetes', title: 'Kubernetes' },
  { id: 'dependencies', title: 'Dependencies' },
  { id: 'docs', title: 'Docs' },
  { id: 'jira', title: 'Jira' },
  { id: 'codequality', title: 'Code Quality' },
  { id: 'pull-requests', title: 'Pull Requests' },
  { id: 'newrelic-dashboard', title: 'New Relic' },
  { id: 'newrelic-apm', title: 'New Relic APM' },
  { id: 'grafana', title: 'Grafana' },
  { id: 'prometheus', title: 'Prometheus' },
  { id: 'aws-cost', title: 'AWS', children: [
    { id: 'aws-cost/cost', title: 'Cost' },
    { id: 'aws-cost/lambda', title: 'Lambda' },
    { id: 'aws-cost/ec2', title: 'EC2' },
    { id: 'aws-cost/s3', title: 'S3' },
    { id: 'aws-cost/rds', title: 'RDS' },
    { id: 'aws-cost/cloudfront', title: 'CloudFront' },
    { id: 'aws-cost/opensearch', title: 'OpenSearch' },
    { id: 'aws-cost/codebuild', title: 'CodeBuild' },
    { id: 'aws-cost/codepipeline', title: 'CodePipeline' },
  ]},
];

const WEBSITE_TABS: TabDefinition[] = [
  { id: 'ci-cd', title: 'CI/CD' },
  { id: 'jenkins', title: 'Jenkins' },
  { id: 'dependencies', title: 'Dependencies' },
  { id: 'docs', title: 'Docs' },
  { id: 'jira', title: 'Jira' },
  { id: 'pull-requests', title: 'Pull Requests' },
  { id: 'newrelic-dashboard', title: 'New Relic' },
  { id: 'newrelic-apm', title: 'New Relic APM' },
  { id: 'grafana', title: 'Grafana' },
  { id: 'prometheus', title: 'Prometheus' },
  { id: 'aws-cost', title: 'AWS', children: [
    { id: 'aws-cost/cost', title: 'Cost' },
    { id: 'aws-cost/lambda', title: 'Lambda' },
    { id: 'aws-cost/ec2', title: 'EC2' },
    { id: 'aws-cost/s3', title: 'S3' },
    { id: 'aws-cost/rds', title: 'RDS' },
    { id: 'aws-cost/cloudfront', title: 'CloudFront' },
    { id: 'aws-cost/opensearch', title: 'OpenSearch' },
    { id: 'aws-cost/codebuild', title: 'CodeBuild' },
    { id: 'aws-cost/codepipeline', title: 'CodePipeline' },
  ]},
];

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
      <GithubActionsContent />
    </EntitySwitch.Case>

    <EntitySwitch.Case>
      <JenkinsEntityTab />
    </EntitySwitch.Case>
  </EntitySwitch>
);

const overviewGrid = (
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
    <Grid item md={3} xs={12}>
      <DefectDensityCard />
    </Grid>
    <EntitySwitch>
      <EntitySwitch.Case if={isAlertSelectorAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGrafanaAlertsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    <EntitySwitch>
      <EntitySwitch.Case if={e => Boolean(isDashboardSelectorAvailable(e))}>
        <Grid item md={6} xs={12}>
          <EntityGrafanaDashboardsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </Grid>
);

/**
 * Wrapper that manages tab visibility + dialogs while keeping route children
 * as static JSX so Backstage can discover routable extensions in the element tree.
 * At render time, it filters out disabled routes before passing to EntityLayout.
 */
const TabAwareEntityLayoutInner = ({
  tabs,
  children,
}: {
  tabs: TabDefinition[];
  children: React.ReactNode;
}) => {
  const { loading, isTabEnabled, toggleTab } = useSharedTabSettings();
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);

  const visibleChildren = React.Children.toArray(children).filter(child => {
    if (!React.isValidElement(child)) return true;
    const path = (child.props as any).path;
    if (!path || path === '/') return true;
    const tabId = path.replace(/^\//, '');
    return loading || isTabEnabled(tabId);
  });

  return (
    <>
      <TabVisibilityDialog
        tabs={tabs}
        open={tabDialogOpen}
        onClose={() => setTabDialogOpen(false)}
        toggleTab={toggleTab}
        isTabEnabled={isTabEnabled}
      />
      <EntityTagsDialog open={tagsDialogOpen} onClose={() => setTagsDialogOpen(false)} />
      <EntityLayout
        UNSTABLE_extraContextMenuItems={[
          { title: 'Tab Visibility', Icon: VisibilityIcon, onClick: () => setTabDialogOpen(true) },
          { title: 'My Tags', Icon: LabelIcon, onClick: () => setTagsDialogOpen(true) },
        ]}
      >
        {visibleChildren}
      </EntityLayout>
    </>
  );
};

const TabAwareEntityLayout = ({
  tabs,
  children,
}: {
  tabs: TabDefinition[];
  children: React.ReactNode;
}) => (
  <TabSettingsProvider>
    <TabAwareEntityLayoutInner tabs={tabs}>{children}</TabAwareEntityLayoutInner>
  </TabSettingsProvider>
);

const serviceEntityPage = (
  <TabAwareEntityLayout tabs={SERVICE_TABS}>
    <EntityLayout.Route path="/" title="Overview">
      {overviewGrid}
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/jenkins" title="Jenkins">
      <JenkinsEntityTab />
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

    <EntityLayout.Route path="/jira" title="Jira">
      <JiraEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/codequality" title="Code Quality">
      <EntitySonarQubeCard />
    </EntityLayout.Route>

    <EntityLayout.Route path="/pull-requests" title="Pull Requests">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <CreatePrCard />
        </Grid>
        <Grid item xs={12}>
          <EntityGithubPullRequestsContent />
        </Grid>
      </Grid>
    </EntityLayout.Route>

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

    <EntityLayout.Route path="/grafana" title="Grafana">
      <GrafanaEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/prometheus" title="Prometheus">
      <PrometheusEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/aws-cost" title="AWS">
      <AwsCostEntityTab />
    </EntityLayout.Route>
  </TabAwareEntityLayout>
);

const websiteEntityPage = (
  <TabAwareEntityLayout tabs={WEBSITE_TABS}>
    <EntityLayout.Route path="/" title="Overview">
      {overviewGrid}
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/jenkins" title="Jenkins">
      <JenkinsEntityTab />
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

    <EntityLayout.Route path="/jira" title="Jira">
      <JiraEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/pull-requests" title="Pull Requests">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <CreatePrCard />
        </Grid>
        <Grid item xs={12}>
          <EntityGithubPullRequestsContent />
        </Grid>
      </Grid>
    </EntityLayout.Route>

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

    <EntityLayout.Route path="/grafana" title="Grafana">
      <GrafanaEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/prometheus" title="Prometheus">
      <PrometheusEntityTab />
    </EntityLayout.Route>

    <EntityLayout.Route path="/aws-cost" title="AWS">
      <AwsCostEntityTab />
    </EntityLayout.Route>
  </TabAwareEntityLayout>
);

const overviewContent = (
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
    <Grid item md={3} xs={12}>
      <DefectDensityCard />
    </Grid>
    <Grid item md={3} xs={12}>
      <EntityTagsCard />
    </Grid>
    <EntitySwitch>
      <EntitySwitch.Case if={isAlertSelectorAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGrafanaAlertsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    <EntitySwitch>
      <EntitySwitch.Case if={e => Boolean(isDashboardSelectorAvailable(e))}>
        <Grid item md={6} xs={12}>
          <EntityGrafanaDashboardsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </Grid>
);

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const defaultEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isComponentType('service')}>
      {serviceEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isComponentType('website')}>
      {websiteEntityPage}
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
        <Grid item md={3} xs={12}>
          <EntityTagsCard />
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
        <Grid item md={3} xs={12}>
          <EntityTagsCard />
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
