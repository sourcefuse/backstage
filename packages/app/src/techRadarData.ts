import {
  TechRadarApi,
  TechRadarLoaderResponse,
  RadarRing,
  RadarQuadrant,
  RadarEntry,
  MovedState,
} from '@backstage-community/plugin-tech-radar';

/*
 * SourceFuse / ARC Tech Radar
 *
 * Quadrants  : Languages & Frameworks, Platforms & Infrastructure, Tools, Techniques
 * Rings      : ADOPT, TRIAL, ASSESS, HOLD
 *
 * Every entry includes a `description` (Markdown) so the radar detail panel
 * shows *why* a technology sits in its current ring.
 */

const rings: RadarRing[] = [
  {
    id: 'adopt',
    name: 'ADOPT',
    color: '#5BA300',
    description:
      'Technologies we have high confidence in. Battle-tested in production and recommended as a default choice.',
  },
  {
    id: 'trial',
    name: 'TRIAL',
    color: '#009EB0',
    description:
      'Worth pursuing. We have seen it work in projects and recommend teams try it on non-critical workloads.',
  },
  {
    id: 'assess',
    name: 'ASSESS',
    color: '#C7BA00',
    description:
      'Worth exploring. We are researching and prototyping to understand its fit for our stack.',
  },
  {
    id: 'hold',
    name: 'HOLD',
    color: '#E09B96',
    description:
      'Proceed with caution. Not recommended for new projects. Existing usage is being evaluated for migration.',
  },
];

const quadrants: RadarQuadrant[] = [
  { id: 'languages-frameworks', name: 'Languages & Frameworks' },
  { id: 'platforms-infrastructure', name: 'Platforms & Infrastructure' },
  { id: 'tools', name: 'Tools' },
  { id: 'techniques', name: 'Techniques' },
];

const entries: RadarEntry[] = [
  /* ═══════════════════════════════════════════════════════════════════════
   *  QUADRANT 1 — Languages & Frameworks
   * ═══════════════════════════════════════════════════════════════════════ */

  // ADOPT
  {
    key: 'typescript',
    id: 'typescript',
    title: 'TypeScript',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard language for all new SourceFuse services', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** TypeScript is our default language for both frontend and backend development. ' +
      'It provides compile-time safety, excellent IDE support, and is the foundation of our ARC monorepo.\n\n' +
      'All new microservices and frontend apps should be written in TypeScript unless there is a compelling reason otherwise.',
    links: [
      { url: 'https://www.typescriptlang.org/', title: 'TypeScript Docs' },
    ],
  },
  {
    key: 'nodejs',
    id: 'nodejs',
    title: 'Node.js',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Primary backend runtime', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Node.js is the standard runtime for SourceFuse backend services. ' +
      'Combined with TypeScript and LoopBack/NestJS, it powers the ARC microservices ecosystem.',
    links: [
      { url: 'https://nodejs.org/', title: 'Node.js' },
    ],
  },
  {
    key: 'react',
    id: 'react',
    title: 'React',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard UI framework', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** React is our primary frontend framework. All SourceFuse frontend applications, including this Backstage portal, are built on React. ' +
      'Its component model, hooks API, and ecosystem maturity make it the clear default.',
    links: [
      { url: 'https://react.dev/', title: 'React Docs' },
    ],
  },
  {
    key: 'nestjs',
    id: 'nestjs',
    title: 'NestJS',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'adopt', description: 'Adopted for new microservices', moved: MovedState.Up },
      { date: new Date('2023-06-01'), ringId: 'trial', description: 'Piloted on ARC services', moved: MovedState.Up },
    ],
    description:
      '**Why ADOPT:** NestJS provides a mature, opinionated framework for building server-side applications with TypeScript. ' +
      'Its modular architecture, dependency injection, and first-class OpenAPI support align well with ARC patterns.',
    links: [
      { url: 'https://nestjs.com/', title: 'NestJS' },
    ],
  },
  {
    key: 'loopback',
    id: 'loopback',
    title: 'LoopBack 4',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Core of ARC microservice framework', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** LoopBack 4 is the backbone of the ARC microservice framework. ' +
      'Its OpenAPI-first approach and extension architecture are deeply integrated into our service templates.',
    links: [
      { url: 'https://loopback.io/doc/en/lb4/', title: 'LoopBack 4 Docs' },
    ],
  },

  // TRIAL
  {
    key: 'nextjs',
    id: 'nextjs',
    title: 'Next.js',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'trial', description: 'Evaluating for SSR use cases', moved: MovedState.Up },
      { date: new Date('2024-01-15'), ringId: 'assess', description: 'Initial evaluation', moved: MovedState.NoChange },
    ],
    description:
      '**Why TRIAL:** Next.js offers server-side rendering and static-site generation with React. ' +
      'We are trialing it for customer-facing portals where SEO and initial load performance are critical.',
    links: [
      { url: 'https://nextjs.org/', title: 'Next.js' },
    ],
  },
  {
    key: 'python',
    id: 'python',
    title: 'Python',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'trial', description: 'Growing use in ML/data pipelines', moved: MovedState.NoChange },
    ],
    description:
      '**Why TRIAL:** Python is used for data engineering, ML model serving, and scripting. ' +
      'While not our primary app language, it is the right tool for data-intensive workloads.',
    links: [
      { url: 'https://www.python.org/', title: 'Python' },
    ],
  },

  // ASSESS
  {
    key: 'rust',
    id: 'rust',
    title: 'Rust',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Exploring for performance-critical services', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Rust offers memory safety without garbage collection and excellent performance. ' +
      'We are evaluating it for performance-critical microservices and CLI tooling.',
    links: [
      { url: 'https://www.rust-lang.org/', title: 'Rust' },
    ],
  },
  {
    key: 'deno',
    id: 'deno',
    title: 'Deno',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Watching Deno 2 for TS-native runtime', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Deno 2 brings native TypeScript execution and npm compatibility. ' +
      'We are watching whether it can simplify our toolchain for certain use cases.',
    links: [
      { url: 'https://deno.land/', title: 'Deno' },
    ],
  },

  // HOLD
  {
    key: 'angularjs',
    id: 'angularjs',
    title: 'AngularJS (1.x)',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'End of life — migrate to React', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** AngularJS 1.x reached end-of-life. Any remaining AngularJS codebases should be migrated to React. ' +
      'No new projects should use this framework.',
  },
  {
    key: 'jquery',
    id: 'jquery',
    title: 'jQuery',
    quadrant: 'languages-frameworks',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Not suitable for modern SPAs', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** jQuery served its purpose in a pre-framework era. Modern React applications should not introduce jQuery as a dependency.',
  },

  /* ═══════════════════════════════════════════════════════════════════════
   *  QUADRANT 2 — Platforms & Infrastructure
   * ═══════════════════════════════════════════════════════════════════════ */

  // ADOPT
  {
    key: 'aws',
    id: 'aws',
    title: 'AWS',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Primary cloud provider', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** AWS is our primary cloud provider. ECS, Lambda, RDS, S3, and CloudFront form the backbone of our production infrastructure.',
    links: [
      { url: 'https://aws.amazon.com/', title: 'AWS' },
    ],
  },
  {
    key: 'terraform',
    id: 'terraform',
    title: 'Terraform',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard IaC tool', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Terraform is our standard for infrastructure-as-code. All AWS resources are provisioned via Terraform modules managed in the ARC infra mono-repo.',
    links: [
      { url: 'https://www.terraform.io/', title: 'Terraform' },
    ],
  },
  {
    key: 'docker',
    id: 'docker',
    title: 'Docker',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Universal container format', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Docker containers are the standard deployment unit for all SourceFuse microservices, both in ECS and local development.',
  },
  {
    key: 'github-actions',
    id: 'github-actions',
    title: 'GitHub Actions',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard CI/CD pipeline', moved: MovedState.Up },
      { date: new Date('2023-01-15'), ringId: 'trial', description: 'Migrating from Jenkins', moved: MovedState.Up },
    ],
    description:
      '**Why ADOPT:** GitHub Actions is our CI/CD platform. Its tight integration with our GitHub-based workflow makes it the default for build, test, and deploy pipelines.',
    links: [
      { url: 'https://docs.github.com/en/actions', title: 'GitHub Actions Docs' },
    ],
  },
  {
    key: 'postgresql',
    id: 'postgresql',
    title: 'PostgreSQL',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Default relational database', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** PostgreSQL is the default relational database for ARC services. Its reliability, JSON support, and AWS RDS availability make it the standard choice.',
  },

  // TRIAL
  {
    key: 'kubernetes',
    id: 'kubernetes',
    title: 'Kubernetes / EKS',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'trial', description: 'Evaluating for complex workloads', moved: MovedState.NoChange },
    ],
    description:
      '**Why TRIAL:** While ECS covers most use cases, EKS/Kubernetes is being trialed for workloads that need more scheduling flexibility, multi-tenancy, or Helm-based deployments.',
    links: [
      { url: 'https://kubernetes.io/', title: 'Kubernetes' },
    ],
  },
  {
    key: 'redis',
    id: 'redis',
    title: 'Redis / ElastiCache',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'trial', description: 'Expanding caching and pub/sub usage', moved: MovedState.Up },
    ],
    description:
      '**Why TRIAL:** Redis (via ElastiCache) is proving effective for caching, session storage, and pub/sub. We are expanding its adoption across more services.',
  },

  // ASSESS
  {
    key: 'opentofu',
    id: 'opentofu',
    title: 'OpenTofu',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Watching as Terraform alternative', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** OpenTofu is an open-source fork of Terraform. We are monitoring its maturity and community adoption as a potential long-term alternative.',
    links: [
      { url: 'https://opentofu.org/', title: 'OpenTofu' },
    ],
  },
  {
    key: 'pulumi',
    id: 'pulumi',
    title: 'Pulumi',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Exploring IaC-in-code approach', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Pulumi lets teams write IaC in TypeScript/Python instead of HCL. We are exploring whether this improves developer productivity for complex infra.',
    links: [
      { url: 'https://www.pulumi.com/', title: 'Pulumi' },
    ],
  },

  // HOLD
  {
    key: 'jenkins',
    id: 'jenkins',
    title: 'Jenkins',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Migrating to GitHub Actions', moved: MovedState.Down },
      { date: new Date('2023-01-15'), ringId: 'adopt', description: 'Primary CI server', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** Jenkins served us well but maintenance overhead is high. We are actively migrating all pipelines to GitHub Actions. No new Jenkins pipelines should be created.',
  },
  {
    key: 'cloudformation',
    id: 'cloudformation',
    title: 'CloudFormation',
    quadrant: 'platforms-infrastructure',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Standardized on Terraform instead', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** CloudFormation is AWS-only and lacks the multi-provider ecosystem of Terraform. Existing stacks should be migrated to Terraform modules.',
  },

  /* ═══════════════════════════════════════════════════════════════════════
   *  QUADRANT 3 — Tools
   * ═══════════════════════════════════════════════════════════════════════ */

  // ADOPT
  {
    key: 'backstage',
    id: 'backstage',
    title: 'Backstage',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Internal developer portal', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Backstage (this portal!) is our standard internal developer platform. It unifies service catalog, docs, scaffolding, and CI/CD visibility in one place.',
    links: [
      { url: 'https://backstage.io/', title: 'Backstage' },
    ],
  },
  {
    key: 'eslint',
    id: 'eslint',
    title: 'ESLint',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard linter for JS/TS', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** ESLint is our standard linting tool. Shared configs enforce consistent code style across all SourceFuse TypeScript repositories.',
  },
  {
    key: 'prettier',
    id: 'prettier',
    title: 'Prettier',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard code formatter', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Prettier eliminates formatting debates. All projects use a shared Prettier config for consistent code formatting.',
  },
  {
    key: 'sonarqube',
    id: 'sonarqube',
    title: 'SonarQube',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Standard code quality gate', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** SonarQube provides automated code quality and security analysis. It is integrated into our CI pipelines as a quality gate.',
  },

  // TRIAL
  {
    key: 'nx',
    id: 'nx',
    title: 'Nx',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'trial', description: 'Evaluating for monorepo management', moved: MovedState.Up },
      { date: new Date('2024-01-15'), ringId: 'assess', description: 'Initial assessment', moved: MovedState.NoChange },
    ],
    description:
      '**Why TRIAL:** Nx provides smart build caching and task orchestration for monorepos. We are trialing it to speed up CI for our larger repositories.',
    links: [
      { url: 'https://nx.dev/', title: 'Nx' },
    ],
  },
  {
    key: 'claude-code',
    id: 'claude-code',
    title: 'Claude Code (AI)',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2025-01-15'), ringId: 'trial', description: 'AI-assisted development', moved: MovedState.Up },
    ],
    description:
      '**Why TRIAL:** Claude Code (Anthropic) is being trialed as an AI-powered development assistant for code generation, review, and debugging tasks.',
    links: [
      { url: 'https://claude.ai/', title: 'Claude' },
    ],
  },

  // ASSESS
  {
    key: 'biome',
    id: 'biome',
    title: 'Biome',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Fast all-in-one linter/formatter', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Biome combines linting and formatting in a single fast tool written in Rust. We are assessing if it can replace ESLint + Prettier in our toolchain.',
    links: [
      { url: 'https://biomejs.dev/', title: 'Biome' },
    ],
  },
  {
    key: 'opentelemetry',
    id: 'opentelemetry',
    title: 'OpenTelemetry',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Unified observability standard', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** OpenTelemetry provides vendor-neutral telemetry collection. We are exploring it to unify tracing, metrics, and logging across services.',
    links: [
      { url: 'https://opentelemetry.io/', title: 'OpenTelemetry' },
    ],
  },

  // HOLD
  {
    key: 'tslint',
    id: 'tslint',
    title: 'TSLint',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Deprecated — use ESLint', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** TSLint has been officially deprecated in favor of ESLint with TypeScript support. Any remaining TSLint configs should be migrated.',
  },
  {
    key: 'lerna',
    id: 'lerna',
    title: 'Lerna',
    quadrant: 'tools',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'hold', description: 'Evaluating Nx as replacement', moved: MovedState.Down },
    ],
    description:
      '**Why HOLD:** Lerna maintenance has been inconsistent. For monorepo tooling, Nx or native Yarn/npm workspaces are preferred for new projects.',
  },

  /* ═══════════════════════════════════════════════════════════════════════
   *  QUADRANT 4 — Techniques
   * ═══════════════════════════════════════════════════════════════════════ */

  // ADOPT
  {
    key: 'code-reviews',
    id: 'code-reviews',
    title: 'Code Reviews',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Mandatory for all PRs', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** All pull requests require at least one code review. This is non-negotiable for code quality, knowledge sharing, and catching defects early.',
  },
  {
    key: 'trunk-based',
    id: 'trunk-based',
    title: 'Trunk-Based Development',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Short-lived branches, frequent merges', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** We practice trunk-based development with short-lived feature branches. This reduces merge conflicts and enables continuous delivery.',
  },
  {
    key: 'docs-as-code',
    id: 'docs-as-code',
    title: 'Docs-as-Code',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'TechDocs in Backstage', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** Documentation lives alongside code in Markdown/MkDocs, versioned in Git, and published through Backstage TechDocs. This keeps docs fresh and reviewable.',
  },
  {
    key: 'openapi-first',
    id: 'openapi-first',
    title: 'API-First Design (OpenAPI)',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'adopt', description: 'Design APIs before implementation', moved: MovedState.NoChange },
    ],
    description:
      '**Why ADOPT:** All REST APIs are designed OpenAPI-first. The spec drives code generation, documentation, and client SDKs. This ensures consistency and discoverability.',
    links: [
      { url: 'https://swagger.io/specification/', title: 'OpenAPI Spec' },
    ],
  },

  // TRIAL
  {
    key: 'feature-flags',
    id: 'feature-flags',
    title: 'Feature Flags',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'trial', description: 'Controlled rollouts', moved: MovedState.NoChange },
    ],
    description:
      '**Why TRIAL:** Feature flags enable gradual rollouts and kill-switches for new functionality. We are integrating flag management into our deployment workflow.',
  },
  {
    key: 'adrs',
    id: 'adrs',
    title: 'Architecture Decision Records',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'trial', description: 'Documenting architectural decisions', moved: MovedState.Up },
    ],
    description:
      '**Why TRIAL:** ADRs capture the context and reasoning behind significant architectural choices. We are rolling them out across teams to improve decision transparency.',
  },

  // ASSESS
  {
    key: 'design-tokens',
    id: 'design-tokens',
    title: 'Design Tokens',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-09-01'), ringId: 'assess', description: 'Standardizing UI design language', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Design tokens provide a single source of truth for colors, spacing, and typography across web and native platforms. We are evaluating tooling and workflows.',
  },
  {
    key: 'event-driven',
    id: 'event-driven',
    title: 'Event-Driven Architecture',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-06-01'), ringId: 'assess', description: 'Evaluating for decoupled services', moved: MovedState.NoChange },
    ],
    description:
      '**Why ASSESS:** Event-driven patterns (SNS/SQS, EventBridge) can decouple services and improve resilience. We are assessing where asynchronous messaging adds value.',
  },

  // HOLD
  {
    key: 'force-push-master',
    id: 'force-push-master',
    title: 'Force Push to Main',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Blocked by branch protection', moved: MovedState.NoChange },
    ],
    description:
      '**Why HOLD:** Force-pushing to main is prohibited. Branch protection rules enforce this. Rewriting shared history causes data loss and team disruption.',
  },
  {
    key: 'manual-deployments',
    id: 'manual-deployments',
    title: 'Manual Deployments',
    quadrant: 'techniques',
    timeline: [
      { date: new Date('2024-01-15'), ringId: 'hold', description: 'Automate via CI/CD', moved: MovedState.Down },
    ],
    description:
      '**Why HOLD:** Manual SSH-and-deploy workflows are error-prone and unrepeatable. All deployments should go through automated CI/CD pipelines.',
  },
];

export class SourceFuseTechRadarApi implements TechRadarApi {
  async load(_id: string | undefined): Promise<TechRadarLoaderResponse> {
    return { quadrants, rings, entries };
  }
}
