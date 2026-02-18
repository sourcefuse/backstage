#!/bin/sh
set -e

CONFIG_FLAGS="--config app-config.yaml"

if [ -n "${K8S_CLUSTER_NAME}" ]; then
  CONFIG_FLAGS="$CONFIG_FLAGS --config app-config.production.yaml"
fi

exec node packages/backend $CONFIG_FLAGS
