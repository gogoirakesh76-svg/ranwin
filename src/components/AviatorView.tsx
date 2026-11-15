import { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Plane, Play, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { playSound } from '../lib/soundEngine';
import { calculateAviatorMultiplierAtElapsed, calculateAviatorPayout } from '../game/rules';
import type { AviatorPlay, User } from '../types';

interface AviatorViewProps {
  user: User | null;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
}

const QUICK_CHIPS = [100, 200, 500, 1000];
const DEFAULT_HISTORY_CHIPS = [2.22, 1.34, 1.55, 3.14, 1.08, 2.63, 3.8, 3.23, 1.76, 1.24, 2.18, 2.85];

export function AviatorView({ user, onBalanceChange, onRequireAuth }: AviatorViewProps) {
  const [betAmount, setBetAmount] = useState(100);
  const [activePlay, setActivePlay] = useState<AviatorPlay | null>(null);
  const [history, setHistory] = useState<AviatorPlay[]>([]);
  const [liveMultiplier, setLiveMultiplier] = useState(1.0);
  const [flightStatus, setFlightStatus] = useState<'idle' | 'flying' | 'cashed_out' | 'crashed'>('idle');
  const [lastResultText, setLastResultText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rafRef = useRef<number | null>(null);
  const crashTriggeredRef = useRef(false);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getAviatorHistory();
      setHistory(res.history);
      if (res.activePlay && res.activePlay.status === 'active') {
        const elapsed = Date.now() - res.activePlay.startedAt;
        const mult = calculateAviatorMultiplierAtElapsed(elapsed);
        if (mult >= res.activePlay.crashMultiplier) {
          await api.crashAviator().catch(() => {});
          const refreshed = await api.getAviatorHistory().catch(() => null);
          if (refreshed) setHistory(refreshed.history);
          setActivePlay(null);
          setFlightStatus('idle');
        } else {
          setActivePlay(res.activePlay);
          setFlightStatus('flying');
        }
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (flightStatus !== 'flying' || !activePlay) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    crashTriggeredRef.current = false;

    const tick = () => {
      const elapsed = Math.max(0, Date.now() - activePlay.startedAt);
      const nextMult = calculateAviatorMultiplierAtElapsed(elapsed);

      if (nextMult >= activePlay.crashMultiplier) {
        setLiveMultiplier(activePlay.crashMultiplier);
        setFlightStatus('crashed');
        playSound('loss');
        setLastResultText(`Flew away at ${activePlay.crashMultiplier.toFixed(2)}x!`);
        if (!crashTriggeredRef.current) {
          crashTriggeredRef.current = true;
          api
            .crashAviator()
            .then((res) => {
              onBalanceChange(res.balance);
              setActivePlay(null);
              loadHistory();
            })
            .catch(() => {
              setActivePlay(null);
            });
        }
        return;
      }

      setLiveMultiplier(nextMult);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flightStatus, activePlay, onBalanceChange, loadHistory]);

  async function handleStartFlight() {
    if (!user) {
      onRequireAuth();
      return;
    }
    setError(null);
    setLastResultText(null);
    setBusy(true);
    try {
      const res = await api.startAviator(betAmount);
      playSound('bet');
      onBalanceChange(res.balance);
      setActivePlay(res.play);
      setLiveMultiplier(1.0);
      setFlightStatus('flying');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place Aviator bet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCashout() {
    if (!activePlay || flightStatus !== 'flying' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.cashoutAviator();
      onBalanceChange(res.balance);
      if (res.play.status === 'cashed_out') {
        playSound('cashout');
        setLiveMultiplier(res.play.cashoutMultiplier ?? liveMultiplier);
        setFlightStatus('cashed_out');
        setLastResultText(
          `Cashed out ₹${res.play.payout.toFixed(2)} at ${(res.play.cashoutMultiplier ?? liveMultiplier).toFixed(2)}x!`
        );
      } else {
        playSound('loss');
        setLiveMultiplier(res.play.crashMultiplier);
        setFlightStatus('crashed');
        setLastResultText(`Flew away at ${res.play.crashMultiplier.toFixed(2)}x!`);
      }
      setActivePlay(null);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  }

  const livePayout = activePlay
    ? calculateAviatorPayout(activePlay.betAmount, liveMultiplier)
    : calculateAviatorPayout(betAmount, 1.0);

  const curveProgress = Math.min(1, Math.max(0.05, (liveMultiplier - 1) / 3.5));
  const endX = 40 + curveProgress * 310;
  const endY = 205 - Math.pow(curveProgress, 0.8) * 145;

  const historyChips =
    history.length > 0
      ? history.slice(0, 14).map((h) => h.cashoutMultiplier ?? h.crashMultiplier)
      : DEFAULT_HISTORY_CHIPS;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-4">
      {/* Top Multiplier Strip (Matching aviator.png) */}
      <div className="bg-[#111216] border border-zinc-800 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-extrabold text-base tracking-tight text-rose-500 italic">
            Aviator
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {historyChips.map((m, idx) => (
            <span
              key={`${m}-${idx}`}
              className={`px-2.5 py-0.5 rounded-full font-mono-num text-xs font-bold whitespace-nowrap ${
                m >= 5
                  ? 'bg-pink-500/20 text-pink-300'
                  : m >= 2
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-sky-500/15 text-sky-300'
              }`}
            >
              {m.toFixed(2)}x
            </span>
          ))}
        </div>
        <div className="font-mono-num text-xs font-bold text-emerald-400 whitespace-nowrap shrink-0">
          ₹{user ? user.balance.toFixed(2) : '0.00'}
        </div>
      </div>

      {/* Main Arena Split (Matching aviator.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: My Bets Feed */}
        <div className="lg:col-span-4 bg-[#16171C] border border-zinc-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h2 className="font-display text-sm font-bold text-white">My Flight Bets</h2>
            <span className="text-[11px] text-zinc-400 font-mono-num">{history.length} rounds</span>
          </div>
          <div className="grid grid-cols-3 text-[11px] font-semibold text-zinc-400 py-2 px-2">
            <span>Bet INR</span>
            <span className="text-center">X</span>
            <span className="text-right">Win INR</span>
          </div>
          <div className="flex-1 divide-y divide-zinc-800/60 max-h-[360px] overflow-y-auto">
            {!user ? (
              <div className="py-10 text-center">
                <p className="text-xs text-zinc-400">Sign in to track your flights.</p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            ) : history.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-400">
                No flights yet. Place a bet below to take off!
              </p>
            ) : (
              history.slice(0, 14).map((h) => (
                <div
                  key={h.id}
                  className={`grid grid-cols-3 items-center py-2 px-2 rounded-lg text-xs font-mono-num ${
                    h.status === 'cashed_out' ? 'bg-emerald-950/35' : ''
                  }`}
                >
                  <span className="text-zinc-200 font-semibold">₹{h.betAmount.toFixed(2)}</span>
                  <span className="text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        h.status === 'cashed_out'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {(h.cashoutMultiplier ?? h.crashMultiplier).toFixed(2)}x
                    </span>
                  </span>
                  <span
                    className={`text-right font-bold ${
                      h.status === 'cashed_out' ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  >
                    {h.status === 'cashed_out' ? `₹${h.payout.toFixed(2)}` : '0.00'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Radial Flight Stage + Bottom Bet Controls */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Flight Canvas */}
          <div className="relative rounded-2xl border border-zinc-800 bg-[#0A0B0E] overflow-hidden min-h-[290px] sm:min-h-[330px] flex flex-col items-center justify-center">
            {/* Radial sunburst rays backdrop */}
            <div
              className="absolute inset-0 opacity-35 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-conic-gradient(from 0deg at 0% 100%, #1C2029 0deg 10deg, #0A0B0E 10deg 20deg)',
              }}
            />

            {/* Animated Trajectory Curve & Plane */}
            <svg
              viewBox="0 0 400 220"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="aviatorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E11D48" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              {flightStatus !== 'idle' && (
                <>
                  <path
                    d={`M 20 205 Q ${endX * 0.55} 200, ${endX} ${endY} L ${endX} 205 Z`}
                    fill="url(#aviatorFill)"
                  />
                  <path
                    d={`M 20 205 Q ${endX * 0.55} 200, ${endX} ${endY}`}
                    fill="none"
                    stroke="#F43F5E"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>

            {/* Plane Icon positioned along trajectory */}
            {flightStatus === 'flying' && (
              <div
                className="absolute z-10 transition-transform duration-75"
                style={{
                  left: `${(endX / 400) * 100}%`,
                  top: `${(endY / 220) * 100}%`,
                  transform: 'translate(-50%, -65%) rotate(-12deg)',
                }}
              >
                <div className="w-11 h-11 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <Plane className="w-7 h-7 text-rose-500 fill-rose-500" />
                </div>
              </div>
            )}

            {/* Giant Center Multiplier Readout */}
            <div className="relative z-20 text-center px-4">
              {flightStatus === 'crashed' && (
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-rose-400 mb-1">
                  FLEW AWAY!
                </p>
              )}
              {flightStatus === 'cashed_out' && (
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-emerald-400 mb-1">
                  CASHED OUT!
                </p>
              )}
              <div
                data-testid="aviator-multiplier"
                className={`font-mono-num text-5xl sm:text-7xl font-extrabold tracking-tight ${
                  flightStatus === 'crashed'
                    ? 'text-rose-500'
                    : flightStatus === 'cashed_out'
                    ? 'text-emerald-400'
                    : 'text-white'
                }`}
              >
                {liveMultiplier.toFixed(2)}x
              </div>
              {lastResultText && (
                <p className="mt-2 text-xs sm:text-sm font-semibold text-amber-300">{lastResultText}</p>
              )}
              {flightStatus === 'idle' && (
                <p className="mt-2 text-xs text-zinc-400">
                  Place your bet and cash out before the plane flies away!
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="relative z-20 mt-2 text-xs font-semibold text-rose-400">
                {error}
              </p>
            )}
          </div>

          {/* Bottom Bet Control Panel (Matching aviator.png green Bet button) */}
          <div className="bg-[#1B1C22] border border-zinc-800 rounded-2xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-6 space-y-2.5">
                <div className="flex items-center justify-between bg-[#101114] border border-zinc-700 rounded-xl px-3 h-11">
                  <button
                    type="button"
                    disabled={flightStatus === 'flying'}
                    onClick={() => setBetAmount((v) => Math.max(10, v - 10))}
                    className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm cursor-pointer disabled:opacity-40"
                    aria-label="Decrease bet"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    aria-label="Aviator bet amount"
                    min={10}
                    max={50000}
                    disabled={flightStatus === 'flying'}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value) || 10))}
                    className="w-28 bg-transparent text-center font-mono-num text-base font-bold text-white focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={flightStatus === 'flying'}
                    onClick={() => setBetAmount((v) => Math.min(50000, v + 10))}
                    className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm cursor-pointer disabled:opacity-40"
                    aria-label="Increase bet"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={flightStatus === 'flying'}
                      onClick={() => setBetAmount(c)}
                      className={`h-8 rounded-lg font-mono-num text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                        betAmount === c
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#262830] text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      {c.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-6">
                {flightStatus === 'flying' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCashout}
                    className="w-full h-[84px] rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-lg shadow-lg flex flex-col items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm uppercase tracking-wide">
                      <Banknote className="w-4 h-4" />
                      Cash Out
                    </span>
                    <span className="font-mono-num text-2xl font-black mt-0.5">
                      ₹{livePayout.toFixed(2)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleStartFlight}
                    className="w-full h-[84px] rounded-2xl bg-gradient-to-b from-[#28B72A] to-[#1E8E20] hover:from-[#30CC32] hover:to-[#229E24] text-white font-extrabold text-lg shadow-lg flex flex-col items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1.5 text-base">
                      <Play className="w-4 h-4 fill-white" />
                      {busy ? 'Taking Off...' : 'Bet'}
                    </span>
                    <span className="font-mono-num text-xl font-black mt-0.5">
                      {betAmount.toFixed(2)} INR
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Info Ribbon */}
          <div className="bg-[#16171C] border border-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Provably Fair Crash Multiplier · RTP 96.38%
            </span>
            <span>Min Bet ₹10 · Max ₹50,000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
