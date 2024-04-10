#!/bin/bash

set -e

# Optional
: "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"
: "${ENVIRONMENT:=poc}"

# Required
: "${DOCKER_USERNAME:=$DOCKERHUB_USERNAME}"
: "${DOCKER_PASSWORD:=$DOCKERHUB_TOKEN}"
: "${IMAGE_TAG:-$IMAGE_TAG}"

DOCKER_REGISTRY="docker.io"
IMAGE_NAME="$DOCKER_USERNAME/backstage"

printf "\nLogging in to Docker Hub... -u $DOCKER_USERNAME -p $DOCKER_PASSWORD ImangeName $IMAGE_NAME Imagetag $IMAGE_TAG ...\n"

echo "Docker Registry: $DOCKER_REGISTRY"

printf "\nLogging in to Docker Hub... -u $DOCKER_USERNAME -p $DOCKER_PASSWORD ...\n"
# echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"


printf "\nBuilding docker images...\n"
docker-compose -f $DOCKER_COMPOSE_FILE build

printf "\nTagging image $IMAGE_NAME:$IMAGE_TAG...\n"
docker images
docker tag sourcefuse/backstage:latest $IMAGE_NAME:$IMAGE_TAG

printf "\nPushing $IMAGE_NAME:$IMAGE_TAG to Docker Hub...\n"
docker push $IMAGE_NAME:$IMAGE_TAG

printf "\nAdding $IMAGE_NAME:$IMAGE_TAG to SSM Parameter...\n"
aws ssm put-parameter \
  --name "/${ENVIRONMENT}/backstage/container-image-new" \
  --description "Container image reference for downstream deployments" \
  --value "$IMAGE_NAME:$IMAGE_TAG" \
  --type String \
  --overwrite

echo "::set-output name=image::$IMAGE_NAME:$IMAGE_TAG"
