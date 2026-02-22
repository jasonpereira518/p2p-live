/**
 * P2P Login — student, admin, manager, driver. Redirect by role after login.
 * TODO: Replace with real auth (SSO / API).
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, getDashboardPath } from '../../ops/auth';
import { OpsLayout } from '../../ops/OpsLayout';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'driver', label: 'Driver' },
] as const;

export function OpsLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rolePreset, setRolePreset] = useState<'student' | 'admin' | 'manager' | 'driver'>('student');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handlePreset = (role: typeof rolePreset) => {
    setRolePreset(role);
    setUsername(role);
    setPassword(role);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = login({ username: username.trim(), password });
    if (user) {
      const to = from?.startsWith('/ops/') ? getDashboardPath(user.role) : (from || getDashboardPath(user.role));
      navigate(to, { replace: true });
    } else {
      setError('Invalid credentials. Try a preset below or username/password.');
    }
  };

  return (
    <OpsLayout title="P2P Login">
      <div className="max-w-sm mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">P2P Login</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in as student or ops (admin / manager / driver).</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ops-username" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Username or role
              </label>
              <input
                id="ops-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="student, admin, manager, driver, or driver email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none transition-all"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="ops-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Password
              </label>
              <input
                id="ops-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none transition-all"
                required
                autoComplete="current-password"
              />
            </div>
            <p className="text-xs text-gray-500">Quick presets (same as password):</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handlePreset(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-p2p-blue/30 ${
                    rolePreset === r.value ? 'bg-p2p-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-sm text-p2p-red bg-p2p-light-red/30 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-p2p-blue text-white font-bold hover:bg-p2p-blue/90 focus:outline-none focus:ring-2 focus:ring-p2p-blue focus:ring-offset-2 active:scale-[0.98] transition-all"
            >
              Sign in
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-400">
            Demo: student/student · admin/admin · manager/manager · driver/driver. Drivers added by manager: use email + password &quot;driver&quot;.
          </p>
        </div>
        <p className="mt-6 text-center">
          <Link to="/" className="text-sm font-medium text-p2p-blue hover:underline">
            ← Back to app
          </Link>
        </p>
      </div>
    </OpsLayout>
  );
}
