#!/usr/bin/env bash
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set"
  exit 1
fi
npx drizzle-kit migrate --preview=false
