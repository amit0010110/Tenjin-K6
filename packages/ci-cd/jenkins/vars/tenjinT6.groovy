// TenjinT6 shared library for Jenkins pipelines
//
// Usage:
//   @Library('tenjint6') _
//   tenjinT6.run testId: 'abc-123'
//
// Required credentials:
//   tenjint6-api-token  (secret text)

def call(Map params) {
    def label = params.label ?: 'TenjinT6 k6 Test'
    podTemplate(
        label: label,
        containers: [
            containerTemplate(name: 'k6', image: 'node:20-alpine', ttyEnabled: true, command: 'cat')
        ]
    ) {
        node(label) {
            stage('TenjinT6 Test') {
                container('k6') {
                    def timeout = params.timeout ?: 600
                    def wait = params.wait != null ? params.wait : true
                    def checkBudgets = params.checkBudgets != null ? params.checkBudgets : true
                    def apiUrl = params.apiUrl ?: 'http://localhost:3001'
                    def testId = params.testId

                    if (!testId) {
                        error("tenjinT6.run: testId is required")
                    }

                    withCredentials([string(credentialsId: 'tenjint6-api-token', variable: 'T6_TOKEN')]) {
                        sh """
                            npm install -g @tenjint6/cli
                            RUN_ID=\$(t6 run create "$testId" \\
                                --api-url "$apiUrl" \\
                                --api-token "$T6_TOKEN" \\
                                --format json | jq -r '.id')
                            echo "Created run: \$RUN_ID"
                        """
                        if (wait) {
                            sh """
                                END=\$((SECONDS + $timeout))
                                while [ \$SECONDS -lt \$END ]; do
                                    STATUS=\$(t6 run status "\$RUN_ID" \\
                                        --api-url "$apiUrl" \\
                                        --api-token "$T6_TOKEN" \\
                                        --format json | jq -r '.status')
                                    echo "Status: \$STATUS"
                                    case "\$STATUS" in
                                        passed) echo "Test passed"; break ;;
                                        failed) echo "Test failed"; exit 1 ;;
                                        error)  echo "Test error";  exit 1 ;;
                                    esac
                                    sleep 10
                                done
                                echo "Timed out"; exit 1
                            """
                        }
                        if (checkBudgets) {
                            sh """
                                echo "Checking performance budgets..."
                                t6 budget check "\$RUN_ID" --api-url "$apiUrl" --api-token "\$T6_TOKEN"
                            """
                        }
                    }
                }
            }
        }
    }
}
