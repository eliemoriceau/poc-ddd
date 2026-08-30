#!/bin/bash
set -euo pipefail

corepack enable
yarn install --immutable
yarn lint
yarn format
yarn typecheck
yarn test
