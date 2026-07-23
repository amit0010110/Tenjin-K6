import { request, del } from './core';
export * from './core';

export const api = {
  // Scripts
  listScripts: (projectId: string) =>
    request<Array<{ id: string; name: string; version: number; createdAt: string; tags: Record<string, string> | null }>>(`/projects/${projectId}/scripts`),

  getScript: (id: string) =>
    request<any>(`/scripts/${id}`),

  createScript: (projectId: string, data: { name: string; content: string; envVars?: Record<string, string>; tags?: Record<string, string> }) =>
    request<any>(`/projects/${projectId}/scripts`, { method: 'POST', body: JSON.stringify(data) }),

  updateScript: (id: string, data: Partial<{ name: string; content: string; tags: Record<string, string> }>) =>
    request<any>(`/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteScript: (id: string) =>
    del(`/scripts/${id}`),

  saveBlocks: (id: string, blocks: string) =>
    request<{ message: string }>(`/scripts/${id}/blocks`, { method: 'PUT', body: JSON.stringify({ blocks }) }),

  // Configs
  listConfigs: (scriptId: string) =>
    request<any[]>(`/scripts/${scriptId}/configs`),

  createConfig: (scriptId: string, data: { name: string; description?: string; options: any }) =>
    request<any>(`/scripts/${scriptId}/configs`, { method: 'POST', body: JSON.stringify(data) }),

  updateConfig: (id: string, data: any) =>
    request<any>(`/configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteConfig: (id: string) =>
    del(`/configs/${id}`),

  // Runs
  triggerRun: (configId: string, body?: { environmentId?: string }) =>
    request<any>(`/configs/${configId}/run`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),

  listRuns: (params?: { projectId?: string; status?: string; suiteRunId?: string; dateFrom?: string; dateTo?: string; scriptId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.status) qs.set('status', params.status);
    if (params?.suiteRunId) qs.set('suiteRunId', params.suiteRunId);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.scriptId) qs.set('scriptId', params.scriptId);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<any[]>(`/runs?${qs}`);
  },

  getRun: (id: string) =>
    request<any>(`/runs/${id}`),

  abortRun: (id: string) =>
    request<any>(`/runs/${id}/abort`, { method: 'POST' }),

  deleteRun: (id: string) =>
    del(`/runs/${id}`),

  // Workers
  listWorkers: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/workers`),

  createWorker: (projectId: string, data: { name: string; url: string; capacity?: number }) =>
    request<any>(`/projects/${projectId}/workers`, { method: 'POST', body: JSON.stringify(data) }),

  deleteWorker: (id: string) =>
    del(`/workers/${id}`),

  distributeRun: (projectId: string, configId: string) =>
    request<any>(`/projects/${projectId}/configs/${configId}/distribute`, { method: 'POST' }),

  getAssignments: (runId: string) =>
    request<any[]>(`/runs/${runId}/assignments`),

  getRunResults: (id: string) =>
    request<any[]>(`/runs/${id}/results`),

  getRunThresholds: (id: string) =>
    request<any[]>(`/runs/${id}/thresholds`),

  getRunRequestLogs: (id: string, page = 1, pageSize = 50) =>
    request<{ logs: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/runs/${id}/request-logs?page=${page}&pageSize=${pageSize}`
    ),

  // Dashboard Analytics
  getDashboardSummary: (projectId: string, hours?: number) =>
    request<any>(`/projects/${projectId}/dashboard/summary${hours ? `?hours=${hours}` : ''}`),

  getDashboardTrend: (projectId: string, hours?: number) =>
    request<any[]>(`/projects/${projectId}/dashboard/trend${hours ? `?hours=${hours}` : ''}`),

  // Dashboard Builder CRUD
  listDashboards: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/dashboards`),

  getDashboard: (id: string) =>
    request<any>(`/dashboards/${id}`),

  createDashboard: (projectId: string, data: { name: string; widgets?: string }) =>
    request<any>(`/projects/${projectId}/dashboards`, { method: 'POST', body: JSON.stringify(data) }),

  updateDashboard: (id: string, data: { name?: string; widgets?: string }) =>
    request<any>(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDashboard: (id: string) =>
    del(`/dashboards/${id}`),

  // Schedules
  listSchedules: (configId: string) =>
    request<any[]>(`/configs/${configId}/schedules`),

  createSchedule: (configId: string, data: { cronExpr: string }) =>
    request<any>(`/configs/${configId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),

  deleteSchedule: (id: string) =>
    del(`/schedules/${id}`),

  // Projects
  listProjects: () =>
    request<Array<{ id: string; name: string; description: string | null; _count: { scripts: number; testRuns: number; members: number } }>>('/projects'),

  createProject: (data: { name: string; description?: string }) =>
    request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  getProject: (id: string) =>
    request<any>(`/projects/${id}`),

  deleteProject: (id: string) =>
    del(`/projects/${id}`),

  // Data Files (CSV/JSON)
  listDataFiles: (projectId: string) =>
    request<Array<{ id: string; name: string; filename: string; createdAt: string }>>(`/projects/${projectId}/csv`),

  uploadDataFile: (projectId: string, data: { name: string; content: string }) =>
    request<{ id: string; name: string; filename: string; createdAt: string }>(`/projects/${projectId}/csv`, { method: 'POST', body: JSON.stringify(data) }),

  getDataFile: (id: string) =>
    request<{ id: string; name: string; filename: string; content: string; createdAt: string }>(`/csv/${id}`),

  deleteDataFile: (id: string) =>
    del(`/csv/${id}`),

  // Alerts
  listAlerts: (projectId: string) =>
    request<Array<{ id: string; name: string; description: string | null; metricName: string; condition: string; threshold: number; channelType: string; channelConfig: Record<string, unknown>; enabled: boolean; lastTriggeredAt: string | null; createdAt: string }>>(`/projects/${projectId}/alerts`),

  createAlert: (projectId: string, data: { name: string; description?: string; metricName: string; condition: string; threshold: number; channelType: string; channelConfig: Record<string, unknown>; enabled?: boolean }) =>
    request<any>(`/projects/${projectId}/alerts`, { method: 'POST', body: JSON.stringify(data) }),

  updateAlert: (id: string, data: Partial<{ name: string; description: string; metricName: string; condition: string; threshold: number; channelType: string; channelConfig: Record<string, unknown>; enabled: boolean }>) =>
    request<any>(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteAlert: (id: string) =>
    del(`/alerts/${id}`),

  getAlertHistory: (projectId: string) =>
    request<Array<{ id: string; alertRuleId: string; runId: string | null; metricName: string; metricValue: number; condition: string; threshold: number; channelType: string; sent: boolean; error: string | null; createdAt: string; alertRule: { name: string } }>>(`/projects/${projectId}/alerts/history`),

  // Run Notes
  updateRunNotes: (runId: string, notes: string) =>
    request<{ id: string; notes: string }>(`/runs/${runId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),

  // k6 Cloud
  syncCloudRun: (runId: string, data: { cloudRunId?: string; cloudRunUrl?: string }) =>
    request<any>(`/runs/${runId}/cloud-sync`, { method: 'POST', body: JSON.stringify(data) }),

  // Environments
  listEnvironments: (projectId: string) =>
    request<Array<{ id: string; name: string; baseUrl: string | null; variables: Record<string, string>; isDefault: boolean }>>(`/projects/${projectId}/environments`),

  createEnvironment: (projectId: string, data: { name: string; baseUrl?: string; variables?: Record<string, string> }) =>
    request<any>(`/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(data) }),

  updateEnvironment: (id: string, data: { name: string; baseUrl?: string; variables?: Record<string, string> }) =>
    request<any>(`/environments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteEnvironment: (id: string) =>
    del(`/environments/${id}`),

  setDefaultEnvironment: (id: string) =>
    request<any>(`/environments/${id}/set-default`, { method: 'POST' }),

  // Retention
  getRetentionStats: (projectId: string) =>
    request<{ totalRuns: number; totalPoints: number; oldestRunAt: string | null; latestRunAt: string | null }>(`/projects/${projectId}/retention`),

  purgeRuns: (projectId: string, olderThanDays: number) =>
    request<{ deletedRuns: number; message: string }>(`/projects/${projectId}/purge`, { method: 'POST', body: JSON.stringify({ olderThanDays }) }),

  // Suites
  listSuites: (projectId: string) =>
    request<Array<{ id: string; name: string; scripts: Array<{ id: string; name: string; order: number }> }>>(`/projects/${projectId}/suites`),

  createSuite: (projectId: string, data: { name: string; scriptIds: string[] }) =>
    request<any>(`/projects/${projectId}/suites`, { method: 'POST', body: JSON.stringify(data) }),

  updateSuite: (id: string, data: { name?: string; scriptIds?: string[] }) =>
    request<any>(`/suites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSuite: (id: string) =>
    del(`/suites/${id}`),

  triggerSuiteRun: (suiteId: string) =>
    request<any>(`/suites/${suiteId}/run`, { method: 'POST' }),

  getSuiteRuns: (suiteId: string) =>
    request<any[]>(`/suites/${suiteId}/runs`),

  // Correlation
  autoCorrelate: (scriptContent: string) =>
    request<{ suggestions: Array<{ name: string; source: string; pattern: string; variable: string }>; count: number }>(`/scripts/auto-correlate`, { method: 'POST', body: JSON.stringify({ content: scriptContent }) }),

  getAnomalies: (scriptId: string) =>
    request<{ anomalies: any[]; totalRuns: number }>(`/scripts/${scriptId}/anomalies`),

  getRegressions: (scriptId: string, baselineRunId?: string) =>
    request<{ scriptId: string; scriptName: string; baseline: any; current: any; regression: any[]; summary: { metricsCompared: number; regressions: number; improvements: number; totalRuns: number }; message?: string }>(`/scripts/${scriptId}/regression`, { method: 'POST', body: JSON.stringify({ baselineRunId })}),

  // Audit Logs
  listAuditLogs: (projectId: string, page?: number) =>
    request<{ logs: any[]; total: number; page: number; totalPages: number }>(`/projects/${projectId}/audit-logs?page=${page || 1}`),

  // Plugins
  listPlugins: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/plugins`),

  createPlugin: (projectId: string, data: { name: string; description?: string; repoUrl: string; version?: string }) =>
    request<any>(`/projects/${projectId}/plugins`, { method: 'POST', body: JSON.stringify(data) }),

  togglePlugin: (id: string, enabled: boolean) =>
    request<any>(`/plugins/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  deletePlugin: (id: string) =>
    del(`/plugins/${id}`),

  buildPlugins: (projectId: string) =>
    request<{ binaryPath: string; binaryName: string; plugins: number; status: string }>(`/projects/${projectId}/plugins/build`, { method: 'POST' }),

  // Members
  listMembers: (projectId: string) =>
    request<Array<{ id: string; userId: string; role: string; user: { id: string; name: string; email: string } }>>(`/projects/${projectId}/members`),

  updateMemberRole: (memberId: string, role: string) =>
    request<any>(`/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ role }) }),

  removeMember: (memberId: string) =>
    del(`/members/${memberId}`),

  // SLA
  listSlaRules: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/sla/rules`),

  createSlaRule: (projectId: string, data: any) =>
    request<any>(`/projects/${projectId}/sla/rules`, { method: 'POST', body: JSON.stringify(data) }),

  updateSlaRule: (id: string, data: any) =>
    request<any>(`/sla/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleSlaRule: (id: string) =>
    request<any>(`/sla/rules/${id}/toggle`, { method: 'PATCH' }),

  deleteSlaRule: (id: string) =>
    del(`/sla/rules/${id}`),

  getSlaStatus: (projectId: string) =>
    request<{ statuses: any[]; evaluatedAt: string }>(`/projects/${projectId}/sla/status`),

  getSlaBreaches: (projectId: string, ruleId?: string) =>
    request<any[]>(`/projects/${projectId}/sla/breaches${ruleId ? `?ruleId=${ruleId}` : ''}`),

  getSlaRuleBreaches: (ruleId: string) =>
    request<any[]>(`/sla/rules/${ruleId}/breaches`),

  getSlaReport: (projectId: string) =>
    request<any>(`/projects/${projectId}/sla/report`),

  // Test Plans
  listPlans: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/plans`),

  createPlan: (projectId: string, data: { name: string; description?: string; blocks?: string }) =>
    request<any>(`/projects/${projectId}/plans`, { method: 'POST', body: JSON.stringify(data) }),

  getPlan: (id: string) =>
    request<any>(`/plans/${id}`),

  updatePlan: (id: string, data: { name?: string; description?: string; blocks?: string }) =>
    request<any>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deletePlan: (id: string) =>
    del(`/plans/${id}`),

  // Database Connections
  listDbConnections: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/db-connections`),

  createDbConnection: (projectId: string, data: any) =>
    request<any>(`/projects/${projectId}/db-connections`, { method: 'POST', body: JSON.stringify(data) }),

  getDbConnection: (id: string) =>
    request<any>(`/db-connections/${id}`),

  updateDbConnection: (id: string, data: any) =>
    request<any>(`/db-connections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDbConnection: (id: string) =>
    del(`/db-connections/${id}`),

  // Output Profiles
  listOutputProfiles: (projectId: string) =>
    request<any[]>(`/projects/${projectId}/output-profiles`),

  createOutputProfile: (projectId: string, data: any) =>
    request<any>(`/projects/${projectId}/output-profiles`, { method: 'POST', body: JSON.stringify(data) }),

  getOutputProfile: (id: string) =>
    request<any>(`/output-profiles/${id}`),

  updateOutputProfile: (id: string, data: any) =>
    request<any>(`/output-profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteOutputProfile: (id: string) =>
    del(`/output-profiles/${id}`),

  testOutputProfile: (id: string) =>
    request<{ status: string; message: string }>(`/output-profiles/${id}/test`, { method: 'POST' }),

  // Recording Proxy (dual mode: http-proxy | playwright)
  startRecording: (targetUrl: string, opts?: { mode?: 'http-proxy' | 'playwright'; browserType?: 'chromium' | 'firefox' | 'webkit'; headless?: boolean; filter?: { includePatterns?: string[]; excludePatterns?: string[]; methods?: string[] } }, projectId?: string) =>
    request<{ mode: string; targetUrl: string; status: string; sessionId: string; browserWsEndpoint?: string | null; browserType?: string | null; message: string }>(
      `/recording/start?projectId=${projectId || 'default'}`, {
        method: 'POST',
        body: JSON.stringify({ targetUrl, mode: opts?.mode || 'http-proxy', browserType: opts?.browserType || 'chromium', headless: opts?.headless ?? false, filter: opts?.filter }),
      }
    ),

  stopRecording: (projectId?: string) =>
    request<{ message: string; mode: string | null; captured: number; actions: number }>(`/recording/stop?projectId=${projectId || 'default'}`, { method: 'POST' }),

  getRecordingCaptured: (projectId?: string) =>
    request<{ captured: any[]; actions: any[]; count: number; recording: boolean; mode: string | null; targetUrl: string | null; browserType: string | null }>(
      `/recording/captured?projectId=${projectId || 'default'}`
    ),

  clearRecording: (projectId?: string) =>
    request<{ message: string }>(`/recording/clear?projectId=${projectId || 'default'}`, { method: 'POST' }),

  generateRecordingBlocks: (projectId?: string) =>
    request<{ blocks: any[]; count: number; targetUrl: string | null; source: string | null }>(
      `/recording/generate?projectId=${projectId || 'default'}`, { method: 'POST' }
    ),

  // Playwright-specific
  listBrowsers: () =>
    request<{ browsers: Array<{ name: string; executablePath: string }>; count: number }>('/recording/browsers'),

  executePlaywrightCommand: (command: { type: string; url?: string; selector?: string; value?: string; script?: string; timeout?: number }, projectId?: string) =>
    request<{ success: boolean; result: any }>(`/recording/command?projectId=${projectId || 'default'}`, {
      method: 'POST',
      body: JSON.stringify(command),
    }),

  // Correlation
  analyzeCorrelation: (targetUrl: string, requests?: any[]) =>
    request<{ suggestions: any[]; diffs: any[]; count: number }>('/correlation/analyze', { method: 'POST', body: JSON.stringify({ targetUrl, requests }) }),

  generateCorrelationBlocks: (requests: any[], rules: any[]) =>
    request<{ blocks: any[]; count: number }>('/correlation/generate-blocks', { method: 'POST', body: JSON.stringify({ requests, rules }) }),
};
