# Stage 1 - Create yarn install skeleton layer
FROM node:18 AS packages

WORKDIR /app
COPY package.json yarn.lock ./

COPY packages packages
# Comment this out if you don't have any internal plugins
#COPY plugins plugins

RUN find packages \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} \+

# Stage 2 - Install dependencies and build packages
FROM node:18 AS build

ARG BASE_URL="http://localhost:7007"
ARG FRONTEND_BASE_URL="http://localhost:7007"

WORKDIR /app
COPY --from=packages /app .
RUN apt-get update -y && apt-get install software-properties-common make gcc g++ -y
RUN yarn install --frozen-lockfile --network-timeout 600000 && rm -rf "$(yarn cache dir)"

COPY . .

RUN yarn tsc
RUN yarn --cwd packages/backend backstage-cli package build

# Stage 3 - Build the actual backend image and install production dependencies
FROM node:18-buster-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git libsqlite3-dev python3 python3-pip build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    yarn config set python /usr/bin/python3
RUN pip3 install --upgrade setuptools wheel
RUN pip3 install mkdocs-techdocs-core==1.0.1

# Copy the install dependencies from the build stage and context
COPY --from=build /app/yarn.lock /app/package.json /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN yarn install --frozen-lockfile --production --network-timeout 600000 && rm -rf "$(yarn cache dir)"

# Copy the built packages from the build stage
COPY --from=build /app/packages/backend/dist/bundle.tar.gz .
COPY --from=build /app/packages/backend/src/workers /app/packages/backend/workers
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

# Copy any other files that we need at runtime
COPY app-config.yaml ./

CMD ["node", "packages/backend", "--config", "app-config.yaml"]