#!/bin/bash

# optional
: "${AWS_REGION:=us-east-1}"
: "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"

## required
: "${AWS_ACCOUNT_ID:=$AWS_ACCOUNT_ID}"
#: "${AWS_ACCESS_KEY_ID:-$AWS_ACCESS_KEY_ID}"  # TODO - remove if not needed
#: "${AWS_SECRET_ACCESS_KEY:-$AWS_ACCESS_KEY_ID}"  # TODO - remove if not needed
: "${ECR_REGISTRY_ENDPOINT:-$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com}"
: "${IMAGE_NAME:-$ECR_REGISTRY_ENDPOINT/sf-refarch-dev-sourcefuse-backstage}"
: "${IMAGE_TAG:-$IMAGE_TAG}"

echo "Account: $AWS_ACCOUNT_ID"

aws ecr get-login-password \
  --region $AWS_REGION \
  | docker login \
      --username AWS \
      --password-stdin $ECR_REGISTRY_ENDPOINT

docker-compose -f $DOCKER_COMPOSE_FILE build

printf "Tagging image...\n"
docker tag sourcefuse/sourcefuse-backstage:$IMAGE_TAG $IMAGE_NAME:$IMAGE_TAG

printf "Pushing image to ECR...\n"
docker push $IMAGE_NAME:$IMAGE_TAG

echo "::set-output name=image::$IMAGE_NAME:$IMAGE_TAG"


