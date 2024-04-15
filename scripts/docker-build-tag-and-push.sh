#!/bin/bash

set -e

# Optional
: "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"
: "${ENVIRONMENT:=poc}"

# Required
: "${DOCKER_USERNAME:=$DOCKERHUB_USERNAME}"
: "${DOCKER_PASSWORD:=$DOCKERHUB_PASSWORD}"
: "${IMAGE_TAG:-$IMAGE_TAG}"

DOCKERHUB_REGISTRY="docker.io"
IMAGE_NAME="$DOCKERHUB_REGISTRY/$DOCKER_USERNAME/backstage"

echo "Docker Registry: $DOCKERHUB_REGISTRY ...\n"

printf "\nLogging in to Docker Hub... -u $DOCKER_USERNAME -p $DOCKER_PASSWORD ImangeName $IMAGE_NAME Imagetag $IMAGE_TAG ...\n"
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
  --name "/${ENVIRONMENT}/backstage/container-image" \
  --description "Container image reference for downstream deployments" \
  --value "$IMAGE_NAME:$IMAGE_TAG" \
  --type String \
  --overwrite

echo "::set-output name=image::$IMAGE_NAME:$IMAGE_TAG"
