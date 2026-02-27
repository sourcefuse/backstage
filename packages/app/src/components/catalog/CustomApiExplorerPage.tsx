import React, { useState, useEffect } from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Grid from '@material-ui/core/Grid';
import FilterListIcon from '@material-ui/icons/FilterList';
import ToggleButton from '@material-ui/lab/ToggleButton';
import {
  Content,
  ContentHeader,
  CreateButton,
  PageWithHeader,
  SupportButton,
  TableColumn,
} from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  EntityListProvider,
  EntityTypePicker,
  UserListPicker,
  EntityOwnerPicker,
  EntityLifecyclePicker,
  EntityTagPicker,
  EntityKindPicker,
} from '@backstage/plugin-catalog-react';
import {
  CatalogTable,
  CatalogTableRow,
} from '@backstage/plugin-catalog';

/** Try to extract info.version from an OpenAPI / AsyncAPI JSON or YAML definition. */
function parseApiVersion(definition?: string): string {
  if (!definition) return '';
  // Try JSON first
  try {
    const parsed = JSON.parse(definition);
    if (parsed?.info?.version) return String(parsed.info.version);
  } catch {
    // not JSON — try simple YAML regex
  }
  // Simple YAML extraction: look for   version: <value> under info:
  const versionMatch = definition.match(
    /info:\s*\n(?:.*\n)*?\s+version:\s*['"]?([^\s'"#]+)/,
  );
  if (versionMatch?.[1]) return versionMatch[1];
  // Also handle "openapi: 3.x" / "asyncapi: 2.x" top-level as a last-resort fallback
  const specVersionMatch = definition.match(
    /^(?:openapi|asyncapi|swagger):\s*['"]?([^\s'"#]+)/m,
  );
  if (specVersionMatch?.[1]) return `spec ${specVersionMatch[1]}`;
  return '';
}

/** Custom columns for the API explorer table. */
const apiColumns: TableColumn<CatalogTableRow>[] = [
  CatalogTable.columns.createTitleColumn({ hidden: true }),
  CatalogTable.columns.createNameColumn({ defaultKind: 'API' }),
  CatalogTable.columns.createSystemColumn(),
  CatalogTable.columns.createOwnerColumn(),
  CatalogTable.columns.createSpecTypeColumn(),
  CatalogTable.columns.createSpecLifecycleColumn(),
  // API version — parsed from spec.definition
  {
    title: 'Version',
    field: 'entity.spec.definition',
    render: (row: CatalogTableRow) => {
      const ver = parseApiVersion(
        (row.entity.spec as Record<string, unknown>)?.definition as string,
      );
      return <>{ver || '-'}</>;
    },
    width: '100px',
  },
  // Description with tooltip
  {
    title: 'Description',
    field: 'entity.metadata.description',
    render: (row: CatalogTableRow) => {
      const desc = row.entity.metadata?.description || '';
      if (desc.length <= 60) return <>{desc}</>;
      return (
        <Tooltip title={desc} arrow enterDelay={300}>
          <span
            style={{
              display: 'block',
              maxWidth: 320,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {desc}
          </span>
        </Tooltip>
      );
    },
  },
  CatalogTable.columns.createTagsColumn(),
];

export const CustomApiExplorerPage = () => {
  const orgName =
    useApi(configApiRef).getOptionalString('organization.name') ?? 'Backstage';
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowFilters(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PageWithHeader
      themeId="apis"
      title="APIs"
      subtitle={`${orgName} API Explorer`}
    >
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
          <CreateButton title="Create New API" to="/create" />
          <CreateButton title="Register Existing API" to="/catalog-import" />
          <SupportButton>Discover and manage APIs across your organization</SupportButton>
        </ContentHeader>
        <EntityListProvider>
          <Grid container style={{ position: 'relative' }}>
            {showFilters && (
              <Grid item lg={2} xs={12}>
                <EntityKindPicker initialFilter="api" hidden />
                <EntityTypePicker />
                <UserListPicker initialFilter="all" />
                <EntityOwnerPicker />
                <EntityLifecyclePicker />
                <EntityTagPicker />
              </Grid>
            )}
            <Grid item xs={12} lg={showFilters ? 10 : 12}>
              <CatalogTable
                columns={apiColumns}
                tableOptions={{ search: true }}
              />
            </Grid>
          </Grid>
        </EntityListProvider>
      </Content>
    </PageWithHeader>
  );
};
