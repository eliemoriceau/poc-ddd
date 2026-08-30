# CI secrets checklist

The current pipeline requires no repository secrets.

- `GITHUB_TOKEN` is not used explicitly; GitHub provides it automatically.
- `APP_KEY` is a test-only constant, not a production credential.
- No Pact broker is configured because the repository has no Pact tests or Pact dependencies.
- No Slack or email notification secret is configured.

Before enabling deployment jobs, keep production credentials in GitHub environment secrets and separate them from this test workflow.
