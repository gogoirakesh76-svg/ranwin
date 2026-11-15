import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Share2, Users, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import type { PromotionStats, User } from '../types';

interface PromotionViewProps {
  user: User | null;
  onRequireAuth: () => void;
}

export function PromotionView({ user, onRequireAuth }: PromotionViewProps) {
  const [stats, setStats] = useState<PromotionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .getPromotionStats()
      .then((res) => setStats(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-8 shadow-xl">
          <Share2 className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-white mt-3">
            RANWIN Agency &amp; Promotion
          </h1>
          <p className="text-sm text-purple-200/80 mt-2">
            Sign in to get your personal invitation link and earn 5% direct + 2% team referral
            commission on every subordinate deposit.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  const inviteCode = stats?.inviteCode ?? user.inviteCode;
  const inviteLink =
    typeof window !== 'undefined' ? `${window.location.origin}/?invite=${inviteCode}` : `?invite=${inviteCode}`;

  async function copyText(text: string, type: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard restrictions
    }
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Agency</h1>
          <p className="text-xs text-purple-200/75 mt-0.5">
            Share your invitation link and earn instant commission on team deposits
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
          5% + 2% Commission
        </span>
      </div>

      {/* Golden Commission Hero Card (Matching 6.05.44 PM) */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 text-slate-950 p-6 text-center shadow-lg">
        <p className="font-mono-num text-3xl sm:text-4xl font-extrabold">
          ₹{(stats?.totalCommission ?? 0).toFixed(2)}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1B1038] text-amber-300 text-xs font-semibold">
          <span>Yesterday&apos;s total commission:</span>
          <span className="font-mono-num font-bold">
            ₹{(stats?.yesterdayCommission ?? 0).toFixed(2)}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-900/85 mt-2.5">
          Upgrade the level to increase commission income
        </p>
      </div>

      {/* Direct vs Team Subordinates Split Card */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden shadow-md">
        <div className="grid grid-cols-2 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 font-display font-bold text-sm text-center">
          <div className="py-2.5 border-r border-amber-600/30">Direct subordinates</div>
          <div className="py-2.5">Team subordinates</div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-purple-800/70 text-center">
          {/* Direct */}
          <div className="p-4 space-y-4">
            <div>
              <p className="font-mono-num text-xl font-bold text-white">
                {stats?.direct.registers ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Number of register</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-emerald-400">
                {stats?.direct.depositCount ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Deposit number</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-amber-300">
                ₹{(stats?.direct.depositAmount ?? 0).toFixed(0)}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Deposit amount</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-white">
                {stats?.direct.firstDepositCount ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5 leading-tight">
                Number of people making first deposit
              </p>
            </div>
          </div>

          {/* Team */}
          <div className="p-4 space-y-4">
            <div>
              <p className="font-mono-num text-xl font-bold text-white">
                {stats?.team.registers ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Number of register</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-emerald-400">
                {stats?.team.depositCount ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Deposit number</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-amber-300">
                ₹{(stats?.team.depositAmount ?? 0).toFixed(0)}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5">Deposit amount</p>
            </div>
            <div>
              <p className="font-mono-num text-xl font-bold text-white">
                {stats?.team.firstDepositCount ?? 0}
              </p>
              <p className="text-[11px] text-purple-200/75 mt-0.5 leading-tight">
                Number of people making first deposit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary INVITATION LINK CTA */}
      <button
        type="button"
        onClick={() => copyText(inviteLink, 'link')}
        className="w-full h-12 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-display font-extrabold text-sm tracking-wide shadow-md inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        {copiedType === 'link' ? (
          <>
            <Check className="w-4 h-4" />
            INVITATION LINK COPIED!
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            INVITATION LINK
          </>
        )}
      </button>

      {/* Copy invitation code row */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Copy invitation code</p>
            <p className="text-xs text-purple-200/70">Share code during registration</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => copyText(inviteCode, 'code')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#140B29] border border-purple-700/60 hover:border-amber-400 text-amber-300 font-mono-num text-sm font-bold transition-colors cursor-pointer"
        >
          <span>{inviteCode}</span>
          {copiedType === 'code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Subordinate Data Table */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-300" />
            <h2 className="font-display font-bold text-sm text-white">Subordinate data</h2>
          </div>
          <span className="text-xs text-purple-200/70 font-mono-num">
            {stats?.subordinates.length ?? 0} Members
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-purple-200/70">Loading agency data...</div>
        ) : !stats || stats.subordinates.length === 0 ? (
          <div className="p-8 text-center text-xs text-purple-200/70">
            No subordinates yet. Share your invitation link above to earn 5% commission whenever friends
            recharge!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#291A4F] text-purple-200/80 text-left">
                  <th className="py-2.5 px-4 font-semibold">Player</th>
                  <th className="py-2.5 px-4 font-semibold">Tier</th>
                  <th className="py-2.5 px-4 font-semibold">Deposits</th>
                  <th className="py-2.5 px-4 font-semibold">Total Recharged</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Your Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-800/40">
                {stats.subordinates.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#26184B]/60">
                    <td className="py-3 px-4 font-semibold text-white">{sub.username}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          sub.level === 1
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {sub.level === 1 ? 'Direct (L1)' : 'Team (L2)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-num text-purple-100">{sub.depositCount}</td>
                    <td className="py-3 px-4 font-mono-num text-purple-100">
                      ₹{sub.depositAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono-num font-bold text-amber-300 text-right">
                      +₹{sub.commissionEarned.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
