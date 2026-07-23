import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDashboard from './pages/ProjectDashboard';
import ScriptLibrary from './pages/ScriptLibrary';
import ScriptEditor from './pages/ScriptEditor';
import ConfigEditor from './pages/ConfigEditor';
import RunHistory from './pages/RunHistory';
import RunDetail from './pages/RunDetail';
import LiveMonitor from './pages/LiveMonitor';
import ScheduleManager from './pages/ScheduleManager';
import SuiteManager from './pages/SuiteManager';
import SuiteRunDetail from './pages/SuiteRunDetail';
import PatManager from './pages/PatManager';
import ProjectSettings from './pages/ProjectSettings';
import TemplateLibrary from './pages/TemplateLibrary';
import RunComparison from './pages/RunComparison';
import WebhookSettings from './pages/WebhookSettings';
import ProfilePage from './pages/ProfilePage';
import DataFiles from './pages/DataFiles';
import CiCdIntegration from './pages/CiCdIntegration';
import Alerts from './pages/Alerts';
import Workers from './pages/Workers';
import AiScriptGenerator from './pages/AiScriptGenerator';
import DashboardBuilder from './pages/DashboardBuilder';
import AuditLogViewer from './pages/AuditLogViewer';
import PluginManager from './pages/PluginManager';
import Environments from './pages/Environments';
import RetentionSettings from './pages/RetentionSettings';
import AnomalyDetection from './pages/AnomalyDetection';
import AutoCorrelation from './pages/AutoCorrelation';
import RegressionDetection from './pages/RegressionDetection';
import SlaManagement from './pages/SlaManagement';
import SlaReport from './pages/SlaReport';
import DatabaseConnections from './pages/DatabaseConnections';
import OutputProfilesManager from './pages/OutputProfilesManager';
import RecordingProxy from './pages/RecordingProxy';
import NotFound from './pages/NotFound';
import ProjectLayout from './components/ProjectLayout';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/tokens" element={<PatManager />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:pid" element={<ProjectLayout />}>
            <Route index element={<ProjectDashboard />} />
            <Route path="plans" element={<ScriptLibrary />} />
            <Route path="plans/:sid" element={<ScriptEditor />} />
            <Route path="plans/:sid/configs/:cid" element={<ConfigEditor />} />
            <Route path="runs" element={<RunHistory />} />
            <Route path="runs/:rid" element={<RunDetail />} />
            <Route path="runs/:rid/live" element={<LiveMonitor />} />
            <Route path="runs/:rid/compare" element={<RunComparison />} />
            <Route path="schedules" element={<ScheduleManager />} />
            <Route path="suites" element={<SuiteManager />} />
            <Route path="suite-runs/:suiteRunId" element={<SuiteRunDetail />} />
            <Route path="data" element={<DataFiles />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="workers" element={<Workers />} />
            <Route path="cicd" element={<CiCdIntegration />} />
            <Route path="templates" element={<TemplateLibrary />} />
            <Route path="ai-generator" element={<AiScriptGenerator />} />
            <Route path="dashboard-builder" element={<DashboardBuilder />} />
            <Route path="audit-log" element={<AuditLogViewer />} />
            <Route path="plugins" element={<PluginManager />} />
            <Route path="environments" element={<Environments />} />
            <Route path="retention" element={<RetentionSettings />} />
            <Route path="webhooks" element={<WebhookSettings />} />
            <Route path="settings" element={<ProjectSettings />} />
            <Route path="plans/:sid/anomalies" element={<AnomalyDetection />} />
            <Route path="plans/:sid/regression" element={<RegressionDetection />} />
            <Route path="correlation" element={<AutoCorrelation />} />
            <Route path="sla" element={<SlaManagement />} />
            <Route path="sla/report" element={<SlaReport />} />
            <Route path="databases" element={<DatabaseConnections />} />
            <Route path="output-profiles" element={<OutputProfilesManager />} />
            <Route path="recording" element={<RecordingProxy />} />
            <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Route>
  </Routes>
  );
}
