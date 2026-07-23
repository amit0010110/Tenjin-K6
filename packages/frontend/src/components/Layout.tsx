import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import ToastContainer from './ToastContainer';
import {
  LayoutDashboard, FolderKanban, User, Key, LogOut, Sun, Moon,
} from 'lucide-react';

const topNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/tokens', label: 'Tokens', icon: Key },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 md:hidden bg-gray-900 text-white p-2 rounded-lg shadow-lg"
        aria-label="Toggle sidebar"
      >
        <span>{sidebarOpen ? '✕' : '☰'}</span>
      </button>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-56 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col border-r border-gray-200 dark:border-gray-800
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-brand-600 dark:text-brand-400">Tenjin</span><span className="text-gray-700 dark:text-gray-300">T6</span>
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Performance Testing</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {topNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <button onClick={toggle} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors w-full">
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
