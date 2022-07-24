#!/bin/bash
VERSION=$1

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 757583164619.dkr.ecr.us-east-1.amazonaws.com
docker-compose build
docker tag sourcefuse/sourcefuse-backstage:latest 757583164619.dkr.ecr.us-east-1.amazonaws.com/sf-refarch-dev-sourcefuse-backstage:${VERSION}
docker push 757583164619.dkr.ecr.us-east-1.amazonaws.com/sf-refarch-dev-sourcefuse-backstage:${VERSION}


