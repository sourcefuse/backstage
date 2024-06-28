# [Backstage](https://backstage.io)
This is the SourceFuse ARC Backstage implementation. It comes packaged with
- GitHub integration for authentication and authorization
- ARC Templates for
  - Microservices
  - Lambdas
  - IaC
  - UI
  - Reference architectures of example apps, i.e. telemedecine applications


## Getting Started
We rely on `nvm` for Node Version Management and `yarn` for package management.
```shell
nvm install
yarn install
npm run build:all
```

## Local Environment Configuration
Create a file named `.env.local`. Populate the values below with the ones appropriate for your GitHub organization.
```text
BASE_URL='http://localhost:7007'
FRONTEND_BASE_URL='http://localhost:3000'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
AUTH_GITHUB_CLIENT_ID=GitHub app client_id
AUTH_GITHUB_CLIENT_SECRET=GitHub app client secret
PGADMIN_DEFAULT_EMAIL=pgadmin4@pgadmin.org
PGADMIN_DEFAULT_PASSWORD=admin
PGADMIN_PORT=5050
PGADMIN_LISTEN_ADDRESS=0.0.0.0
INTEGRATION_GITHUB_APP_ID=GitHub app App ID
INTEGRATION_GITHUB_WEBHOOK_URL=https://smee.io/pvDM8sHcDxmhMLvfxax
ENABLE_GITHUB_SYNC=Set true or false if you want to sync with github
INTEGRATION_GITHUB_CLIENT_ID=GitHub app client_id
INTEGRATION_GITHUB_CLIENT_SECRET=GitHub app client secret
INTEGRATION_GITHUB_WEBHOOK_SECRET=GitHub app webhook secret
AWS_ACCOUNT_ID=AWS Account ID to Push the Image
IMAGE_TAG=Tag for the Docker Image
REPO_CREATOR_TEAM=Github team having scaffolding access
GITHUB_ORGANIZATION=Github organization
```

Load the variables into a shell session for ease.

```shell
export $(cat .env.local | xargs)
```
Copy the cert into a file named `github_private_key.pem` in the root of the project. Load the certificate into your shell session.

```shell
export INTEGRATION_GITHUB_PRIVATE_KEY=`cat ./github_private_key.pem`
```
Run the entire stack in Docker.
```shell
docker-compose up --build
```

You can also specify the environment file, just be sure to handle the formatting of the RSA private key correctly.
```shell
docker-compose --env-file=.env.local up --build
```
