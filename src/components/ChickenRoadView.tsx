import { useCallback, useEffect, useState } from 'react';
import { Bird, Footprints, Play, ShieldAlert, Trophy, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { playSound } from '../lib/soundEngine';
import { CHICKEN_LADDERS, calculateChickenPayout } from '../game/rules';
import type { ChickenDifficulty, ChickenPlay, User } from '../types';

interface ChickenRoadViewProps {
  user: User | null;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
}

const PRESET_BETS = [10, 50, 100, 500, 1000];

export function ChickenRoadView({ user, onBalanceChange, onRequireAuth }: ChickenRoadViewProps) {
  const [betInput, setBetInput] = useState('50');
  const [difficulty, setDifficulty] = useState<ChickenDifficulty>('easy');
  const [activePlay, setActivePlay] = useState<ChickenPlay | null>(null);
  const [history, setHistory] = useState<ChickenPlay[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getChickenHistory();
      setActivePlay(res.activePlay);
      setHistory(res.history);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleStart() {
    if (!user) {
      onRequireAuth();
      return;
    }
    const amt = Number(betInput);
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.startChicken(amt, difficulty);
      playSound('bet');
      onBalanceChange(res.balance);
      setActivePlay(res.play);
      setMessage({ type: 'info', text: 'Run started! Step across lanes or cash out safely.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start run.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleStep() {
    if (!user || !activePlay) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.stepChicken();
      onBalanceChange(res.balance);
      if (res.play.status === 'crashed') {
        playSound('loss');
        setActivePlay(res.play);
        setMessage({
          type: 'error',
          text: `Traffic hazard on Lane ${res.play.trapLane}! Try again.`,
        });
        loadHistory();
      } else if (res.play.status === 'cashed_out') {
        playSound('win');
        setActivePlay(res.play);
        setMessage({
          type: 'success',
          text: `Road cleared! Max jackpot ₹${res.play.payout.toFixed(2)} credited.`,
        });
        loadHistory();
      } else {
        playSound('step');
        setActivePlay(res.play);
        setMessage({
          type: 'success',
          text: `Crossed Lane ${res.play.currentLane}! Multiplier is ${res.play.multiplier.toFixed(2)}x.`,
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Step failed.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCashout() {
    if (!user || !activePlay) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.cashoutChicken();
      playSound('cashout');
      onBalanceChange(res.balance);
      setActivePlay(res.play);
      setMessage({
        type: 'success',
        text: `Cashed out ₹${res.play.payout.toFixed(2)} at ${res.play.multiplier.toFixed(2)}x!`,
      });
      loadHistory();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cashout failed.' });
    } finally {
      setLoading(false);
    }
  }

  const activeDiff: ChickenDifficulty = activePlay?.status === 'active' ? activePlay.difficulty : difficulty;
  const ladder = CHICKEN_LADDERS[activeDiff];
  const isRunning = activePlay?.status === 'active';
  const currentLane = activePlay ? activePlay.currentLane : 0;
  const currentMult = activePlay ? activePlay.multiplier : 1.0;
  const potentialPayout = activePlay
    ? calculateChickenPayout(activePlay.betAmount, currentMult)
    : calculateChickenPayout(Number(betInput) || 0, 1.0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
      {/* Dark Asphalt Chicken Road Highway Stage (Matching chickenroad.png) */}
      <div className="rounded-3xl border border-slate-700/80 bg-[#252A3F] overflow-hidden shadow-2xl">
        {/* Top Highway Header */}
        <div className="px-5 py-3 bg-[#1D2133] border-b border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg sm:text-xl font-black tracking-wide text-white flex items-center gap-1.5">
              <span>CHICKEN</span>
              <span className="text-amber-400">ROAD</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
              Online · RTP 96.58%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-lg bg-[#2E344D] text-xs font-mono-num font-bold text-white">
              {user ? `₹${user.balance.toFixed(2)}` : '₹0.00'}
            </span>
          </div>
        </div>

        {/* Multi-Lane Asphalt Highway with Circular Manhole Multiplier Steps */}
        <div className="bg-[#343A54] px-4 py-6 overflow-x-auto">
          <div className="min-w-[680px] grid grid-cols-9 gap-2 items-stretch">
            {/* Starting Archway Lane */}
            <div className="flex flex-col items-center justify-end pb-3 border-r-2 border-dashed border-slate-400/35 pr-2">
              <div className="w-full h-36 rounded-t-full bg-[#1C2030] border-2 border-slate-600/70 flex flex-col items-center justify-end pb-3">
                {currentLane === 0 ? (
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-amber-400 flex items-center justify-center shadow-lg">
                    <Bird className="w-7 h-7 text-amber-500" />
                  </div>
                ) : (
                  <span className="text-[10px] uppercase font-bold text-slate-400">Start</span>
                )}
              </div>
              <span className="mt-2 text-[11px] font-bold text-slate-300">GATE</span>
            </div>

            {/* 8 Multiplier Manhole Lanes */}
            {ladder.slice(1).map((mult, idx) => {
              const laneNum = idx + 1;
              const isCurrent = activePlay && activePlay.currentLane === laneNum && activePlay.status !== 'crashed';
              const cleared =
                activePlay &&
                (activePlay.status === 'active' || activePlay.status === 'cashed_out') &&
                laneNum <= activePlay.currentLane;
              const crashedHere = activePlay?.status === 'crashed' && activePlay.trapLane === laneNum;
              const isNext = isRunning && laneNum === currentLane + 1;

              return (
                <div
                  key={laneNum}
                  className={`flex flex-col items-center justify-between py-2 px-1 ${
                    idx < 7 ? 'border-r-2 border-dashed border-slate-400/35' : ''
                  }`}
                >
                  <span className="text-[10px] font-semibold text-slate-300/75 uppercase">
                    Lane {laneNum}
                  </span>

                  {/* Circular Manhole Multiplier Pad (Matching chickenroad.png) */}
                  <div
                    className={`my-3 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-inner transition-all ${
                      crashedHere
                        ? 'bg-rose-700 border-rose-400 text-white'
                        : isCurrent
                        ? 'bg-emerald-600 border-amber-300 text-white ring-4 ring-amber-400/35'
                        : cleared
                        ? 'bg-emerald-800/80 border-emerald-400 text-emerald-100'
                        : isNext
                        ? 'bg-[#4B5378] border-amber-400 text-white'
                        : 'bg-[#464D6E] border-[#5D668F] text-slate-100'
                    }`}
                  >
                    {crashedHere ? (
                      <ShieldAlert className="w-7 h-7 text-white" />
                    ) : isCurrent ? (
                      <Bird className="w-7 h-7 text-amber-300" />
                    ) : (
                      <span className="font-mono-num text-sm font-extrabold">{mult.toFixed(2)}x</span>
                    )}
                  </div>

                  {/* Asphalt Drain Grate Footer */}
                  <div className="w-12 h-5 rounded-t-lg bg-[#23273A] border border-slate-600/50 flex items-center justify-around px-1.5">
                    <span className="w-0.5 h-3 bg-slate-500/50" />
                    <span className="w-0.5 h-3 bg-slate-500/50" />
                    <span className="w-0.5 h-3 bg-slate-500/50" />
                    <span className="w-0.5 h-3 bg-slate-500/50" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            role="status"
            className={`px-5 py-2.5 text-xs sm:text-sm font-semibold border-t ${
              message.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                : message.type === 'error'
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-200'
                : 'bg-[#1D2133] border-slate-700 text-amber-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Bottom Dark Control Bar (Matching chickenroad.png MIN/MAX + Difficulty + Green Play) */}
        <div className="p-4 sm:p-5 bg-[#22273B] border-t border-slate-700/80 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Bet Amount + Quick Chips */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center gap-1.5 bg-[#181C2B] border border-slate-700 rounded-xl p-1.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setBetInput('10')}
                className="px-2.5 py-1.5 rounded-lg bg-[#2D334D] hover:bg-slate-600 text-[11px] font-bold text-slate-200 cursor-pointer disabled:opacity-40"
              >
                MIN
              </button>
              <input
                id="chicken-bet"
                aria-label="Stake Amount"
                type="number"
                min={10}
                max={50000}
                disabled={isRunning}
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                className="flex-1 bg-transparent text-center font-mono-num text-base font-extrabold text-white focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setBetInput('5000')}
                className="px-2.5 py-1.5 rounded-lg bg-[#2D334D] hover:bg-slate-600 text-[11px] font-bold text-slate-200 cursor-pointer disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_BETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setBetInput(String(amt))}
                  className={`h-8 rounded-lg font-mono-num text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                    Number(betInput) === amt
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#2E344E] text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Mode */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold">Difficulty</span>
              <span className="font-mono-num text-amber-300 font-bold">
                {currentMult.toFixed(2)}x · ₹{potentialPayout.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-[#181C2B] p-1.5 rounded-xl border border-slate-700">
              {(['easy', 'medium', 'hard'] as ChickenDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isRunning || loading}
                  onClick={() => setDifficulty(d)}
                  className={`h-9 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer disabled:opacity-50 ${
                    activeDiff === d
                      ? 'bg-[#4D5578] text-white border border-slate-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Giant Bright Green Play / Step + Cash Out Buttons */}
          <div className="lg:col-span-4">
            {!isRunning ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleStart}
                className="w-full h-14 rounded-2xl bg-gradient-to-b from-[#3BD15F] to-[#27A644] hover:from-[#47DF6C] hover:to-[#2EB84E] text-white font-black text-lg inline-flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-white" />
                {loading ? 'Starting...' : 'Play'}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStep}
                  className="h-14 rounded-2xl bg-gradient-to-b from-[#3BD15F] to-[#27A644] hover:from-[#47DF6C] hover:to-[#2EB84E] text-white font-extrabold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Footprints className="w-4 h-4" />
                  {loading ? '...' : 'Step'}
                </button>
                <button
                  type="button"
                  disabled={loading || currentLane < 1}
                  onClick={handleCashout}
                  className="h-14 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Wallet className="w-4 h-4" />
                  ₹{potentialPayout.toFixed(0)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chicken Road History */}
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-base font-bold text-white">Recent Chicken Road Runs</h2>
          </div>
          <span className="text-xs text-purple-300/75 font-mono-num">{history.length} runs</span>
        </div>

        {!user ? (
          <p className="p-6 text-sm text-purple-300/75 text-center">Sign in to save and track your runs.</p>
        ) : history.length === 0 ? (
          <p className="p-6 text-sm text-purple-300/75 text-center">
            No runs yet. Place a stake and press Play to cross Lane 1!
          </p>
        ) : (
          <div className="divide-y divide-purple-800/40">
            {history.slice(0, 8).map((h) => (
              <div key={h.id} className="px-5 py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white capitalize">
                    {h.difficulty} · Lane {h.currentLane}
                  </p>
                  <p className="text-purple-300/75 font-mono-num mt-0.5">
                    Stake ₹{h.betAmount.toFixed(2)} · {h.createdAt}
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  {h.status === 'cashed_out' ? (
                    <span className="font-bold text-emerald-400">
                      +₹{h.payout.toFixed(2)} ({h.multiplier.toFixed(2)}x)
                    </span>
                  ) : h.status === 'crashed' ? (
                    <span className="font-semibold text-rose-400">Crashed</span>
                  ) : (
                    <span className="font-semibold text-amber-300">Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
