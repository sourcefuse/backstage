import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@material-ui/core/Grid';
import FilterListIcon from '@material-ui/icons/FilterList';
import ToggleButton from '@material-ui/lab/ToggleButton';
import {
  Content,
  ContentHeader,
  Page,
  Header,
  SupportButton,
  CreateButton,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  EntityListProvider,
  EntityKindPicker,
  EntityTagPicker,
  EntityOwnerPicker,
  EntitySearchBar,
  UserListPicker,
} from '@backstage/plugin-catalog-react';
import {
  TemplateCategoryPicker,
  TemplateGroups,
} from '@backstage/plugin-scaffolder-react/alpha';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';

const CustomScaffolderPage = () => {
  const navigate = useNavigate();
  const orgName =
    useApi(configApiRef).getOptionalString('organization.name') ?? 'Backstage';

  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowFilters(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const onTemplateSelected = useCallback(
    (template: any) => {
      const { namespace, name } = parseEntityRef(stringifyEntityRef(template));
      navigate(`/create/templates/${namespace}/${name}`);
    },
    [navigate],
  );

  const groups = [
    {
      title: 'All Templates',
      filter: () => true,
    },
  ];

  return (
    <EntityListProvider>
      <Page themeId="home">
        <Header
          title="Create a New Component"
          subtitle={`${orgName} — Scaffolder`}
        />
        <Content>
          <ContentHeader
            titleComponent={
              <ToggleButton
                value="show filters"
                selected={showFilters}
                onChange={() => setShowFilters(!showFilters)}
              >
                <FilterListIcon />
                &nbsp;Filters
              </ToggleButton>
            }
          >
            <CreateButton title="Register Existing Component" to="/catalog-import" />
            <SupportButton>
              Create new software components using templates
            </SupportButton>
          </ContentHeader>
          <Grid container style={{ position: 'relative' }}>
            {showFilters && (
              <Grid item lg={2} xs={12}>
                <EntitySearchBar />
                <EntityKindPicker initialFilter="template" hidden />
                <UserListPicker
                  initialFilter="all"
                  availableFilters={['all', 'starred']}
                />
                <TemplateCategoryPicker />
                <EntityTagPicker />
                <EntityOwnerPicker />
              </Grid>
            )}
            <Grid item xs={12} lg={showFilters ? 10 : 12}>
              <TemplateGroups
                groups={groups}
                onTemplateSelected={onTemplateSelected}
              />
            </Grid>
          </Grid>
        </Content>
      </Page>
    </EntityListProvider>
  );
};

export { CustomScaffolderPage };
