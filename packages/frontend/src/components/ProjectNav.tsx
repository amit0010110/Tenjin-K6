import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Database, FileCode, Sparkles,
  Layers, Activity, CalendarClock,
  AlertTriangle, Target,
  Server, Puzzle, Globe, Clock, GitBranch, Webhook,
  Palette, Shield, Settings, Award, TerminalSquare, Radio,
  Users, BarChart3, Siren, TrendingUp, Bug, ChevronRight, Share2,
} from 'lucide-react';

interface ProjectNavProps { pid: string; }

interface NavItem { to: string; label: string; icon: React.ReactNode; end?: boolean; badge?: string; }

interface NavGroup { title: string; items: NavItem[]; }

const groups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    ],
  },
  {
    title: 'Develop',
    items: [
      { to: 'plans', label: 'Test Plans', icon: <Layers className="w-4 h-4" /> },
      { to: 'data', label: 'Data Files', icon: <Database className="w-4 h-4" /> },
      { to: 'templates', label: 'Templates', icon: <FileCode className="w-4 h-4" /> },
      { to: 'ai-generator', label: 'AI Generator', icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Execute',
    items: [
      { to: 'runs', label: 'Test Runs', icon: <Activity className="w-4 h-4" /> },
      { to: 'suites', label: 'Suites', icon: <BarChart3 className="w-4 h-4" /> },
      { to: 'schedules', label: 'Schedules', icon: <CalendarClock className="w-4 h-4" /> },
      { to: 'recording', label: 'Recording', icon: <Radio className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Analyze',
    items: [
      { to: 'dashboard-builder', label: 'Dashboards', icon: <Palette className="w-4 h-4" /> },
      { to: 'sla', label: 'SLA Reports', icon: <Award className="w-4 h-4" /> },
      { to: 'plans/:sid/anomalies', label: 'Anomalies', icon: <Bug className="w-4 h-4" /> },
      { to: 'correlation', label: 'Correlation', icon: <Target className="w-4 h-4" /> },
      { to: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Integrate',
    items: [
      { to: 'environments', label: 'Environments', icon: <Globe className="w-4 h-4" /> },
      { to: 'databases', label: 'Databases', icon: <TerminalSquare className="w-4 h-4" /> },
      { to: 'output-profiles', label: 'Output Profiles', icon: <Share2 className="w-4 h-4" /> },
      { to: 'cicd', label: 'CI/CD', icon: <GitBranch className="w-4 h-4" /> },
      { to: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { to: 'workers', label: 'Workers', icon: <Server className="w-4 h-4" /> },
      { to: 'plugins', label: 'Plugins', icon: <Puzzle className="w-4 h-4" /> },
      { to: 'retention', label: 'Retention', icon: <Clock className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
      { to: 'audit-log', label: 'Audit Log', icon: <Shield className="w-4 h-4" /> },
    ],
  },
];

const COLLAPSED_BY_DEFAULT = new Set(['Integrate', 'Infrastructure', 'Admin']);

export default function ProjectNav({ pid }: ProjectNavProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    groups.forEach(g => { if (!COLLAPSED_BY_DEFAULT.has(g.title)) initial.add(g.title); });
    return initial;
  });

  return (
    <nav className="w-56 h-full overflow-y-auto py-4 px-2 space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.title);
        return (
          <div key={group.title}>
            <button
              onClick={() => {
                setExpandedGroups(prev => {
                  const next = new Set(prev);
                  if (next.has(group.title)) next.delete(group.title); else next.add(group.title);
                  return next;
                });
              }}
              className="w-full flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 px-3 py-1 mb-0.5 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              {group.title}
            </button>
            {isExpanded && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}