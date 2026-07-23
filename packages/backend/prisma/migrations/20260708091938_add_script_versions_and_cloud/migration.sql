-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN "cloud_results" TEXT;
ALTER TABLE "test_runs" ADD COLUMN "cloud_run_id" TEXT;
ALTER TABLE "test_runs" ADD COLUMN "cloud_run_url" TEXT;

-- CreateTable
CREATE TABLE "script_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "script_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "envVars" TEXT NOT NULL DEFAULT '{}',
    "tags" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "script_versions_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "script_versions_script_id_version_key" ON "script_versions"("script_id", "version");
