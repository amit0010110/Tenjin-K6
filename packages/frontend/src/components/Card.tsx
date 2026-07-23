import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ children, className = '', hover, onClick, padding = 'md' }: CardProps) {
  const paddingMap = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' };
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card ${
        hover ? 'hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 cursor-pointer' : ''
      } ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold text-gray-900 dark:text-gray-100 ${className}`}>{children}</h3>;
}

export function CardRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${className}`}>{children}</div>;
}