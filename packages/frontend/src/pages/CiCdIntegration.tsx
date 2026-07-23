import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Tabs from '../components/Tabs';
import { Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { Copy, Check, Play, Settings, Terminal, BookOpen, ArrowRight, GitBranch, GitCommit } from 'lucide-react';

const WORKFLOWS = [
  {
    id: 'github-actions',
    label: 'GitHub Actions',
    icon: <GitBranch className="w-4 h-4" />,
    description: 'Run performance tests as part of your GitHub CI/CD pipeline',
    filename: '.github/workflows/performance.yml',
    content: (projectId: string, scriptId?: string) => `name: Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # Every Monday at 6 AM

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        uses: grafana/setup-k6-action@v1

      - name: Run performance tests
        run: k6 run scripts/test.js
        env:
          TARGET_URL: \${{ secrets.TARGET_URL }}
          K6_CLOUD_TOKEN: \${{ secrets.K6_CLOUD_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: results.json

      - name: Check thresholds
        run: |
          echo "Performance test complete. Check TenjinT6 for detailed results."
          echo "Project: ${projectId}"
          echo "View at: https://tenjint6.local/projects/${projectId}/runs"
`,
  },
  {
    id: 'gitlab-ci',
    label: 'GitLab CI',
    icon: <GitCommit className="w-4 h-4" />,
    description: 'Integrate performance testing into GitLab pipelines',
    filename: '.gitlab-ci.yml',
    content: (projectId: string) => `stages:
  - performance

k6-performance-test:
  stage: performance
  image: grafana/k6:latest
  script:
    - k6 run scripts/test.js
  variables:
    TARGET_URL: $TARGET_URL
    K6_CLOUD_TOKEN: $K6_CLOUD_TOKEN
  artifacts:
    paths:
      - results.json
    when: always
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_BRANCH == "develop"'
  after_script:
    - echo "Performance test complete. View at https://tenjint6.local/projects/${projectId}/runs"
`,
  },
  {
    id: 'jenkins',
    label: 'Jenkins Pipeline',
    icon: <JenkinsIcon />,
    description: 'Add performance gates to your Jenkins pipelines',
    filename: 'Jenkinsfile',
    content: (projectId: string) => `pipeline {
    agent any

    environment {
        TARGET_URL = credentials('TARGET_URL')
        K6_CLOUD_TOKEN = credentials('K6_CLOUD_TOKEN')
    }

    stages {
        stage('Install k6') {
            steps {
                sh 'docker pull grafana/k6:latest'
            }
        }

        stage('Run Performance Tests') {
            steps {
                sh '''
                    docker run --rm \\
                        -v \${WORKSPACE}:/scripts \\
                        -e TARGET_URL=\${TARGET_URL} \\
                        grafana/k6:latest run /scripts/scripts/test.js
                '''
            }
        }

        stage('Check Results') {
            steps {
                echo "Performance test complete. View at https://tenjint6.local/projects/${projectId}/runs"
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'results.json', allowEmptyArchive: true
        }
    }
}
`,
  },
];

const CLI_SNIPPETS = [
  {
    label: 'Run Test from CLI',
    language: 'bash',
    code: `# Install TenjinT6 CLI
npm install -g @tenjint6/cli

# Run a test
t6 run --project <project-id> --config <config-id>

# Run with overrides
t6 run --project <project-id> --config <config-id> \\
  --vus 100 --duration 5m

# Run and wait for results
t6 run --project <project-id> --config <config-id> --wait

# List recent runs
t6 runs list --project <project-id>`,
  },
  {
    label: 'API Usage',
    language: 'bash',
    code: `# Trigger a test run via API
curl -X POST https://tenjint6.local/api/v1/configs/<config-id>/run \\
  -H "Authorization: Bearer <your-token>"

# Check run status
curl https://tenjint6.local/api/v1/runs/<run-id> \\
  -H "Authorization: Bearer <your-token>"

# Get run results (JSON)
curl https://tenjint6.local/api/v1/runs/<run-id>/results \\
  -H "Authorization: Bearer <your-token>"`,
  },
];

export default function CiCdIntegration() {
  const { pid } = useParams();
  const toast = useToastStore();
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeCliTab, setActiveCliTab] = useState(0);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied to clipboard');
  };

  const tabItems = [
    { id: 'workflows', label: 'CI/CD Workflows', icon: <Play className="w-4 h-4" /> },
    { id: 'cli', label: 'CLI & API', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="CI/CD Integration"
        subtitle="Integrate performance tests into your development pipeline"
        breadcrumbs={[{ label: 'Settings', to: `/projects/${pid}/settings` }, { label: 'CI/CD' }]}
      />

      <div className="mb-4">
        <Tabs tabs={tabItems} active={activeTab === 0 ? 'workflows' : 'cli'} onChange={(id) => setActiveTab(id === 'workflows' ? 0 : 1)} />
      </div>

      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WORKFLOWS.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setActiveTab(0)}
                className="text-left p-4 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {wf.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{wf.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{wf.filename}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{wf.description}</p>
              </button>
            ))}
          </div>

          {WORKFLOWS.map((wf) => (
            <Card key={wf.id} padding="lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">{wf.icon}</span>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{wf.label}</h3>
                  <span className="text-xs text-gray-400 font-mono">{wf.filename}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(wf.content(pid || '', ''), wf.id)}>
                  {copied === wf.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === wf.id ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">{wf.content(pid || '', '')}</pre>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div className="space-y-6">
          <Card padding="lg">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">CLI Tool & REST API</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Use the TenjinT6 CLI or direct API calls to trigger and manage test runs from your pipeline.
              Generate a Personal Access Token from your profile page for authentication.
            </p>

            <div className="flex gap-2 mb-4">
              {CLI_SNIPPETS.map((s, i) => (
                <button key={i} onClick={() => setActiveCliTab(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeCliTab === i ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >{s.label}</button>
              ))}
            </div>

            <div className="relative">
              <Button size="sm" variant="ghost" className="absolute top-2 right-2 z-10"
                onClick={() => handleCopy(CLI_SNIPPETS[activeCliTab].code, 'cli')}>
                {copied === 'cli' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
              <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-4 overflow-x-auto">{CLI_SNIPPETS[activeCliTab].code}</pre>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md" hover className="cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">API Documentation</h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Full OpenAPI docs at /api/api-docs</p>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 mt-2" />
            </Card>
            <Card padding="md" hover className="cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Personal Tokens</h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Generate API tokens from your profile</p>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 mt-2" />
            </Card>
            <Card padding="md" hover className="cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Play className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Webhook Triggers</h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Trigger runs via webhooks from any tool</p>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 mt-2" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function JenkinsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  );
}
