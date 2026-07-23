# TenjinT6 GitLab CI Template

Run TenjinT6 k6 tests in GitLab CI pipelines.

## Usage

```yaml
# .gitlab-ci.yml
include:
  - project: 'tenjint6/ci-cd'
    file: 'gitlab/.gitlab-ci-template.yml'

stages:
  - test

k6-smoke:
  extends: .tenjint6:run
  variables:
    T6_TEST_ID: "abc-123"
```

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `T6_API_URL` | yes | — | TenjinT6 API base URL |
| `T6_API_TOKEN` | yes | — | API token (CI/CD variable, masked) |
| `T6_TEST_ID` | yes | — | ID of the test to run |
| `T6_WAIT` | no | `true` | Wait for completion |
| `T6_TIMEOUT` | no | `600` | Max seconds to wait for completion |

## Multiple Tests

```yaml
k6-regression:
  extends: .tenjint6:run
  variables:
    T6_TEST_ID: "def-456"
    T6_TIMEOUT: "900"
```
