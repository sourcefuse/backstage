#!/bin/bash

set -e

# Optional
: "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"
: "${ENVIRONMENT:=poc}"

# Required
: "${DOCKERHUB_USERNAME:-$DOCKERHUB_USERNAME}"
: "${DOCKERHUB_TOKEN:-$DOCKERHUB_TOKEN}"
: "${IMAGE_TAG:-$IMAGE_TAG}"

DOCKER_REGISTRY="docker.io"
IMAGE_NAME="sourcefuse/backstage"

echo "Docker Registry: $DOCKER_REGISTRY"

printf "\nLogging in to Docker Hub...\n"
# echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
docker login -u "$DOCKERHUB_USERNAME" -p "$DOCKERHUB_TOKEN"


printf "\nBuilding docker images...\n"
docker-compose -f $DOCKER_COMPOSE_FILE build

printf "\nTagging image $IMAGE_NAME:$IMAGE_TAG...\n"
docker tag sourcefuse/backstage:latest $IMAGE_NAME:$IMAGE_TAG

printf "\nPushing $IMAGE_NAME:$IMAGE_TAG to Docker Hub...\n"
docker push $IMAGE_NAME:$IMAGE_TAG

# printf "\nAdding $IMAGE_NAME:$IMAGE_TAG to SSM Parameter...\n"
# aws ssm put-parameter \
#   --name "/${ENVIRONMENT}/backstage/container-image" \
#   --description "Container image reference for downstream deployments" \
#   --value "$IMAGE_NAME:$IMAGE_TAG" \
#   --type String \
#   --overwrite

# echo "::set-output name=image::$IMAGE_NAME:$IMAGE_TAG"
