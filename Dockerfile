# Stage 1 - Create yarn install skeleton layer
FROM node:20 AS packages
RUN yarn config set unsafe-perm true

WORKDIR /app
COPY package.json yarn.lock ./

COPY packages packages
COPY patches patches
# Comment this out if you don't have any internal plugins
COPY plugins plugins

RUN find packages \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} \+
RUN find plugins \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} \+

# Stage 2 - Build the actual backend image and install production dependencies
FROM nikolaik/python-nodejs:python3.10-nodejs20-slim

WORKDIR /app

ARG baseUrl="http://localhost:7007"

RUN apt-get update && \
    apt-get install -y --no-install-recommends git libsqlite3-dev build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    yarn config set python /usr/bin/python3 && \
    pip3 install --upgrade setuptools wheel && \
    pip3 install mkdocs-techdocs-core==1.0.1 && \
    pip3 install mkdocs mkdocs-include-markdown-plugin mkdocs-awesome-pages-plugin

# Copy skeleton (package.json files only) and install production dependencies
COPY --from=packages /app .
COPY ./plugins ./plugins
RUN yarn install --ignore-engines --network-timeout 600000 && rm -rf "$(yarn cache dir)"
COPY ./patches ./patches

RUN yarn run postinstall

# Copy pre-built plugin dist folders (plugins were built locally/in CI)
COPY plugins/access-validate-backend/dist ./plugins/access-validate-backend/dist
COPY plugins/jenkins-with-reporting/dist ./plugins/jenkins-with-reporting/dist
COPY plugins/jenkins-with-reporting-backend-backend/dist ./plugins/jenkins-with-reporting-backend-backend/dist
COPY plugins/validate-access-backend/dist ./plugins/validate-access-backend/dist

# CRITICAL FIX: Force yarn to verify and reinstall missing AWS SDK packages
# Use --check-files to detect missing packages without triggering unnecessary rebuilds
RUN yarn install --check-files --ignore-engines --network-timeout 600000 && rm -rf "$(yarn cache dir)"

# Verify critical dependencies are installed
RUN echo "=== Checking AWS SDK packages ===" && \
    ls -la node_modules/@aws-sdk/ | head -30 && \
    echo "=== Searching for all client-* packages ===" && \
    find node_modules/@aws-sdk -maxdepth 1 -type d -name "client-*" | sort && \
    echo "=== Checking specific packages ===" && \
    for pkg in client-cloudwatch client-cost-explorer client-ecs client-lambda; do \
      if [ -d "node_modules/@aws-sdk/$pkg" ]; then \
        echo "✓ @aws-sdk/$pkg FOUND"; \
      else \
        echo "✗ @aws-sdk/$pkg MISSING"; \
      fi; \
    done

# Clean up TypeScript source files from plugins to prevent runtime import errors
RUN find plugins -type d -name "src" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules/@internal -type d -name "src" -exec rm -rf {} + 2>/dev/null || true

# Copy pre-built backend bundle (output of backstage-cli package build)
COPY packages/backend/dist ./packages/backend/dist

# Copy pre-built frontend app (served by app-backend plugin)
COPY packages/app/dist ./packages/app/dist

# Copy any other files that we need at runtime
COPY app-config.yaml app-config.production.yaml docker-entrypoint.sh ./
COPY ./catalog ./catalog
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
