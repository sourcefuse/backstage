import type { Entity } from '@backstage/catalog-model';
import { z } from 'zod';
import { createCatalogPermissionRule } from '@backstage/plugin-catalog-backend/alpha';
import { createConditionFactory, createPermissionRule } from '@backstage/plugin-permission-node';
import {  createCatalogConditionalDecision, catalogConditions } from '@backstage/plugin-catalog-backend/alpha';
import catalogEntityPermissionResourceRef from "@backstage/plugin-catalog-backend/alpha";
// export const isHaveRepositoryAccess = createCatalogPermissionRule({
  export const isHaveRepositoryAccess = createPermissionRule({
    
  name: 'IS_HAVE_REPO_ACCESS',
  description: 'Checks if entity have repository access',
  // resourceRef: catalogEntityPermissionResourceRef,
  resourceType: 'catalog-entity',
  paramsSchema: z.object({
    repos: z.string().array().describe('name of repositories to check'),
  }),
  // apply: (resource: Entity, { repos }) => {
  //   console.log('resource:___((((((((*******************************', resource, JSON.stringify(resource));
  //   if (!resource.relations) {
  //     return false;
  //   }

  //   return resource.relations
  //     .filter(relation => relation.type === 'partOf')
  //     .some(relation => repos.includes(relation.targetRef));
  // },
  apply: (entity: Entity, { repos }) => {
    const repoUrl = entity.metadata.annotations?.['backstage.io/source-location'];
    const name = repoUrl?.match(/github\.com\/([^/]+)\/(.+?)(\.git)?$/)?.[2];
    return name ? repos.includes(name) : false;
  },
  toQuery: ({ repos }) => {
    // it will add sql query to check repo or all the templates
    // "metadata.name" in ["repoName"] or kind in ['template']
    return {
      anyOf: [
        {
          key: 'metadata.name',
          values: repos,
        },
        {
          // Skip from the check it will allow all the templates
          key: 'kind',
          values: ['template'],
        },
      ],
    };
  },
});
export const RepositoryAccessCondition = createConditionFactory(
  isHaveRepositoryAccess,
);
