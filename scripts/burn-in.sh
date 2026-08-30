#!/bin/bash
set -euo pipefail

iterations=10
: > burn-in-results.ndjson

for iteration in $(seq 1 "$iterations"); do
  echo "Burn-in iteration $iteration/$iterations"
  yarn workspace @boilerplate/web test --retries=2 --reporters=ndjson 2>&1 | tee -a burn-in-results.ndjson
done
