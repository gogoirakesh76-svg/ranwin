import { useCallback, useEffect, useState } from 'react';
import { Disc3, Droplets, Flame, Leaf, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { playSound } from '../lib/soundEngine';
import { VORTEX_LADDER, calculateVortexPayout } from '../game/rules';
import type { User, VortexPlay } from '../types';

interface VortexViewProps {
  user: User | null;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
}

const BET_CHIPS = [10, 50, 100, 500, 1000, 5000];

export function VortexView({ user, onBalanceChange, onRequireAuth }: VortexViewProps) {
  const [betAmount, setBetAmount] = useState(100);
  const [activePlay, setActivePlay] = useState<VortexPlay | null>(null);
  const [history, setHistory] = useState<VortexPlay[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getVortexHistory();
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
    setError(null);
    setMessage(null);
    try {
      const res = await api.startVortex(betAmount);
      playSound('bet');
      onBalanceChange(res.balance);
      setActivePlay(res.play);
      setMessage('Vortex ready! Tap the purple swirl to charge your rings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Vortex.');
    }
  }

  async function handleSpin() {
    if (!activePlay) return;
    setError(null);
    setSpinning(true);
    try {
      await new Promise((r) => setTimeout(r, 420));
      const res = await api.spinVortex();
      onBalanceChange(res.balance);
      if (res.play.status === 'collapsed') {
        playSound('loss');
        setActivePlay(null);
        setMessage('Vortex collapsed! Try another spin.');
      } else if (res.play.status === 'cashed_out') {
        playSound('win');
        setActivePlay(null);
        setMessage(`Maximum Vortex reached! Won ₹${res.play.payout.toFixed(2)}.`);
      } else {
        playSound('step');
        setActivePlay(res.play);
        const last = res.play.history[res.play.history.length - 1];
        setMessage(
          last?.outcome === 'bonus'
            ? `Surge Bonus! Jumped to ${res.play.multiplier}x!`
            : `Orbital Ring Cleared! Multiplier now ${res.play.multiplier}x.`
        );
      }
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spin failed.');
    } finally {
      setSpinning(false);
    }
  }

  async function handleCashout() {
    if (!activePlay || activePlay.stepsCleared < 1) return;
    setError(null);
    try {
      const res = await api.cashoutVortex();
      playSound('cashout');
      onBalanceChange(res.balance);
      setActivePlay(null);
      setMessage(`Cashed out ₹${res.play.payout.toFixed(2)} at ${res.play.multiplier}x!`);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    }
  }

  const currentMult = activePlay ? activePlay.multiplier : 1.0;
  const currentStep = activePlay ? activePlay.stepsCleared : 0;
  const potentialWin = activePlay ? calculateVortexPayout(activePlay.betAmount, currentMult) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Obsidian Cosmic Vortex Wheel (Matching vortex.png) */}
        <div className="lg:col-span-7 relative overflow-hidden rounded-3xl border border-zinc-700/70 bg-[#1B1D24] text-white p-6 sm:p-8 flex flex-col items-center shadow-2xl">
          {/* Subtle Sunburst Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-conic-gradient(from 0deg at 50% 45%, #2D303D 0deg 12deg, #1B1D24 12deg 24deg)',
            }}
          />

          {/* Top Bar */}
          <div className="relative z-10 w-full flex items-center justify-between mb-3">
            <div className="font-mono-num text-xs font-bold text-zinc-200 bg-[#111318] border border-zinc-700 px-3 py-1.5 rounded-xl">
              ₹{user ? user.balance.toFixed(2) : '0.00'}
            </div>
            <div className="text-center">
              <h1 className="font-display text-2xl sm:text-3xl font-black italic tracking-wider bg-gradient-to-r from-fuchsia-300 via-violet-300 to-purple-400 bg-clip-text text-transparent">
                VORTEX
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                OFFICIAL GAME
              </p>
            </div>
            <div className="text-right font-mono-num text-xs text-zinc-400">
              <span className="block text-[10px]">Step</span>
              <span className="font-bold text-amber-300">{currentStep} / 8</span>
            </div>
          </div>

          {/* Concentric Segmented Orbital Wheel with Fire / Earth / Water Badges */}
          <div className="relative z-10 w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center my-3">
            {/* Outer Fire Ring */}
            <div
              className={`absolute inset-0 rounded-full border-[14px] border-[#262933] ring-2 ring-zinc-600/60 shadow-inner ${
                spinning ? 'animate-vortex-fast' : 'animate-vortex-cw'
              }`}
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-b from-orange-400 to-rose-600 border-2 border-amber-200 flex items-center justify-center shadow">
                <Flame className="w-3.5 h-3.5 text-white" />
              </span>
            </div>

            {/* Middle Earth Ring */}
            <div
              className={`absolute inset-7 rounded-full border-[14px] border-[#20232C] ring-2 ring-zinc-600/50 ${
                spinning ? 'animate-vortex-fast' : 'animate-vortex-ccw'
              }`}
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-green-700 border-2 border-emerald-200 flex items-center justify-center shadow">
                <Leaf className="w-3 h-3 text-white" />
              </span>
            </div>

            {/* Inner Water Ring */}
            <div
              className={`absolute inset-14 rounded-full border-[12px] border-[#191C24] ring-2 ring-zinc-600/50 ${
                spinning ? 'animate-vortex-fast' : 'animate-vortex-cw'
              }`}
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-sky-400 to-blue-700 border-2 border-sky-200 flex items-center justify-center shadow">
                <Droplets className="w-3 h-3 text-white" />
              </span>
            </div>

            {/* Radial Tick Multipliers */}
            <span className="absolute top-3 right-12 font-mono-num text-[11px] font-bold text-zinc-300">
              3.9x
            </span>
            <span className="absolute top-12 right-3 font-mono-num text-[11px] font-bold text-zinc-300">
              12.5x
            </span>
            <span className="absolute bottom-12 right-3 font-mono-num text-[11px] font-bold text-zinc-300">
              15.0x
            </span>
            <span className="absolute bottom-12 left-4 font-mono-num text-[11px] font-bold text-amber-300">
              1.55x
            </span>
            <span className="absolute top-12 left-4 font-mono-num text-[11px] font-bold text-emerald-300">
              BONUS
            </span>

            {/* Center Core Readout */}
            <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-b from-[#2B2E3B] to-[#14161C] border-2 border-zinc-500/60 flex flex-col items-center justify-center shadow-2xl">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Multiplier
              </span>
              <span
                data-testid="vortex-multiplier"
                className="font-mono-num text-2xl font-black text-amber-300 mt-0.5"
              >
                {currentMult.toFixed(2)}x
              </span>
              {activePlay && (
                <span className="font-mono-num text-[11px] text-emerald-400 font-bold">
                  ₹{potentialWin.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* 8-Step Ring Ladder */}
          <div className="relative z-10 w-full grid grid-cols-8 gap-1 mb-4">
            {VORTEX_LADDER.slice(1).map((m, idx) => {
              const stepNum = idx + 1;
              const cleared = currentStep >= stepNum;
              return (
                <div
                  key={m}
                  className={`py-1 rounded-lg text-center font-mono-num text-[11px] font-bold border ${
                    cleared
                      ? 'bg-violet-600 text-white border-fuchsia-400'
                      : 'bg-[#12141A] text-zinc-400 border-zinc-700/70'
                  }`}
                >
                  {m}x
                </div>
              );
            })}
          </div>

          {message && (
            <p className="relative z-10 mb-3 text-xs sm:text-sm font-semibold text-amber-300 text-center">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="relative z-10 mb-3 text-xs sm:text-sm font-semibold text-rose-400 text-center">
              {error}
            </p>
          )}

          {/* Bottom Vortex Controls (Matching vortex.png glowing purple swirl + CASH OUT) */}
          <div className="relative z-10 w-full space-y-3">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={Boolean(activePlay)}
                onClick={() => setBetAmount((v) => Math.max(10, v - 10))}
                aria-label="Decrease Vortex bet"
                className="w-9 h-9 rounded-full bg-[#2A2D38] hover:bg-zinc-700 border border-zinc-600 text-white font-bold text-base cursor-pointer disabled:opacity-40"
              >
                -
              </button>
              <div className="text-center">
                <label htmlFor="vortex-bet" className="block text-[10px] text-zinc-400 font-semibold">
                  Bet Amount
                </label>
                <div className="flex items-center gap-1 justify-center">
                  <input
                    id="vortex-bet"
                    type="number"
                    min={10}
                    max={50000}
                    disabled={Boolean(activePlay)}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value) || 10))}
                    className="w-24 bg-transparent text-center font-mono-num text-base font-extrabold text-white focus:outline-none disabled:opacity-60"
                  />
                  <span className="text-xs font-bold text-zinc-400">INR</span>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(activePlay)}
                onClick={() => setBetAmount((v) => Math.min(50000, v + 10))}
                aria-label="Increase Vortex bet"
                className="w-9 h-9 rounded-full bg-[#2A2D38] hover:bg-zinc-700 border border-zinc-600 text-white font-bold text-base cursor-pointer disabled:opacity-40"
              >
                +
              </button>
            </div>

            {!activePlay && (
              <div className="grid grid-cols-6 gap-1.5">
                {BET_CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBetAmount(c)}
                    className={`h-8 rounded-lg font-mono-num text-xs font-bold transition-colors cursor-pointer ${
                      betAmount === c
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#12141A] text-zinc-300 border border-zinc-700/70 hover:bg-zinc-800'
                    }`}
                  >
                    ₹{c}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-5 pt-1">
              <button
                type="button"
                disabled={!activePlay || spinning || activePlay.stepsCleared < 1}
                onClick={handleCashout}
                className="w-24 h-14 rounded-2xl bg-[#272A35] hover:bg-amber-500 hover:text-slate-950 border border-zinc-600 text-xs font-extrabold uppercase tracking-wide text-zinc-200 transition-colors cursor-pointer disabled:opacity-40"
              >
                CASH
                <br />
                OUT
              </button>

              {!activePlay ? (
                <button
                  type="button"
                  onClick={handleStart}
                  aria-label="Enter Vortex"
                  className="w-20 h-20 rounded-full bg-gradient-to-b from-fuchsia-500 via-violet-600 to-purple-800 hover:from-fuchsia-400 hover:to-violet-700 border-4 border-fuchsia-300/60 shadow-[0_0_25px_rgba(168,85,247,0.6)] flex flex-col items-center justify-center text-white font-extrabold text-xs cursor-pointer transition-transform active:scale-95"
                >
                  <Disc3 className="w-7 h-7" />
                  <span className="text-[10px] mt-0.5">PLAY</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={spinning}
                  onClick={handleSpin}
                  aria-label="Spin Next Ring"
                  className="w-20 h-20 rounded-full bg-gradient-to-b from-fuchsia-500 via-violet-600 to-purple-800 hover:from-fuchsia-400 hover:to-violet-700 border-4 border-fuchsia-300/70 shadow-[0_0_30px_rgba(192,132,252,0.7)] flex flex-col items-center justify-center text-white font-extrabold text-xs cursor-pointer transition-transform active:scale-95 disabled:opacity-60"
                >
                  <Disc3 className={`w-7 h-7 ${spinning ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] mt-0.5">{spinning ? '...' : 'SPIN'}</span>
                </button>
              )}

              <div className="w-24 text-center">
                <p className="text-[10px] text-zinc-400 uppercase font-semibold">Payout</p>
                <p className="font-mono-num text-sm font-bold text-emerald-400 mt-0.5">
                  ₹{potentialWin.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Vortex History & Rules */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="font-display text-base font-bold text-white">How Vortex Works</h2>
            </div>
            <ul className="text-xs text-purple-200/80 space-y-2 leading-relaxed">
              <li>1. Select your INR bet amount and tap PLAY to activate the Vortex wheel.</li>
              <li>2. Tap SPIN to advance across Fire, Earth, and Water orbital rings up to 15.0x.</li>
              <li>3. Hit CASH OUT anytime after ring 1 to credit your payout immediately.</li>
            </ul>
          </div>

          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">Your Vortex History</h2>
              <Disc3 className="w-4 h-4 text-amber-300" />
            </div>
            <div className="divide-y divide-purple-800/40">
              {!user ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-purple-200">Sign in to play Vortex and track runs.</p>
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-sm text-purple-300/75">
                  No Vortex runs yet. Tap PLAY to start.
                </div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">
                        Stake ₹{h.betAmount.toFixed(2)} · {h.stepsCleared} rings
                      </p>
                      <p className="text-purple-300/70 mt-0.5">
                        {h.status === 'cashed_out'
                          ? `Cashed out at ${h.multiplier}x`
                          : h.status === 'collapsed'
                          ? 'Collapsed'
                          : 'Active'}
                      </p>
                    </div>
                    <span
                      className={`font-mono-num font-bold ${
                        h.status === 'cashed_out'
                          ? 'text-emerald-400'
                          : h.status === 'collapsed'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {h.status === 'cashed_out'
                        ? `+₹${h.payout.toFixed(2)}`
                        : h.status === 'collapsed'
                        ? `-₹${h.betAmount.toFixed(2)}`
                        : 'LIVE'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
