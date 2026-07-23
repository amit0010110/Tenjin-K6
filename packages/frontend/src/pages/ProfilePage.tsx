import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Button, Input, FieldWrapper } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
import { useTitle } from '../hooks/useTitle';
import Card from '../components/Card';
import { User, Key, Mail, LogOut, Save } from 'lucide-react';

export default function ProfilePage() {
  useTitle('Profile');
  const { user, login, logout } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Update failed' }));
        toast.error('Update failed', err.message);
        return;
      }
      const updated = await res.json();
      login(token!, updated);
      toast.success('Profile updated');
      setCurrentPassword('');
      setNewPassword('');
    } catch { toast.error('Failed to update profile'); } finally { setSaving(false); }
  };

  const handleSignOut = () => { logout(); navigate('/login'); };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
          <User className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
          <p className="text-sm text-gray-500">Manage your account settings</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Card padding="lg" className="space-y-4">
          <FieldWrapper label="Email" hint="Email cannot be changed">
            <div className="flex items-center gap-2 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <Mail className="w-4 h-4 text-gray-400" />
              {user?.email || ''}
            </div>
          </FieldWrapper>

          <FieldWrapper label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FieldWrapper>

          <hr className="dark:border-gray-700" />

          <FieldWrapper label="Current Password">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
          </FieldWrapper>
          <FieldWrapper label="New Password">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" minLength={6} />
          </FieldWrapper>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Changes'}</Button>
            <Button type="button" variant="danger" onClick={handleSignOut}><LogOut className="w-4 h-4" />Sign Out</Button>
          </div>
        </Card>
      </form>

      <Card padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-brand-500" />
            <div>
              <h2 className="font-semibold text-sm">Personal Access Tokens</h2>
              <p className="text-xs text-gray-500">Manage API tokens for programmatic access.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/tokens')}>Manage Tokens</Button>
        </div>
      </Card>
    </div>
  );
}
