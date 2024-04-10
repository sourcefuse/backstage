# #!/bin/bash

# set -e

# # optional
# : "${AWS_REGION:=us-east-1}"
# : "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"
# : "${ENVIRONMENT:=poc}"

# ## required
# AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
# : "${IMAGE_TAG:-$IMAGE_TAG}"

# ECR_REGISTRY_ENDPOINT="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
# IMAGE_NAME="$ECR_REGISTRY_ENDPOINT/sourcefuse-backstage"

# echo "Account: $AWS_ACCOUNT_ID"

# printf "\nECR Login...\n"
# aws ecr get-login-password \
#   --region $AWS_REGION \
#   | docker login \
#       --username AWS \
#       --password-stdin $ECR_REGISTRY_ENDPOINT

# printf "\nBuilding docker images...\n"
# docker-compose -f $DOCKER_COMPOSE_FILE build

# printf "\nTagging image $IMAGE_NAME:$IMAGE_TAG...\n"
# docker tag sourcefuse/sourcefuse-backstage:latest $IMAGE_NAME:$IMAGE_TAG

# printf "\nPushing $IMAGE_NAME:$IMAGE_TAG to ECR...\n"
# docker push $IMAGE_NAME:$IMAGE_TAG

# printf "\nAdding $IMAGE_NAME:$IMAGE_TAG to SSM Parameter...\n"
# aws ssm put-parameter \
#   --name "/${ENVIRONMENT}/backstage/container-image" \
#   --description "Container image reference for downstream deployments" \
#   --value "$IMAGE_NAME:$IMAGE_TAG" \
#   --type String \
#   --overwrite

# echo "::set-output name=image::$IMAGE_NAME:$IMAGE_TAG"

#!/bin/bash

set -e

# Optional
: "${DOCKER_COMPOSE_FILE:=./docker-compose.yml}"
: "${ENVIRONMENT:=poc}"

# Required
: "${DOCKER_USERNAME:=sourcefuse}"
: "${DOCKER_PASSWORD:=Docker2@31}"
: "${IMAGE_TAG:-$IMAGE_TAG}"

DOCKER_REGISTRY="docker.io"
IMAGE_NAME="$DOCKER_USERNAME/backstage"

echo "Docker Registry: $DOCKER_REGISTRY"

printf "\nLogging in to Docker Hub...\n"
echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin

printf "\nBuilding docker images...\n"
docker-compose -f $DOCKER_COMPOSE_FILE build

printf "\nTagging image $IMAGE_NAME:$IMAGE_TAG...\n"
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
