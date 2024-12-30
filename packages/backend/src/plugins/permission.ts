import {
  AuthorizeResult,
  isResourcePermission,
  type PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  type PermissionPolicy,
  type PolicyQuery,
} from '@backstage/plugin-permission-node';
import { createCatalogConditionalDecision } from '@backstage/plugin-catalog-backend/alpha';
import {
  catalogEntityCreatePermission,
  catalogEntityDeletePermission,
  catalogEntityReadPermission,
  catalogEntityRefreshPermission,
  catalogEntityValidatePermission,
  RESOURCE_TYPE_CATALOG_ENTITY,
} from '@backstage/plugin-catalog-common/alpha';
import type { BackstageIdentityResponse } from '@backstage/plugin-auth-node';
import type { PaginatingEndpoints } from '@octokit/plugin-paginate-rest';
import { parseEntityRef } from '@backstage/catalog-model';
import {
  createBackendModule,
  type AuthService,
  type CacheService,
  type DiscoveryService,
  type LoggerService,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { coreServices } from '@backstage/backend-plugin-api';
import { Octokit } from 'octokit';
import * as _ from 'lodash';
import { RepositoryAccessCondition as repositoryAccessCondition } from '../premissions/repository.rule';

class RequestPermissionPolicy implements PermissionPolicy {
  readonly orgRepositories: Promise<
    PaginatingEndpoints['GET /orgs/{org}/repos']['response']['data']
  >;
  readonly catalogRepos: Promise<Set<string>>;
  readonly userRepoPermissions: Record<
    string,
    Record<string, ('admin' | 'write' | 'read' | 'none') | (string & {})>
  > = {};

  constructor(
    protected readonly tokenManager: AuthService,
    protected readonly discovery: DiscoveryService,
    protected readonly cache: CacheService,
    protected readonly octokit: Octokit,
    protected readonly logger: LoggerService,
  ) {
    // async operation is handled in resolver method
    this.orgRepositories = this.fetchOrganizationRepos(); // NOSONAR
    this.catalogRepos = this.fetchCatalog(); // NOSONAR
  }

  async handle(
    request: PolicyQuery,
    user?: BackstageIdentityResponse,
  ): Promise<PolicyDecision> {
    this.logger.debug('Permission request received', {
      requestedPermission: JSON.stringify(request),
    });

    if (!user?.identity) {
      this.logger.error('not able to found the name', {
        user: JSON.stringify(user),
      });
      return { result: AuthorizeResult.DENY };
    }

    const resolvedPermission = (
      await Promise.all([this.catalogPermissionHandler(request, user)])
    ).filter(c => c !== undefined);

    if (resolvedPermission.length > 1) {
      this.logger.error(
        'more than 1 permission got resolved in the decision, only one is allowed',
        { resolvedPermission: JSON.stringify(resolvedPermission) },
      );
    }

    if (resolvedPermission.length === 1) {
      return resolvedPermission.pop() as PolicyDecision;
    }

    this.logger.info("didn't received any handler for the policy request", {
      request: JSON.stringify(request, null, 2),
    });
    return { result: AuthorizeResult.ALLOW };
  }

  protected async fetchOrganizationRepos() {
    const startTimeBenchmark = performance.now();
    const out: PaginatingEndpoints['GET /orgs/{org}/repos']['response']['data'] =
      [];
    for await (const { data } of this.octokit.paginate.iterator(
      'GET /orgs/{org}/repos',
      {
        per_page: 100,
        org: String(process.env.GITHUB_ORGANIZATION),
      },
    )) {
      out.push(...data);
    }
    this.logger.info('***GithubRequest GET /orgs/{org}/repos', {});
    this.logger.debug('Github Repo List resolution benchmark', {
      totalTimeInMilliSeconds: startTimeBenchmark - performance.now(),
    });
    return out;
  }

  protected async fetchCatalog() {
    const base = await this.discovery.getBaseUrl('catalog');
    const { token } = await this.tokenManager.getPluginRequestToken({
      onBehalfOf: await this.tokenManager.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    const url = `${base}/entities?filter=kind=component`;

    const req = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    this.logger.info(
      '***CatalogRequest GET /entities?filter=kind=component',
      {},
    );
    const data = await req.json();
    // Get Name a repo name not the repo full_name
    return new Set<string>(
      data.map((cl: { metadata: { name: string } }) => cl.metadata.name),
    );
  }

  protected async fetchUserRole(userEntityRef: string) {
    const { name: username } = parseEntityRef(userEntityRef);

    const response = await this.octokit
      .request('GET /orgs/{org}/teams/{team_slug}/memberships/{username}', {
        org: String(process.env.GITHUB_ORGANIZATION),
        team_slug: String(process.env.REPO_CREATOR_TEAM),
        username,
      })
      .catch(e => {
        this.logger.debug('Issue while fetching details for the username', {
          error: JSON.stringify(e),
        });
      });

    this.logger.info(
      '***GithubRequest GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
      {
        org: String(process.env.GITHUB_ORGANIZATION),
        team_slug: String(process.env.REPO_CREATOR_TEAM),
      },
    );
    const ok = 200;
    if (
      response &&
      response.status === ok &&
      response.data.state === 'active'
    ) {
      return response.data.role ?? 'null';
    }

    return 'null';
  }

  protected async resolveAuthorizedRepoList(userEntityRef: string) {
    const usernameEntity = parseEntityRef(userEntityRef);
    const startTimeBenchmark = performance.now();

    if (userEntityRef in this.userRepoPermissions)
      return this.userRepoPermissions[userEntityRef];

    //! There can be case where user which is not valid get multiple time requests
    this.userRepoPermissions[userEntityRef] = {};
    const catalogRepos = await this.catalogRepos;
    const orgRepos = await this.orgRepositories;
    // Filtering out repo which is logged in the Catalog meta with just name of the repo
    const repositories = orgRepos.filter(r => catalogRepos.has(r.name));
    const userRole = await this.fetchUserRole(userEntityRef);

    if (['member', 'admin', 'maintainer'].includes(userRole)) {
      for (const repo of repositories) {
        this.userRepoPermissions[userEntityRef][repo.name] = 'write';
      }
    } else {
      for (const repos of _.chunk(repositories, 10)) {
        await Promise.all(
          repos.map(repo =>
            this.octokit.rest.repos
              .getCollaboratorPermissionLevel({
                owner: String(process.env.GITHUB_ORGANIZATION),
                repo: repo.name,
                username: usernameEntity.name,
              })
              .then(permission => {
                this.userRepoPermissions[userEntityRef][repo.name] =
                  permission.data.permission;
              })
              .catch(e => {
                //! Handling the issue of the missing repo if there is any issue
                this.logger.error("Issue while fetching user's permission", {
                  error: e,
                  owner: String(process.env.GITHUB_ORGANIZATION),
                  repo: repo.name,
                  userEntityRef,
                });
              })
              .finally(() => {
                this.logger.info(
                  '***GithubRequest GET /repos/{owner}/{repo}/collaborators/{username}/permission',
                  {
                    owner: String(process.env.GITHUB_ORGANIZATION),
                    repo: repo.name,
                  },
                );
              }),
          ),
        );
      }
    }

    this.logger.debug('Permission resolution benchmark', {
      totalTimeInMilliSeconds: startTimeBenchmark - performance.now(),
    });
    return this.userRepoPermissions[userEntityRef];
  }

  // Permission handlers
  protected async catalogPermissionHandler(
    request: PolicyQuery,
    user: BackstageIdentityResponse,
  ): Promise<PolicyDecision | undefined> {
    const currentOperation = {
      [catalogEntityReadPermission.name]: ['admin', 'write', 'read'],
      [catalogEntityCreatePermission.name]: ['admin', 'write'],
      [catalogEntityDeletePermission.name]: ['admin', 'write'],
      [catalogEntityRefreshPermission.name]: ['admin', 'write'],
      [catalogEntityValidatePermission.name]: ['admin', 'write'],
    }[request.permission.name];

    if (currentOperation === undefined) {
      this.logger.info('Non catalog permission type request received', {
        catalogEntityReadPermission: JSON.stringify(
          catalogEntityReadPermission,
        ),
        requestedPermission: JSON.stringify(request.permission),
      });
      return;
    }

    if (
      !isResourcePermission(request.permission, RESOURCE_TYPE_CATALOG_ENTITY)
    ) {
      this.logger.info(
        'Basic type permission will pass it as user have access atleast one repo',
        {
          user: user.identity.userEntityRef,
        },
      );
      return { result: AuthorizeResult.ALLOW };
    }

    const userRepoPermission = await this.resolveAuthorizedRepoList(
      user.identity.userEntityRef,
    );
    if (_.size(userRepoPermission) === 0) {
      // permission not resolved from the Github API
      this.logger.info(
        "Not able to fetch user Permission or Github didn't have repos for the user",
        {
          user: user.identity.userEntityRef,
          resolvedPermission: JSON.stringify(userRepoPermission),
        },
      );
      return { result: AuthorizeResult.DENY };
    }

    const repos = _.map(
      _.pickBy(userRepoPermission, permission =>
        currentOperation.includes(permission),
      ),
      (_, repo) => repo,
    );

    return createCatalogConditionalDecision(
      request.permission,
      repositoryAccessCondition({ repos }),
    );
  }
}

export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'permission-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        cache: coreServices.cache,
        policy: policyExtensionPoint,
        logger: coreServices.logger,
      },
      async init({ policy, cache, discovery, auth, logger }) {
        const octokit = new Octokit({
          auth: String(process.env.GITHUB_TOKEN),
          // in case of custom option for throttle follow below
          // https://github.com/octokit/plugin-throttling.js/#readme
          // throttle: {},
        });
        policy.setPolicy(
          new RequestPermissionPolicy(auth, discovery, cache, octokit, logger),
        );
      },
    });
  },
});
