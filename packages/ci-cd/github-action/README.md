# TenjinT6 GitHub Action

Run TenjinT6 k6 tests from GitHub Actions.

## Usage

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [push]

jobs:
  k6-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run TenjinT6 Test
        uses: tenjint6/ci-cd/github-action@v1
        with:
          api-url: ${{ vars.T6_API_URL }}
          api-token: ${{ secrets.T6_API_TOKEN }}
          test-id: ${{ vars.T6_TEST_ID }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-url` | yes | — | TenjinT6 API base URL |
| `api-token` | yes | — | API token with `run:create` permission |
| `test-id` | yes | — | ID of the test to run |
| `wait` | no | `true` | Wait for test completion |
| `timeout` | no | `600` | Max seconds to wait |

## Outputs

| Output | Description |
|---|---|
| `run-id` | ID of the created test run |
| `status` | Final status (`passed`/`failed`/`error`) |
| `report-url` | URL to the test report |
