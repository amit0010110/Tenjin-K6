# CI/CD Plugin Pack

Pre-built integrations for running TenjinT6 k6 tests in your CI/CD pipelines.

## Available Plugins

| Plugin | File | Description |
|---|---|---|
| **GitHub Action** | `github-action/` | Run tests as a GitHub Action step |
| **GitLab CI** | `gitlab/` | Reusable `.gitlab-ci.yml` template |
| **Jenkins** | `jenkins/` | Shared library + declarative pipeline |

## Usage

All three plugins follow the same pattern:
1. Install the TenjinT6 CLI
2. Trigger a test run by test ID
3. Wait for results, report pass/fail

### Prerequisites

- A TenjinT6 instance (self-hosted or SaaS)
- An API token with `run:create` scope
- A test script already uploaded or created in TenjinT6
