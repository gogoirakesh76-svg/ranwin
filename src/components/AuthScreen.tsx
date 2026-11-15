import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, Sparkles, User as UserIcon } from 'lucide-react';
import { api, setStoredToken } from '../lib/api';
import type { User } from '../types';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const initialInvite =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') ?? '' : '';
  const [mode, setMode] = useState<'login' | 'register'>(initialInvite ? 'register' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(identifier, password);
        setStoredToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await api.register({ username, phone, email, password, inviteCode });
        setStoredToken(res.token);
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden shadow-xl">
        {/* Left Brand Showcase Panel */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#3B1E7A] to-[#221247] text-white p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-amber-300 tracking-wide">RANWIN Trading Desk</p>
            <h1 className="font-display text-3xl font-bold mt-2 leading-tight text-balance">
              Fast Colour Trading &amp; Instant Settlements
            </h1>
            <p className="text-sm text-purple-100/85 mt-4 leading-relaxed">
              Trade live 30sec, 1Min, 3Min, 5Min, and 10Min WinGo prediction rounds, Vortex multiplier
              arena, and Chicken Road with instant wallet tracking.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-purple-500/30 space-y-2.5">
            <p className="text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              First Deposit Bonus Chart
            </p>
            <div className="rounded-xl bg-[#140B29]/70 border border-purple-500/30 p-3 space-y-1.5 text-xs font-mono-num">
              <div className="flex justify-between text-purple-100">
                <span>Deposit ₹90</span>
                <span className="text-amber-300 font-bold">+₹10 Bonus</span>
              </div>
              <div className="flex justify-between text-purple-100">
                <span>Deposit ₹200</span>
                <span className="text-amber-300 font-bold">+₹18 Bonus</span>
              </div>
              <div className="flex justify-between text-purple-100">
                <span>Deposit ₹500</span>
                <span className="text-amber-300 font-bold">+₹58 Bonus</span>
              </div>
              <div className="flex justify-between text-purple-100">
                <span>Deposit ₹1,000</span>
                <span className="text-amber-300 font-bold">+₹88 Bonus</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 text-purple-50">
          <div className="flex items-center gap-1 p-1 bg-[#140B29] rounded-xl w-fit mb-6 border border-purple-800/60">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-violet-600 text-white shadow-sm' : 'text-purple-200/80 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-purple-200/80 hover:text-white'
              }`}
            >
              Register Account
            </button>
          </div>

          <h2 className="font-display text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back to RANWIN' : 'Create your RANWIN account'}
          </h2>
          <p className="text-sm text-purple-200/75 mt-1">
            {mode === 'login'
              ? 'Sign in with your phone number or email address.'
              : 'Create your player account and recharge ₹90+ to unlock First Deposit Bonus.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-sm text-rose-200 font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-purple-200 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. Aarav Kumar"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-purple-200 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm font-mono-num focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-purple-200 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label htmlFor="login-id" className="block text-xs font-semibold text-purple-200 mb-1.5">
                  Phone Number or Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-id"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="player@jadepulse.win or 9876543210"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
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

            {mode === 'register' && (
              <div>
                <label htmlFor="reg-invite" className="block text-xs font-semibold text-purple-200 mb-1.5">
                  Invite Code (Optional)
                </label>
                <input
                  id="reg-invite"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. RW88421"
                  className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm font-mono-num focus:outline-none focus:border-violet-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In to RANWIN'
                : 'Create Player Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
