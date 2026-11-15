import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { api, getStoredToken, setStoredToken } from '../lib/api';
import type { User } from '../types';
import { AdminView } from './AdminView';

export function AdminPortal() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setChecked(true);
      return;
    }
    api
      .me()
      .then((res) => {
        if (res.user.role === 'admin') {
          setAdminUser(res.user);
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(identifier, password);
      if (res.user.role !== 'admin') {
        setError('This portal is restricted to administrators only.');
        return;
      }
      setStoredToken(res.token);
      setAdminUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogout() {
    const token = getStoredToken();
    setStoredToken(null);
    setAdminUser(null);
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B061A] text-purple-200 text-sm font-semibold">
        Loading RANWIN Admin Portal...
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-[#0B061A] text-purple-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-[#1B1038] rounded-2xl border border-purple-700/50 p-7 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                RANWIN Control Center
              </p>
              <h1 className="font-display text-xl font-bold text-white">Administrator Sign In</h1>
            </div>
          </div>

          <p className="text-xs text-purple-200/75 mt-3">
            Authorized staff only. Sign in with your administrator credentials to manage live WinGo
            periods, deposits, withdrawals, and UPI QR settings.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-id" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Admin Email or Phone
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-id"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter admin email or phone"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#110826] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-pass" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#110826] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-purple-300 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Sign In to Admin Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#140B29] text-purple-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0E0720]/95 backdrop-blur-md border-b border-purple-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <p className="font-display text-base font-extrabold text-white leading-tight">
                RANWIN Admin Portal
              </p>
              <p className="text-[11px] text-amber-300 leading-none">{adminUser.username}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1">
        <AdminView />
      </main>
    </div>
  );
}
