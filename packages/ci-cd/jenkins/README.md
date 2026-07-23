# TenjinT6 Jenkins Integration

Run TenjinT6 k6 tests from Jenkins pipelines.

## Setup

1. Add the shared library in Jenkins:

   **Manage Jenkins → System → Global Pipeline Libraries**
   - Name: `tenjint6`
   - Default version: `main`
   - Retrieval method: Modern SCM → Git
   - Project repository: `https://github.com/tenjint6/ci-cd.git`

2. Add API token credential:
   - **Manage Jenkins → Credentials**
   - Kind: Secret text
   - ID: `tenjint6-api-token`

## Usage

### Declarative Pipeline

```groovy
@Library('tenjint6') _

pipeline {
  agent none
  stages {
    stage('Performance Test') {
      steps {
        tenjinT6.run(
          testId: 'abc-123',
          apiUrl: 'https://t6.example.com',
          timeout: 600
        )
      }
    }
  }
}
```

### Scripted Pipeline

```groovy
@Library('tenjint6') _

node {
  tenjinT6.run(
    testId: 'abc-123',
    wait: true,
    timeout: 300
  )
}
```

## Parameters

| Parameter | Required | Default | Description |
|---|---|---|---|
| `testId` | yes | — | ID of the test to run |
| `apiUrl` | no | `http://localhost:3001` | TenjinT6 API URL |
| `wait` | no | `true` | Wait for completion |
| `timeout` | no | `600` | Max seconds to wait |
| `label` | no | `TenjinT6 k6 Test` | Pod template label |
