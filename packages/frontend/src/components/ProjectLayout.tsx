import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import ProjectNav from './ProjectNav';

export default function ProjectLayout() {
  const { pid } = useParams<{ pid: string }>();
  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0 overflow-y-auto">
        <ProjectNav pid={pid!} />
      </aside>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
