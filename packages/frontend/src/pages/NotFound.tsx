import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useTitle } from '../hooks/useTitle';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  useTitle('Page Not Found');
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <FileQuestion className="w-10 h-10 text-gray-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          <Home className="w-4 h-4" /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
