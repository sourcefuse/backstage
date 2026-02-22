/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode, useEffect, useState } from 'react';
import {
  Content,
  ContentHeader,
  CreateButton,
  PageWithHeader,
  SupportButton,
  TableColumn,
  TableProps,
} from '@backstage/core-components';
import {
  attachComponentData,
  configApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  EntityLifecyclePicker,
  EntityListProvider,
  EntityProcessingStatusPicker,
  EntityOwnerPicker,
  EntityTagPicker,
  EntityTypePicker,
  UserListFilterKind,
  UserListPicker,
  EntityKindPicker,
  EntityNamespacePicker,
} from '@backstage/plugin-catalog-react';
import {
  CatalogTable,
  CatalogTableRow,
  CatalogTableColumnsFunc,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import { EntityLanguagePicker } from '../../filters/language.filter';
import Grid from '@material-ui/core/Grid';
import FilterListIcon from '@material-ui/icons/FilterList';
import ToggleButton from '@material-ui/lab/ToggleButton';

/**
 * Props for root catalog pages.
 *
 * @public
 */
export interface CatalogPageProps {
  initiallySelectedFilter?: UserListFilterKind;
  columns?: TableColumn<CatalogTableRow>[] | CatalogTableColumnsFunc;
  actions?: TableProps<CatalogTableRow>['actions'];
  initialKind?: string;
  tableOptions?: TableProps<CatalogTableRow>['options'];
  emptyContent?: ReactNode;
}

export type CatalogPluginOptions = {
  createButtonTitle: string;
};

const columnsWithoutSystem: CatalogTableColumnsFunc = ctx => {
  return CatalogTable.defaultColumnsFunc(ctx).filter(
    col => col.title !== 'System',
  );
};

export const CustomCatalogPage = ({
  columns = columnsWithoutSystem,
  actions,
  initiallySelectedFilter = 'owned',
  initialKind = 'component',
  tableOptions = {},
  emptyContent,
}: CatalogPageProps) => {
  const orgName =
    useApi(configApiRef).getOptionalString('organization.name') ?? 'Backstage';
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowFilters(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PageWithHeader title={`${orgName} Catalog`} themeId="home">
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
          <CreateButton title="Create Component" to="/create" />
          <SupportButton>All your software catalog entities</SupportButton>
        </ContentHeader>
        <EntityListProvider>
          <Grid container style={{ position: 'relative' }}>
            {showFilters && (
              <Grid item lg={2} xs={12}>
                <EntityKindPicker initialFilter={initialKind} />
                <EntityTypePicker />
                <UserListPicker initialFilter={initiallySelectedFilter} />
                <EntityOwnerPicker />
                <EntityLifecyclePicker />
                <EntityTagPicker />
                <EntityProcessingStatusPicker />
                <EntityNamespacePicker />
                <EntityLanguagePicker />
              </Grid>
            )}
            <Grid item xs={12} lg={showFilters ? 10 : 12}>
              <CatalogTable
                columns={columns}
                actions={actions}
                tableOptions={tableOptions}
                emptyContent={emptyContent}
              />
            </Grid>
          </Grid>
        </EntityListProvider>
      </Content>
    </PageWithHeader>
  );
};

// Bind the catalog plugin's rootRouteRef to this component so that
// Backstage's FlatRoutes can resolve `routeRef{id=catalog}` when
// EntityLayout calls useRouteRef internally (required in plugin-catalog ≥1.22)
attachComponentData(
  CustomCatalogPage,
  'core.mountPoint',
  catalogPlugin.routes.catalogIndex,
);
