# Backstage Portal — Claude Instructions

## Do NOT read the entire codebase at startup
Only read files that are directly relevant to the current task. Use Grep/Glob to find specific files before reading them.

## Project Overview
This is a Backstage v1.48.2 instance running on EC2 (Ubuntu) with Nginx serving at `http://sf-portal.sourcef.us`.

- **Frontend**: `packages/app/` — React, TypeScript, Material-UI
- **Backend**: `packages/backend/` — Node.js on port 7007
- **Database**: PostgreSQL on localhost:5432
- **Node version required**: 22 (`nvm use 22`)

## Key Files (read only when needed)
- `app-config.yaml` — Backstage config
- `.env.local` — Environment variables
- `packages/app/src/components/aws/AwsCostEntityTab.tsx` — AWS tab (ECS, Lambda, EC2, S3, RDS, CloudFront, OpenSearch)
- `packages/backend/src/plugins/aws-cost-settings.ts` — AWS backend API routes
- `packages/app/src/components/catalog/EntityPage.tsx` — Entity page tab layout
- `packages/app/src/components/tab-settings/` — Tab visibility settings

## Build & Deploy
```bash
source ~/.nvm/nvm.sh && nvm use 22
export $(grep -v '^#' .env.local | grep -v '^$' | xargs -d '\n')
yarn workspace app build
# Backend restart:
# Kill existing process and re-run start-dev.sh
```

## Coding Conventions
- Material-UI v4 (`@material-ui/core`) — NOT MUI v5
- Inline styles (no CSS modules or styled-components)
- Backend uses `aws-sdk` v2 (not v3)
- Auth policy: `allow: 'unauthenticated'` for all AWS plugin routes
- State management: React hooks only (no Redux)

## AWS Plugin Architecture
- Config stored in `plugin_aws_cost_entity_settings` Postgres table
- Backend credentials: `makeCredentials(row)` helper using stored access key/secret
- Frontend fetches from `discoveryApi.getBaseUrl('aws-cost-settings')`

## Plugins Installed
- Announcements: `@backstage-community/plugin-announcements@2.3.0`
- Jenkins (custom tab)
- Jira (custom tab)
- AWS Cost/Resources (custom plugin)
