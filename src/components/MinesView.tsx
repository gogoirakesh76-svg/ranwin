import { useCallback, useEffect, useState } from 'react';
import { Bomb, Coins, Play, RotateCcw, Sparkles, Trophy, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { playSound } from '../lib/soundEngine';
import { calculateMinesMultiplier, calculateMinesPayout } from '../game/rules';
import type { MinesPlay, User } from '../types';

interface MinesViewProps {
  user: User | null;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
}

const BET_CHIPS = [10, 50, 100, 500, 1000];
const MINES_PRESETS = [1, 3, 5, 8, 12];

export function MinesView({ user, onBalanceChange, onRequireAuth }: MinesViewProps) {
  const [betAmount, setBetAmount] = useState(50);
  const [minesCount, setMinesCount] = useState(3);
  const [activePlay, setActivePlay] = useState<MinesPlay | null>(null);
  const [lastPlay, setLastPlay] = useState<MinesPlay | null>(null);
  const [explodedTile, setExplodedTile] = useState<number | null>(null);
  const [history, setHistory] = useState<MinesPlay[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getMinesHistory();
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
    setBusy(true);
    setError(null);
    setMessage(null);
    setExplodedTile(null);
    setLastPlay(null);
    try {
      const res = await api.startMines(betAmount, minesCount);
      playSound('bet');
      onBalanceChange(res.balance);
      setActivePlay(res.play);
      setMessage('Pick safe gold coins and avoid hidden mines!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Mines.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealTile(idx: number) {
    if (!activePlay || activePlay.status !== 'active' || busy) return;
    if (activePlay.revealedIndices.includes(idx)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await api.revealMinesTile(idx);
      onBalanceChange(res.balance);
      if (res.play.status === 'exploded') {
        playSound('loss');
        setActivePlay(null);
        setLastPlay(res.play);
        setExplodedTile(idx);
        setMessage('Boom! You hit a hidden mine.');
        loadHistory();
      } else if (res.play.status === 'cashed_out') {
        playSound('win');
        setActivePlay(null);
        setLastPlay(res.play);
        setMessage(`All safe tiles cleared! Won ₹${res.play.payout.toFixed(2)}.`);
        loadHistory();
      } else {
        playSound('step');
        setActivePlay(res.play);
        setMessage(
          `Safe Coin! Multiplier ${res.play.multiplier.toFixed(2)}x (₹${calculateMinesPayout(
            res.play.betAmount,
            res.play.multiplier
          ).toFixed(2)})`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reveal failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCashout() {
    if (!activePlay || activePlay.revealedIndices.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.cashoutMines();
      playSound('cashout');
      onBalanceChange(res.balance);
      setActivePlay(null);
      setLastPlay(res.play);
      setMessage(`Cashed out ₹${res.play.payout.toFixed(2)} at ${res.play.multiplier.toFixed(2)}x!`);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  }

  const displayPlay = activePlay ?? lastPlay;
  const activeMines = displayPlay?.minesCount ?? minesCount;
  const revealed = displayPlay?.revealedIndices ?? [];
  const revealedMines = displayPlay?.mineIndices ?? [];
  const remainingSafe = 25 - activeMines - revealed.length;
  const currentMult = activePlay ? activePlay.multiplier : lastPlay?.multiplier ?? 1.0;
  const winDisplay = activePlay
    ? calculateMinesPayout(activePlay.betAmount, activePlay.multiplier)
    : lastPlay?.status === 'cashed_out'
    ? lastPlay.payout
    : 0;

  const ladderSteps = [1, 2, 3, 4, 5, 6].map((step) =>
    calculateMinesMultiplier(activeMines, step)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Royal-Blue MINES JACKPOT Board (Matching mines.png) */}
        <div className="lg:col-span-7 bg-gradient-to-b from-[#133E82] via-[#0B2A5B] to-[#081F44] rounded-3xl border border-sky-400/30 p-5 sm:p-6 shadow-2xl">
          {/* Header with Safe Coins Counter, Title, Mines Counter */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 bg-[#071936]/80 border border-sky-400/30 rounded-xl px-3 py-1.5">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="font-mono-num text-sm font-extrabold text-white">
                {Math.max(0, remainingSafe)}
              </span>
            </div>

            <div className="text-center">
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-wide bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                MINES
              </h1>
              <p className="text-[11px] font-bold tracking-widest uppercase text-sky-200/80">
                JACKPOT ARENA
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#071936]/80 border border-sky-400/30 rounded-xl px-3 py-1.5">
              <Bomb className="w-5 h-5 text-rose-400" />
              <span className="font-mono-num text-sm font-extrabold text-white">{activeMines}</span>
            </div>
          </div>

          {/* Horizontal Multiplier Ladder (Matching mines.png) */}
          <div className="grid grid-cols-6 gap-1.5 mb-4">
            {ladderSteps.map((m, i) => {
              const stepNum = i + 1;
              const cleared = revealed.length >= stepNum && displayPlay?.status !== 'exploded';
              return (
                <div
                  key={stepNum}
                  className={`py-1.5 rounded-lg text-center font-mono-num text-xs font-bold border ${
                    cleared
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#071B3B] text-sky-100 border-sky-500/30'
                  }`}
                >
                  {m.toFixed(2)}x
                </div>
              );
            })}
          </div>

          {/* 5x5 Mines Tile Grid */}
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5 max-w-md mx-auto">
            {Array.from({ length: 25 }).map((_, idx) => {
              const isSafeRevealed = revealed.includes(idx);
              const isMineRevealed = revealedMines.includes(idx);
              const isExploded = explodedTile === idx;
              const canClick = Boolean(activePlay && activePlay.status === 'active' && !isSafeRevealed && !busy);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canClick}
                  onClick={() => handleRevealTile(idx)}
                  aria-label={`Mine tile ${idx + 1}`}
                  className={`aspect-square rounded-xl border-b-4 flex items-center justify-center transition-transform cursor-pointer disabled:cursor-default ${
                    isExploded
                      ? 'bg-rose-700 border-rose-900 scale-95'
                      : isMineRevealed
                      ? 'bg-[#312257] border-[#1F1538]'
                      : isSafeRevealed
                      ? 'bg-gradient-to-b from-[#204D99] to-[#133570] border-amber-400/70'
                      : canClick
                      ? 'bg-[#1D54AD] hover:bg-[#2463C7] border-[#0E2F66] active:translate-y-0.5 shadow-md'
                      : 'bg-[#143D80]/80 border-[#0B2654]'
                  }`}
                >
                  {isExploded || isMineRevealed ? (
                    <Bomb
                      className={`w-7 h-7 sm:w-8 sm:h-8 ${
                        isExploded ? 'text-white' : 'text-sky-200/80'
                      }`}
                    />
                  ) : isSafeRevealed ? (
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 border-2 border-yellow-100 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-5 h-5 text-amber-950" />
                    </div>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-300/25" />
                  )}
                </button>
              );
            })}
          </div>

          {message && (
            <p className="mt-4 text-center text-xs sm:text-sm font-semibold text-amber-300">{message}</p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-center text-xs sm:text-sm font-semibold text-rose-300">
              {error}
            </p>
          )}

          {/* Bottom Casino HUD Bar (Matching mines.png) */}
          <div className="mt-5 pt-4 border-t border-sky-400/20 space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-mono-num">
              <span className="text-sky-200">
                Balance :{' '}
                <strong className="text-white">₹{user ? user.balance.toFixed(2) : '0.00'}</strong>
              </span>
              <span className="text-sky-200">
                WIN :{' '}
                <strong className="text-amber-300">₹{winDisplay.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-4 bg-[#194CA1] border border-sky-300/30 rounded-xl p-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white pl-1">Bet ₹</span>
                <input
                  type="number"
                  aria-label="Mines bet amount"
                  min={10}
                  max={50000}
                  disabled={Boolean(activePlay)}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value) || 10))}
                  className="w-20 bg-[#0A224A] rounded-lg px-2 py-1 text-right font-mono-num text-sm font-bold text-white focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="sm:col-span-4 bg-[#194CA1] border border-sky-300/30 rounded-xl p-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white pl-1">Mines</span>
                <select
                  aria-label="Number of mines"
                  disabled={Boolean(activePlay)}
                  value={minesCount}
                  onChange={(e) => setMinesCount(Number(e.target.value))}
                  className="bg-[#0A224A] rounded-lg px-2.5 py-1 font-mono-num text-sm font-bold text-white focus:outline-none disabled:opacity-50"
                >
                  {MINES_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {m} Mines
                    </option>
                  ))}
                  {[2, 4, 6, 10, 15, 20].map((m) => (
                    <option key={m} value={m}>
                      {m} Mines
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                {activePlay ? (
                  <button
                    type="button"
                    disabled={busy || revealed.length < 1}
                    onClick={handleCashout}
                    className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45"
                  >
                    <Wallet className="w-4 h-4" />
                    Cash Out ₹{winDisplay.toFixed(0)}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleStart}
                    className="w-full h-11 rounded-xl bg-gradient-to-b from-[#34D058] to-[#22863A] hover:from-[#3FE064] hover:to-[#289944] text-white font-extrabold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-lg"
                  >
                    {lastPlay ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    {busy ? 'Starting...' : `Start (₹${betAmount})`}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {BET_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={Boolean(activePlay)}
                  onClick={() => setBetAmount(c)}
                  className={`h-8 rounded-lg font-mono-num text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                    betAmount === c
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#092147] text-sky-100 hover:bg-[#11356E]'
                  }`}
                >
                  ₹{c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Current Multiplier & History */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5">
            <h2 className="font-display text-base font-bold text-white">Live Round Status</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#140B29] border border-purple-800/60">
                <p className="text-[11px] text-purple-300/75">Current Multiplier</p>
                <p className="font-mono-num text-2xl font-bold text-amber-300 mt-0.5">
                  {currentMult.toFixed(2)}x
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#140B29] border border-purple-800/60">
                <p className="text-[11px] text-purple-300/75">Gems Found</p>
                <p className="font-mono-num text-2xl font-bold text-emerald-400 mt-0.5">
                  {revealed.length} / {25 - activeMines}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="font-display text-base font-bold text-white">Recent Mines Rounds</h2>
              </div>
              <span className="text-xs text-purple-300/75 font-mono-num">{history.length}</span>
            </div>
            {!user ? (
              <div className="p-8 text-center">
                <p className="text-sm text-purple-200">Sign in to play Mines and save history.</p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            ) : history.length === 0 ? (
              <p className="p-8 text-center text-sm text-purple-300/75">
                No Mines rounds yet. Tap Start to reveal coins!
              </p>
            ) : (
              <div className="divide-y divide-purple-800/40">
                {history.slice(0, 10).map((h) => (
                  <div key={h.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">
                        Stake ₹{h.betAmount.toFixed(0)} · {h.minesCount} Mines · {h.revealedIndices.length} Gems
                      </p>
                      <p className="text-purple-300/70 mt-0.5 font-mono-num">{h.createdAt}</p>
                    </div>
                    <span
                      className={`font-mono-num font-bold ${
                        h.status === 'cashed_out'
                          ? 'text-emerald-400'
                          : h.status === 'exploded'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {h.status === 'cashed_out'
                        ? `+₹${h.payout.toFixed(2)}`
                        : h.status === 'exploded'
                        ? `-₹${h.betAmount.toFixed(2)}`
                        : 'LIVE'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
