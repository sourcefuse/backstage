#!/bin/bash
# Load env vars
export $(grep -v '^#' .env.local | grep -v '^$' | xargs -d '\n')

# Start backend only (frontend is served as static files by nginx)
# To rebuild frontend after code changes: yarn workspace app build
yarn workspace backend start
