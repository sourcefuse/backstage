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
    configApiRef,
    useApi,
  } from '@backstage/core-plugin-api';
  import {
    CatalogFilterLayout,
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
  import React, { ReactNode } from 'react';
  import { CatalogTable, CatalogTableRow } from '@backstage/plugin-catalog';
import { EntityLanguagePicker } from '../../filters/language.filter';

  /**
   * Props for root catalog pages.
   *
   * @public
   */
  export interface CatalogPageProps {
    initiallySelectedFilter?: UserListFilterKind;
    columns?: TableColumn<CatalogTableRow>[];
    actions?: TableProps<CatalogTableRow>['actions'];
    initialKind?: string;
    tableOptions?: TableProps<CatalogTableRow>['options'];
    emptyContent?: ReactNode;
  }
  export type CatalogPluginOptions = {
    createButtonTitle: string;
  };

  export const CustomCatalogPage = ({
      columns,
      actions,
      initiallySelectedFilter = 'owned',
      initialKind = 'component',
      tableOptions = {},
      emptyContent,
    }: CatalogPageProps) => {
    const orgName =
      useApi(configApiRef).getOptionalString('organization.name') ?? 'Backstage';

    return (
      <PageWithHeader title={`${orgName} Catalog`} themeId="home">
        <Content>
          <ContentHeader title="Create Component">
            <CreateButton
              title='Create Component'
              to='/create'
            />
            <SupportButton>All your software catalog entities</SupportButton>
          </ContentHeader>
          <EntityListProvider>
            <CatalogFilterLayout>
              <CatalogFilterLayout.Filters>
                <EntityKindPicker initialFilter={initialKind} />
                <EntityTypePicker />
                <UserListPicker initialFilter={initiallySelectedFilter} />
                <EntityOwnerPicker />
                <EntityLifecyclePicker />
                <EntityTagPicker />
                <EntityProcessingStatusPicker />
                <EntityNamespacePicker />
                <EntityLanguagePicker />
              </CatalogFilterLayout.Filters>
              <CatalogFilterLayout.Content>
                <CatalogTable
                  columns={columns}
                  actions={actions}
                  tableOptions={tableOptions}
                  emptyContent={emptyContent}
                />
              </CatalogFilterLayout.Content>
            </CatalogFilterLayout>
          </EntityListProvider>
        </Content>
      </PageWithHeader>
    );
  }
