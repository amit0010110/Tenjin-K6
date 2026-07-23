-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "test_config_id" TEXT NOT NULL,
    "name" TEXT,
    "cron_expr" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" DATETIME,
    "next_run_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedules_test_config_id_fkey" FOREIGN KEY ("test_config_id") REFERENCES "test_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_schedules" ("createdAt", "cron_expr", "enabled", "id", "last_run_at", "name", "next_run_at", "test_config_id") SELECT "createdAt", "cron_expr", "enabled", "id", "last_run_at", "name", "next_run_at", "test_config_id" FROM "schedules";
DROP TABLE "schedules";
ALTER TABLE "new_schedules" RENAME TO "schedules";
CREATE TABLE "new_test_result_points" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testRunId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "test_result_points_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_test_result_points" ("id", "metricName", "metricValue", "tags", "testRunId", "timestamp") SELECT "id", "metricName", "metricValue", "tags", "testRunId", "timestamp" FROM "test_result_points";
DROP TABLE "test_result_points";
ALTER TABLE "new_test_result_points" RENAME TO "test_result_points";
CREATE INDEX "test_result_points_testRunId_idx" ON "test_result_points"("testRunId");
CREATE TABLE "new_test_results" (
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
    CONSTRAINT "test_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_test_results" ("avg", "count", "id", "max", "med", "metricName", "metricType", "min", "p90", "p95", "p99", "rate", "tags", "testRunId", "value") SELECT "avg", "count", "id", "max", "med", "metricName", "metricType", "min", "p90", "p95", "p99", "rate", "tags", "testRunId", "value" FROM "test_results";
DROP TABLE "test_results";
ALTER TABLE "new_test_results" RENAME TO "test_results";
CREATE TABLE "new_threshold_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "thresholdExpr" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "actualValue" REAL,
    "aborted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "threshold_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_threshold_results" ("aborted", "actualValue", "id", "metricName", "passed", "testRunId", "thresholdExpr") SELECT "aborted", "actualValue", "id", "metricName", "passed", "testRunId", "thresholdExpr" FROM "threshold_results";
DROP TABLE "threshold_results";
ALTER TABLE "new_threshold_results" RENAME TO "threshold_results";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
