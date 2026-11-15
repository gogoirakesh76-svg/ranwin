import { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Crown, Gift, Lock, Star } from 'lucide-react';
import { api } from '../lib/api';
import { VIP_TIERS } from '../game/rules';
import type { User } from '../types';

interface VipViewProps {
  user: User | null;
  onBack: () => void;
  onUserUpdated: (user: User) => void;
  onRequireAuth: () => void;
}

export function VipView({ user, onBack, onUserUpdated, onRequireAuth }: VipViewProps) {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-8 shadow-xl">
          <Crown className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-white mt-3">RANWIN VIP Club</h1>
          <p className="text-sm text-purple-200/80 mt-2">
            Sign in to track your betting EXP and unlock VIP level-up rewards.
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

  const totalExp = Math.floor(user.totalBetExp ?? 0);
  const claimedLevels = user.claimedVipLevels ?? [];
  const activeTier = VIP_TIERS.find((t) => t.level === selectedLevel) ?? VIP_TIERS[0];
  const progressPct = Math.min(100, (totalExp / activeTier.requiredExp) * 100);
  const isUnlocked = totalExp >= activeTier.requiredExp;
  const isClaimed = claimedLevels.includes(activeTier.level);

  async function handleClaim() {
    if (!isUnlocked || isClaimed) return;
    setFeedback(null);
    setClaiming(true);
    try {
      const res = await api.claimVipReward(activeTier.level);
      onUserUpdated({
        ...user!,
        balance: res.balance,
        claimedVipLevels: res.claimedVipLevels,
      });
      setFeedback({
        type: 'success',
        text: `VIP${activeTier.level} bonus ₹${res.bonusAmount} credited to your wallet!`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not claim VIP bonus.',
      });
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
      {/* Header matching 6.07.51 PM */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Account"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F133D] border border-purple-700/50 text-purple-100 hover:text-white text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="font-display text-xl font-bold text-white">VIP</h1>
        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
          VIP{user.vipLevel ?? 0}
        </span>
      </div>

      {/* User VIP Summary Card */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 font-display font-extrabold text-lg flex items-center justify-center">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#2B1B54] border border-amber-400/50 text-amber-300 text-xs font-bold inline-flex items-center gap-1">
                <Crown className="w-3 h-3" />
                VIP{user.vipLevel ?? 0}
              </span>
              <span className="font-display font-bold text-base text-white">{user.username}</span>
            </div>
            <p className="text-xs text-purple-200/70 mt-0.5">Bet across WinGo, Vortex &amp; Chicken Road</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#27184B] rounded-xl p-3.5 text-center border border-purple-700/40">
            <p className="font-mono-num text-xl font-extrabold text-amber-300">
              {totalExp.toLocaleString()} EXP
            </p>
            <p className="text-xs text-purple-200/75 mt-0.5">My experience</p>
          </div>
          <div className="bg-[#27184B] rounded-xl p-3.5 text-center border border-purple-700/40">
            <p className="font-mono-num text-xl font-extrabold text-white">
              {claimedLevels.length} / {VIP_TIERS.length}
            </p>
            <p className="text-xs text-purple-200/75 mt-0.5">Claimed tiers</p>
          </div>
        </div>

        <div className="rounded-xl bg-[#140B29] border border-purple-800/60 px-4 py-2.5 text-center text-xs text-purple-200/80">
          Bet ₹1 = 1 EXP · Complete VIP betting targets to unlock instant level-up rewards
        </div>
      </div>

      {/* Tier Selector Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {VIP_TIERS.map((tier) => {
          const active = selectedLevel === tier.level;
          const unlocked = totalExp >= tier.requiredExp;
          return (
            <button
              key={tier.level}
              type="button"
              onClick={() => {
                setSelectedLevel(tier.level);
                setFeedback(null);
              }}
              className={`py-2.5 px-2 rounded-xl border text-center cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 border-amber-300 text-slate-950 font-extrabold shadow-sm'
                  : 'bg-[#1F133D] border-purple-700/50 text-white hover:border-purple-400 font-semibold'
              }`}
            >
              <span className="block text-sm font-display">{tier.name}</span>
              <span
                className={`block text-[10px] font-mono-num mt-0.5 ${
                  active ? 'text-slate-900' : unlocked ? 'text-emerald-400' : 'text-purple-200/80'
                }`}
              >
                ₹{tier.levelUpBonus} Bonus
              </span>
            </button>
          );
        })}
      </div>

      {/* Active VIP Tier Card (Matching 6.07.51 PM - 6.07.57 PM) */}
      <div
        className={`rounded-2xl bg-gradient-to-br ${activeTier.gradient} text-slate-950 p-6 shadow-lg relative overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Crown className="w-6 h-6" />
              <span className="font-display text-2xl font-extrabold">{activeTier.name}</span>
              {isClaimed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Claimed
                </span>
              ) : isUnlocked ? (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-950/80 text-amber-300 text-xs font-bold">
                  Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/25 text-slate-950 text-xs font-bold">
                  <Lock className="w-3 h-3" />
                  Not open yet
                </span>
              )}
            </div>
            <p className="text-sm font-semibold mt-2 text-slate-900">
              Upgrading {activeTier.name} requires {activeTier.requiredExp.toLocaleString()} EXP
            </p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-white/30 text-slate-950 text-xs font-bold">
              Bet ₹1 = 1 EXP
            </span>
          </div>

          <div className="w-16 h-16 rounded-full bg-white/30 border-2 border-white/60 flex items-center justify-center shrink-0">
            <Star className="w-8 h-8 text-slate-950 fill-slate-950/20" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5">
          <div className="w-full h-2.5 rounded-full bg-slate-950/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-950 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono-num font-bold text-slate-900">
            <span>
              {Math.min(totalExp, activeTier.requiredExp).toLocaleString()}/
              {activeTier.requiredExp.toLocaleString()}
            </span>
            <span>
              {isUnlocked
                ? `${activeTier.name} target completed!`
                : `${(activeTier.requiredExp - totalExp).toLocaleString()} EXP needed`}
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* VIP Benefits Level Card */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-300" />
            {activeTier.name} Benefits level
          </h2>
          <button
            type="button"
            disabled={!isUnlocked || isClaimed || claiming}
            onClick={handleClaim}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
              isClaimed
                ? 'bg-emerald-600/30 text-emerald-300 cursor-default'
                : isUnlocked
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                : 'bg-[#2B1B54] text-purple-300/60 cursor-not-allowed'
            }`}
          >
            {claiming
              ? 'Claiming...'
              : isClaimed
              ? 'Reward Claimed'
              : isUnlocked
              ? `Claim ₹${activeTier.levelUpBonus} Bonus`
              : `Locked (${activeTier.requiredExp.toLocaleString()} EXP)`}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#27184B]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Level up rewards</p>
                <p className="text-xs text-purple-200/75">Each account can only receive 1 time</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#140B29] border border-amber-400/40 font-mono-num text-sm font-extrabold text-amber-300">
              ₹{activeTier.levelUpBonus}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#27184B]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Monthly reward</p>
                <p className="text-xs text-purple-200/75">Each account can receive 1 time per month</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#140B29] border border-purple-700/60 font-mono-num text-sm font-extrabold text-white">
              ₹{activeTier.monthlyBonus}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#27184B]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Deposit Reward</p>
                <p className="text-xs text-purple-200/75">VIP tier deposit boost</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#140B29] border border-purple-700/60 font-mono-num text-sm font-extrabold text-emerald-300">
              {activeTier.depositBonusPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
