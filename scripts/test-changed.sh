#!/bin/bash
set -euo pipefail

# Japa does not provide changed-file selection. Run the complete deterministic suite.
yarn test
