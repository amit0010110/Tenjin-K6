import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Input, Button, Spinner } from '../components/ui';
import { useToastStore } from '../stores/toastStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const toast = useToastStore();
  const [email, setEmail] = useState('dev@tenjint6.local');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Login failed'); return; }
      login(data.token, data.user);
      toast.success('Welcome back!', `Signed in as ${data.user.email}`);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Network error');
      toast.error('Network error', 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border dark:border-gray-800 p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">TenjinT6</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <Input
              id="email"
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" error={error && !email.trim() ? 'Required' : undefined} required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <Input
              id="password"
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password" error={error && !password.trim() ? 'Required' : undefined} required
            />
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-950 dark:border-red-800 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Spinner />}
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-6 border-t dark:border-gray-700 pt-4">
          Demo: dev@tenjint6.local / password
        </p>
      </div>
    </div>
  );
}
