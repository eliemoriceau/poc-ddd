# CI

The repository uses GitHub Actions in `.github/workflows/test.yml`.

## Gates

- `lint`: Oxlint, Oxfmt, and TypeScript checks.
- `test`: Japa unit and PostgreSQL integration suites run in parallel.
- `burn-in`: ten complete-suite repetitions on pull requests and manual runs.
- `report`: publishes gate results in the GitHub Actions summary.

The test matrix contains only `unit` and `integration`: there are currently no browser, functional, contract, or Playwright test suites. Japa has no native shard flag, so suite-level parallelism is the safe sharding boundary.

Tests use the same Postgres image and environment contract as `compose.yml`. The CI `APP_KEY` is a non-secret test-only value and must never be reused outside CI.

## Local reproduction

Start Postgres, then run:

```bash
yarn docker:up
scripts/ci-local.sh
```

For a flake check, run `scripts/burn-in.sh`.

Failed test and burn-in jobs upload NDJSON runner output for 30 days. A missing database usually means Postgres did not become healthy or `DATABASE_URL` does not point at `app_test`.
