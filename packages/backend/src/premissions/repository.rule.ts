import type { Entity } from '@backstage/catalog-model';
import { z } from 'zod';
import { createCatalogPermissionRule } from '@backstage/plugin-catalog-backend/alpha';
import { createConditionFactory } from '@backstage/plugin-permission-node';

export const isHaveRepositoryAccess = createCatalogPermissionRule({
  name: 'IS_HAVE_REPO_ACCESS',
  description: 'Checks if entity have repository access',
  resourceType: 'catalog-entity',
  paramsSchema: z.object({
    repos: z.string().array().describe('name of repositories to check'),
  }),
  apply: (resource: Entity, { repos }) => {
    if (!resource.relations) {
      return false;
    }

    return resource.relations
      .filter(relation => relation.type === 'partOf')
      .some(relation => repos.includes(relation.targetRef));
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
