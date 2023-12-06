export const GITHUB_DOCKER_BUILD_ACTION = `
# This is a basic workflow to help you get started with Actions

name: Build and Push Image

# Controls when the action will run. Triggers the workflow on push or pull request
# events but only for the master branch
on:
  push:
    branches: [master]

# A workflow run is made up of one or more jobs that can run sequentially or in parallel
jobs:
  # This workflow contains a single job called "build"
  lerna_test:
    # The type of runner that the job will run on
    runs-on: ubuntu-latest
    env:
      IMAGE_REPO_NAME: \${{ secrets.DOCKERHUB_USERNAME }} 
      NR_ENABLED: 0

      
    # Steps represent a sequence of tasks that will be executed as part of the job
    steps:
      # Checks-out your repository under $GITHUB_WORKSPACE, so your job can access it
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"
          cache-dependency-path: "**/package-lock.json"
        
        
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
     

      - name: setup packages
        run: "npm i --ignore-scripts"

      - name: lerna bootstrap
        run: "npx lerna bootstrap --no-ci --concurrency 2"
      

      - name: lerna build
        run: "npx lerna run build --stream --concurrency 2"

      - name: lerna docker builder
        run: "npx lerna run docker:build --stream --concurrency 2"

      - name: docker login
        run: "sudo docker login -u \\"\${{ secrets.DOCKERHUB_USERNAME }}\\"  -p \\"\${{ secrets.DOCKERHUB_TOKEN }}\\" docker.io"

      - name: lerna docker push
        run: "npx lerna run docker:push --stream --concurrency 2"
`






