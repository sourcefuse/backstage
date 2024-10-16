import {
  AuthorizeResult,
  isPermission,
  type PolicyDecision,
} from '@backstage/plugin-permission-common';
import type {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';
import {
  catalogConditions,
  createCatalogConditionalDecision,
} from '@backstage/plugin-catalog-backend/alpha';
import { catalogEntityReadPermission } from '@backstage/plugin-catalog-common/alpha';
import type { BackstageIdentityResponse } from '@backstage/plugin-auth-node';
import type { PaginatingEndpoints } from '@octokit/plugin-paginate-rest';
import { parseEntityRef } from '@backstage/catalog-model';
import {
  createBackendModule,
  type AuthService,
  type CacheService,
  type DiscoveryService,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { coreServices } from '@backstage/backend-plugin-api';
import { Octokit } from 'octokit';

class RequestPermissionPolicy implements PermissionPolicy {
  readonly orgRepositories: Promise<
    PaginatingEndpoints['GET /orgs/{org}/repos']['response']['data']
  >;
  readonly catalogRepos: Promise<Set<string>>;
  readonly userRepoPermissions: Record<string, Array<string>> = {};

  constructor(
    protected readonly tokenManager: AuthService,
    protected readonly discovery: DiscoveryService,
    protected readonly cache: CacheService,
    protected readonly octokit: Octokit,
  ) {
    this.orgRepositories = this.fetchOrganizationRepos();
    this.catalogRepos = this.fetchCatalog();
  }

  async handle(
    request: PolicyQuery,
    user?: BackstageIdentityResponse,
  ): Promise<PolicyDecision> {
    console.debug(request);
    console.time('*********************Permission Validation**************');
    if (!user?.identity) {
      console.error('not able to found the name', user);
      return { result: AuthorizeResult.DENY };
    }

    const userPermission = await this.resolveAuthorizedRepoList(
      user.identity.userEntityRef,
    );

    if (
      userPermission.length &&
      isPermission(request.permission, catalogEntityReadPermission)
    ) {
      console.timeEnd(
        '*********************Permission Validation**************',
      );

      return createCatalogConditionalDecision(request.permission, {
        //@ts-ignore
        anyOf: userPermission.map(value =>
          //@ts-ignore
          catalogConditions.hasMetadata({ key: 'name', value }),
        ),
      });
    }
    console.timeEnd('*********************Permission Validation**************');

    return { result: AuthorizeResult.ALLOW };
  }

  protected async fetchOrganizationRepos() {
    console.time('******************Github OrgRepoList*******');
    const out: PaginatingEndpoints['GET /orgs/{org}/repos']['response']['data'] =
      [];
    for await (const { data } of this.octokit.paginate.iterator(
      'GET /orgs/{org}/repos',
      {
        per_page: 100,
        org: String(process.env.GITHUB_ORGANIZATION),
      },
    )) {
      //! will use status or header to validate success
      out.push(...data);
    }
    console.timeEnd('******************Github OrgRepoList*******');
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
    const data = await req.json();
    // Get Name a repo name not the repo full_name
    return new Set<string>(data.map((cl: any) => cl.metadata.name));
  }

  protected async resolveAuthorizedRepoList(userEntityRef: string) {
    const usernameEntity = parseEntityRef(userEntityRef);

    if (!(userEntityRef in this.userRepoPermissions)) {
      const batch = [];
      this.userRepoPermissions[userEntityRef] = [];
      const catalogRepos = await this.catalogRepos;
      const orgRepos = await this.orgRepositories;
      // Filtering out repo which is logged in the Catalog meta with just name of the repo
      const repositories = orgRepos.filter(r => catalogRepos.has(r.name));
      const privateCatalogRepos = repositories.filter(r => r.private);
      const publicCatalogRepos = repositories.filter(r => r.private === false);
      for (const repo of publicCatalogRepos) {
        this.userRepoPermissions[userEntityRef].push(repo.name);
      }

      for (const repo of privateCatalogRepos) {
        batch.push(
          this.octokit.rest.repos
            .getCollaboratorPermissionLevel({
              owner: String(process.env.GITHUB_ORGANIZATION),
              repo: repo.name,
              username: usernameEntity.name,
            })
            .then(resp => ({
              repo,
              ...resp.data,
            })),
          //! need to add header check
        );
        if (batch.length > 10) {
          const permissions = await Promise.all(batch);
          for (const permission of permissions) {
            this.userRepoPermissions[userEntityRef].push(permission.repo.name);
          }
          batch.length = 0;
        }
      }
      //! log any meta name which is not include that means there is issue in the meta name
    }

    return this.userRepoPermissions[userEntityRef];
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
      },
      async init({ policy, cache, discovery, auth }) {
        const octokit = new Octokit({
          auth: String(process.env.GITHUB_TOKEN),
          // throttle: {},
        });
        policy.setPolicy(
          new RequestPermissionPolicy(auth, discovery, cache, octokit),
        );
      },
    });
  },
});
