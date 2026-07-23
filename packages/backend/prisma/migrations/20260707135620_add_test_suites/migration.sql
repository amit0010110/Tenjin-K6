-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "password_hash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "last_used_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "filePath" TEXT,
    "envVars" TEXT NOT NULL DEFAULT '{}',
    "tags" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scripts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "options" TEXT NOT NULL DEFAULT '{}',
    "prometheus_push_url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "test_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_configs_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testConfigId" TEXT,
    "scriptId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "k6ExitCode" INTEGER,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "optionsSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_runs_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_runs_testConfigId_fkey" FOREIGN KEY ("testConfigId") REFERENCES "test_configs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "avg" REAL,
    "min" REAL,
    "max" REAL,
    "med" REAL,
    "p90" REAL,
    "p95" REAL,
    "p99" REAL,
    "count" INTEGER,
    "rate" REAL,
    "value" REAL,
    "tags" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "test_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_result_points" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testRunId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "test_result_points_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "threshold_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "thresholdExpr" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "actualValue" REAL,
    "aborted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "threshold_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "test_config_id" TEXT NOT NULL,
    "name" TEXT,
    "cron_expr" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" DATETIME,
    "next_run_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedules_test_config_id_fkey" FOREIGN KEY ("test_config_id") REFERENCES "test_configs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "variables" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "environments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "csv_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "csv_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "channelType" TEXT NOT NULL,
    "channelConfig" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alert_rule_id" TEXT NOT NULL,
    "runId" TEXT,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "channelType" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_events_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_suites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_suite_scripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suite_id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "test_suite_scripts_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_suite_scripts_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "git_repos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "auth_token" TEXT,
    "last_synced_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "git_repos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "test_result_points_testRunId_idx" ON "test_result_points"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "test_suite_scripts_suite_id_script_id_key" ON "test_suite_scripts"("suite_id", "script_id");
