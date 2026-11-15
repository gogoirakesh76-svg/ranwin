import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Crown,
  Headphones,
  History,
  Megaphone,
  MessageSquare,
  Power,
  RefreshCw,
  Settings,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';
import type { AppView } from './TopNav';

interface AccountViewProps {
  user: User | null;
  onUserUpdated: (user: User) => void;
  onNavigate: (view: AppView) => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onLogout: () => void;
}

type InfoModalType = 'settings' | 'announcement' | 'guide' | 'about' | null;

export function AccountView({
  user,
  onUserUpdated,
  onNavigate,
  onOpenDeposit,
  onOpenWithdraw,
  onLogout,
}: AccountViewProps) {
  const [copiedUid, setCopiedUid] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-8 shadow-xl">
          <Crown className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-white mt-3">RANWIN Account &amp; VIP</h1>
          <p className="text-sm text-purple-200/80 mt-2">
            Sign in to view your UID, VIP level rewards, game history, and customer service.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  const uidDisplay = String(100000 + user.id);
  const initials = user.username
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleRefreshProfile() {
    setRefreshing(true);
    try {
      const res = await api.me();
      onUserUpdated(res.user);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopyUid() {
    try {
      await navigator.clipboard.writeText(uidDisplay);
    } catch {
      // ignore
    }
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 1800);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
      {/* Top User Profile Card */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 flex items-center gap-4 shadow-md">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-amber-500 p-0.5 shrink-0">
          <div className="w-full h-full rounded-full bg-[#140B29] flex items-center justify-center font-display text-xl font-extrabold text-amber-300">
            {initials || 'RW'}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg sm:text-xl font-bold text-white uppercase truncate">
              {user.username}
            </h1>
            <button
              type="button"
              onClick={() => onNavigate('vip')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 text-xs font-extrabold cursor-pointer"
            >
              <Crown className="w-3 h-3" />
              VIP{user.vipLevel ?? 0}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUid}
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono-num font-semibold cursor-pointer hover:bg-amber-500/30"
            >
              <span>UID | {uidDisplay}</span>
              {copiedUid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1.5 font-mono-num">
            Last login: {user.lastLoginAt ?? user.createdAt}
          </p>
        </div>
      </div>

      {/* Total Balance Card + 4 Quick Icons */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-purple-200/75">Total balance</p>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="font-mono-num text-3xl font-extrabold text-white">
                ₹{user.balance.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={handleRefreshProfile}
                aria-label="Refresh balance"
                className="p-1.5 rounded-lg bg-[#2B1B54] hover:bg-purple-800 text-purple-200 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-purple-200/70">Betting EXP</p>
            <p className="font-mono-num text-sm font-bold text-amber-300">
              {Math.floor(user.totalBetExp ?? 0).toLocaleString()} EXP
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#27184B] hover:bg-purple-800/70 border border-purple-700/40 transition-colors cursor-pointer"
          >
            <Wallet className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-semibold text-white">Wallet</span>
          </button>
          <button
            type="button"
            onClick={onOpenDeposit}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#27184B] hover:bg-purple-800/70 border border-purple-700/40 transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold text-white">Deposit</span>
          </button>
          <button
            type="button"
            onClick={onOpenWithdraw}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#27184B] hover:bg-purple-800/70 border border-purple-700/40 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-5 h-5 text-sky-400" />
            <span className="text-xs font-semibold text-white">Withdraw</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('vip')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#27184B] hover:bg-purple-800/70 border border-amber-400/50 transition-colors cursor-pointer"
          >
            <Crown className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold text-amber-300">VIP</span>
          </button>
        </div>
      </div>

      {/* VIP Highlights Banner */}
      <button
        type="button"
        onClick={() => onNavigate('vip')}
        className="w-full text-left bg-gradient-to-r from-[#2D1A5E] to-[#3B1E7A] hover:from-[#36206E] hover:to-[#472692] rounded-2xl border border-amber-400/40 p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">
              VIP Club Rewards — Level Up Bonus up to ₹1,500
            </p>
            <p className="text-xs text-purple-200/80 mt-0.5">
              VIP1 (3,000 Bet EXP): ₹60 Bonus · VIP2 (10,000 Bet EXP): ₹180 Bonus
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-300 shrink-0" />
      </button>

      {/* 2x2 Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('wingo')}
          className="bg-[#1F133D] hover:bg-[#28194E] rounded-2xl border border-purple-700/50 p-4 flex items-center gap-3.5 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">Game History</p>
            <p className="text-xs text-purple-200/70">My WinGo &amp; mini-game bets</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('promotion')}
          className="bg-[#1F133D] hover:bg-[#28194E] rounded-2xl border border-purple-700/50 p-4 flex items-center gap-3.5 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <UsersRound className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">Promotion Agency</p>
            <p className="text-xs text-purple-200/70">Share link &amp; referral income</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenDeposit}
          className="bg-[#1F133D] hover:bg-[#28194E] rounded-2xl border border-purple-700/50 p-4 flex items-center gap-3.5 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">Deposit</p>
            <p className="text-xs text-purple-200/70">My deposit history (Min ₹90)</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenWithdraw}
          className="bg-[#1F133D] hover:bg-[#28194E] rounded-2xl border border-purple-700/50 p-4 flex items-center gap-3.5 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">Withdraw</p>
            <p className="text-xs text-purple-200/70">My withdraw history (Min ₹110)</p>
          </div>
        </button>
      </div>

      {/* Service Center Card (Matching logoutoptionandcustomerservice.png) */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 shadow-md">
        <h2 className="font-display text-sm font-bold text-white mb-4">Service center</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <button
            type="button"
            onClick={() => setInfoModal('settings')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <Settings className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-medium text-purple-100">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('support')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-medium text-purple-100">Feedback</span>
          </button>

          <button
            type="button"
            onClick={() => setInfoModal('announcement')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <Megaphone className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-medium text-purple-100">Announcement</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('support')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <Headphones className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-semibold text-amber-200">Customer Service</span>
          </button>

          <button
            type="button"
            onClick={() => setInfoModal('guide')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <BookOpen className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-medium text-purple-100">Beginner&apos;s Guide</span>
          </button>

          <button
            type="button"
            onClick={() => setInfoModal('about')}
            className="flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-[#28194E] transition-colors cursor-pointer"
          >
            <Box className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-medium text-purple-100">About us</span>
          </button>
        </div>
      </div>

      {/* Full-Width Outlined Log out Button (Matching logoutoptionandcustomerservice.png) */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full h-12 rounded-full bg-transparent hover:bg-rose-950/50 border border-amber-400/50 text-amber-200 hover:text-rose-200 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Power className="w-4 h-4" />
        Log out
      </button>

      {/* Lightweight Service Center Info Modal */}
      {infoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#1F133D] border border-purple-600/60 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white capitalize">
                {infoModal === 'guide'
                  ? "Beginner's Guide"
                  : infoModal === 'about'
                  ? 'About RANWIN'
                  : infoModal}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg bg-[#2B1B54] text-purple-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-purple-100/90 space-y-2 leading-relaxed">
              {infoModal === 'settings' && (
                <>
                  <p>Account: <strong className="text-white">{user.username}</strong> ({user.phone})</p>
                  <p>Email: <strong className="text-white">{user.email}</strong></p>
                  <p>UID: <strong className="font-mono-num text-amber-300">{uidDisplay}</strong></p>
                </>
              )}
              {infoModal === 'announcement' && (
                <p>
                  Deposit min ₹90 via QR to receive First Deposit Bonus rewards up to ₹88. Minimum
                  withdrawal is ₹110. VIP1 unlocks at 3,000 Bet EXP (₹60 reward) and VIP2 at 10,000
                  Bet EXP (₹180 reward).
                </p>
              )}
              {infoModal === 'guide' && (
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>WinGo: Predict Green, Red, Violet, Big/Small or digits 0–9 every 30s to 10m.</li>
                  <li>Aviator: Place your bet and Cash Out before the plane flies away.</li>
                  <li>Mines: Reveal gold coins on the 5×5 board and cash out before hitting a mine.</li>
                  <li>Vortex &amp; Chicken Road: Advance step by step to boost multipliers and cash out anytime.</li>
                </ul>
              )}
              {infoModal === 'about' && (
                <p>
                  RANWIN provides fast, transparent colour trading and instant-cashout mini games with
                  24/7 customer support.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
