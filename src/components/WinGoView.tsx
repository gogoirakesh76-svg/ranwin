import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Shuffle,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { playSound } from '../lib/soundEngine';
import {
  INTERVAL_CONFIG,
  INTERVAL_LIST,
  calculateBetAmount,
  formatCountdown,
  getNumberProperties,
} from '../game/rules';
import type { BetType, GameInterval, User, WinGoStateResponse } from '../types';
import { WinGoBall } from './WinGoBall';
import { WinGoWinningModal, type WinningCelebrationData } from './WinGoWinningModal';

interface WinGoViewProps {
  user: User | null;
  interval: GameInterval;
  onIntervalChange: (iv: GameInterval) => void;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
}

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];
const UNIT_BALANCES = [1, 10, 50, 100, 1000];

export function WinGoView({
  user,
  interval,
  onIntervalChange,
  onBalanceChange,
  onRequireAuth,
  onOpenDeposit,
  onOpenWithdraw,
}: WinGoViewProps) {
  const [state, setState] = useState<WinGoStateResponse | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'history' | 'chart' | 'mybets'>('history');
  const [selectedMultiplier, setSelectedMultiplier] = useState(1);
  const [localTimeLeft, setLocalTimeLeft] = useState(0);

  // Track pending bets so when they settle as WON, we pop up the Winning Celebration Modal!
  const pendingBetIdsRef = useRef<Set<number>>(new Set());
  const celebratedPeriodsRef = useRef<Set<string>>(new Set());
  const [winningModal, setWinningModal] = useState<WinningCelebrationData | null>(null);

  // Betting Modal State
  const [betModal, setBetModal] = useState<{
    betType: BetType;
    betValue: string;
    label: string;
    headerBg: string;
    buttonBg: string;
  } | null>(null);
  const [unitAmount, setUnitAmount] = useState(50);
  const [quantity, setQuantity] = useState(1);
  const [modalMultiplier, setModalMultiplier] = useState(1);
  const [agreedRules, setAgreedRules] = useState(true);
  const [placingBet, setPlacingBet] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getWinGoState(interval, page);
      setState(data);
      setLocalTimeLeft(data.timeRemainingSec);

      // Detect newly settled winning or losing bets
      if (data.myBets && data.myBets.length > 0) {
        const newlyWonPeriods = new Set<string>();
        const newlyLostPeriods = new Set<string>();
        for (const bet of data.myBets) {
          if (bet.status === 'pending') {
            pendingBetIdsRef.current.add(bet.id);
          } else if (bet.status === 'won' && pendingBetIdsRef.current.has(bet.id)) {
            pendingBetIdsRef.current.delete(bet.id);
            const key = `${bet.intervalKey}:${bet.period}`;
            if (!celebratedPeriodsRef.current.has(key)) {
              newlyWonPeriods.add(bet.period);
            }
          } else if (bet.status === 'lost' && pendingBetIdsRef.current.has(bet.id)) {
            pendingBetIdsRef.current.delete(bet.id);
            const key = `${bet.intervalKey}:${bet.period}`;
            if (!celebratedPeriodsRef.current.has(key)) {
              newlyLostPeriods.add(bet.period);
            }
          }
        }

        if (newlyWonPeriods.size > 0) {
          const latestWonPeriod = Array.from(newlyWonPeriods)[0];
          const key = `${interval}:${latestWonPeriod}`;
          celebratedPeriodsRef.current.add(key);

          const periodWinningBets = data.myBets.filter(
            (b) => b.period === latestWonPeriod && b.status === 'won'
          );
          const totalPayout = Number(
            periodWinningBets.reduce((sum, b) => sum + b.payout, 0).toFixed(2)
          );
          const settledRound =
            data.history.find((r) => r.period === latestWonPeriod) ??
            data.chartRounds.find((r) => r.period === latestWonPeriod);

          if (totalPayout > 0 && settledRound && settledRound.resultNumber !== null) {
            const props = getNumberProperties(settledRound.resultNumber);
            playSound('win');
            setWinningModal({
              outcome: 'win',
              period: latestWonPeriod,
              interval,
              totalPayout,
              resultNumber: props.number,
              resultSize: props.size,
              resultColors: props.colors,
            });
          }
        } else if (newlyLostPeriods.size > 0) {
          const latestLostPeriod = Array.from(newlyLostPeriods)[0];
          const key = `${interval}:${latestLostPeriod}`;
          celebratedPeriodsRef.current.add(key);

          const settledRound =
            data.history.find((r) => r.period === latestLostPeriod) ??
            data.chartRounds.find((r) => r.period === latestLostPeriod);

          if (settledRound && settledRound.resultNumber !== null) {
            const props = getNumberProperties(settledRound.resultNumber);
            playSound('loss');
            setWinningModal({
              outcome: 'loss',
              period: latestLostPeriod,
              interval,
              totalPayout: 0,
              resultNumber: props.number,
              resultSize: props.size,
              resultColors: props.colors,
            });
          }
        }
      }

      if (user) {
        api
          .me()
          .then((meRes) => {
            if (meRes.user.balance !== user.balance) {
              onBalanceChange(meRes.user.balance);
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore transient poll error
    }
  }, [interval, page, user, onBalanceChange]);

  useEffect(() => {
    fetchState();
    const poll = setInterval(fetchState, 2000);
    return () => clearInterval(poll);
  }, [fetchState]);

  useEffect(() => {
    const tick = setInterval(() => {
      setLocalTimeLeft((prev) => {
        if (prev <= 1) {
          fetchState();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchState]);

  function openBetSheet(betType: BetType, betValue: string) {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (localTimeLeft <= 5) {
      setFeedback({ type: 'error', text: 'Betting is locked in the final 5 seconds of this round.' });
      return;
    }

    let label = `Select ${betValue}`;
    let headerBg = 'bg-violet-600';
    let buttonBg = 'bg-violet-600 hover:bg-violet-700';

    if (betType === 'color') {
      if (betValue === 'Green') {
        headerBg = 'bg-emerald-600';
        buttonBg = 'bg-emerald-600 hover:bg-emerald-700';
      } else if (betValue === 'Red') {
        headerBg = 'bg-rose-600';
        buttonBg = 'bg-rose-600 hover:bg-rose-700';
      } else {
        headerBg = 'bg-violet-600';
        buttonBg = 'bg-violet-600 hover:bg-violet-700';
      }
    } else if (betType === 'size') {
      if (betValue === 'Big') {
        headerBg = 'bg-amber-600';
        buttonBg = 'bg-amber-600 hover:bg-amber-700';
      } else {
        headerBg = 'bg-sky-600';
        buttonBg = 'bg-sky-600 hover:bg-sky-700';
      }
    } else {
      const n = Number(betValue);
      label = `Select Number ${n}`;
      if (n === 0 || n === 5) {
        headerBg = 'bg-violet-600';
        buttonBg = 'bg-violet-600 hover:bg-violet-700';
      } else if (n % 2 === 1) {
        headerBg = 'bg-emerald-600';
        buttonBg = 'bg-emerald-600 hover:bg-emerald-700';
      } else {
        headerBg = 'bg-rose-600';
        buttonBg = 'bg-rose-600 hover:bg-rose-700';
      }
    }

    setUnitAmount(50);
    setQuantity(1);
    setModalMultiplier(selectedMultiplier);
    setAgreedRules(true);
    setFeedback(null);
    setBetModal({ betType, betValue, label, headerBg, buttonBg });
  }

  function handleRandomPick() {
    const randDigit = Math.floor(Math.random() * 10);
    openBetSheet('number', String(randDigit));
  }

  async function confirmBet() {
    if (!betModal || !state) return;
    if (!agreedRules) {
      setFeedback({ type: 'error', text: 'Please agree to the Pre-sale rules before placing a bet.' });
      return;
    }

    setPlacingBet(true);
    setFeedback(null);
    try {
      const res = await api.placeWinGoBet({
        intervalKey: interval,
        period: state.activeRound.period,
        betType: betModal.betType,
        betValue: betModal.betValue,
        unitAmount,
        quantity,
        multiplier: modalMultiplier,
      });
      pendingBetIdsRef.current.add(res.bet.id);
      playSound('bet');
      onBalanceChange(res.balance);
      setBetModal(null);
      setFeedback({
        type: 'success',
        text: `Bet placed on ${betModal.betValue} (₹${res.bet.totalAmount.toFixed(2)}) for period ${res.bet.period}.`,
      });
      setActiveTab('mybets');
      fetchState();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Bet failed.' });
    } finally {
      setPlacingBet(false);
    }
  }

  function openReceiptForBet(outcome: 'win' | 'loss', period: string, payout: number) {
    const round =
      state?.history.find((r) => r.period === period) ??
      state?.chartRounds.find((r) => r.period === period);
    const props = getNumberProperties(round?.resultNumber ?? 8);
    setWinningModal({
      outcome,
      period,
      interval,
      totalPayout: payout,
      resultNumber: props.number,
      resultSize: props.size,
      resultColors: props.colors,
    });
  }

  const digits = formatCountdown(localTimeLeft);
  const isLocked = localTimeLeft <= 5 && localTimeLeft > 0;
  const activeCfg = INTERVAL_CONFIG[interval];
  const betCalc = calculateBetAmount(unitAmount, quantity, modalMultiplier);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7/12): Purple Wallet + Timers + Ticket + Betting Board */}
        <div className="lg:col-span-7 space-y-4">
          {/* Top Royal Purple Wallet Panel */}
          <div className="rounded-2xl bg-gradient-to-br from-[#3B1E7A] via-[#5B21B6] to-[#7C3AED] p-5 text-white shadow-md border border-purple-400/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-purple-100/85">Wallet Balance</p>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="font-mono-num text-3xl font-bold tracking-tight">
                    ₹{user ? user.balance.toFixed(2) : '0.00'}
                  </span>
                  <button
                    type="button"
                    onClick={fetchState}
                    aria-label="Refresh balance and round state"
                    className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:w-64">
                <button
                  type="button"
                  onClick={onOpenWithdraw}
                  className="h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Withdraw
                </button>
                <button
                  type="button"
                  onClick={onOpenDeposit}
                  className="h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Deposit
                </button>
              </div>
            </div>

            {/* Announcement Ribbon */}
            <div className="mt-4 bg-[#140B29]/45 backdrop-blur-sm rounded-xl px-3.5 py-2 flex items-center gap-2.5 text-xs text-purple-100">
              <Volume2 className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="overflow-hidden whitespace-nowrap flex-1">
                <div className="animate-marquee">
                  <span className="mr-12">{state?.announcement || 'Welcome to RANWIN Colour Trading'}</span>
                  <span className="mr-12">{state?.announcement || 'Welcome to RANWIN Colour Trading'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Interval Selector Tabs: 30sec, 1Min, 3Min, 5Min, 10Min */}
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-1.5 grid grid-cols-5 gap-1">
            {INTERVAL_LIST.map((iv) => {
              const cfg = INTERVAL_CONFIG[iv];
              const isSelected = interval === iv;
              return (
                <button
                  key={iv}
                  type="button"
                  onClick={() => {
                    onIntervalChange(iv);
                    setPage(1);
                  }}
                  className={`py-2.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-violet-600 to-purple-800 text-white shadow-sm border border-purple-400/40'
                      : 'text-purple-200/75 hover:bg-purple-900/50'
                  }`}
                >
                  <Clock className={`w-5 h-5 ${isSelected ? 'text-amber-300' : 'text-purple-300/60'}`} />
                  <span className="text-[11px] sm:text-xs font-semibold leading-tight text-center whitespace-nowrap">
                    {cfg.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Split Coupon Ticket Card */}
          <div className="relative rounded-2xl bg-gradient-to-r from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] text-white p-4 sm:p-5 grid grid-cols-12 items-center gap-3 overflow-hidden shadow-md border border-purple-400/30">
            {/* Left Side: How to play + Mode + Last 5 balls */}
            <div className="col-span-7 pr-3 border-r border-dashed border-white/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHowToPlay(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/40 hover:bg-white/10 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  How to play
                </button>
              </div>
              <p className="text-sm font-semibold text-amber-300 mt-2.5">{activeCfg.label}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {(state?.last5 ?? []).map((r) => (
                  <WinGoBall key={r.period} digit={r.resultNumber ?? 0} size="xs" />
                ))}
              </div>
            </div>

            {/* Right Side: Countdown + Period Number */}
            <div className="col-span-5 text-right flex flex-col items-end justify-center">
              <p className="text-xs font-medium text-purple-100/90">Time remaining</p>
              <div
                aria-label={`Time remaining ${digits.m1}${digits.m2}:${digits.s1}${digits.s2}`}
                className="flex items-center gap-1 mt-1.5 font-mono-num"
              >
                <span className="w-7 h-9 rounded-md bg-[#140B29] border border-purple-400/40 text-amber-300 font-bold text-xl flex items-center justify-center shadow-sm">
                  {digits.m1}
                </span>
                <span className="w-7 h-9 rounded-md bg-[#140B29] border border-purple-400/40 text-amber-300 font-bold text-xl flex items-center justify-center shadow-sm">
                  {digits.m2}
                </span>
                <span className="font-bold text-lg px-0.5 text-amber-300">:</span>
                <span className="w-7 h-9 rounded-md bg-[#140B29] border border-purple-400/40 text-amber-300 font-bold text-xl flex items-center justify-center shadow-sm">
                  {digits.s1}
                </span>
                <span className="w-7 h-9 rounded-md bg-[#140B29] border border-purple-400/40 text-amber-300 font-bold text-xl flex items-center justify-center shadow-sm">
                  {digits.s2}
                </span>
              </div>
              <p
                data-testid="active-period"
                className="font-mono-num text-xs sm:text-sm font-bold tracking-wider text-white mt-2.5"
              >
                {state?.activeRound.period ?? '2026000000011'}
              </p>
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-xl text-sm font-medium border flex items-center justify-between gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss message"
                className="p-1 hover:opacity-70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Betting Controls Board */}
          <div className="relative bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4 sm:p-5 space-y-4">
            {/* Final 5s Lock Overlay */}
            {isLocked && (
              <div className="absolute inset-0 z-20 bg-[#120829]/80 backdrop-blur-[2px] rounded-2xl flex items-center justify-center gap-4">
                <div className="w-20 h-24 rounded-2xl bg-gradient-to-b from-violet-600 to-purple-800 border border-purple-400/50 text-amber-300 font-mono-num font-bold text-5xl flex items-center justify-center shadow-lg">
                  0
                </div>
                <div className="w-20 h-24 rounded-2xl bg-gradient-to-b from-violet-600 to-purple-800 border border-purple-400/50 text-amber-300 font-mono-num font-bold text-5xl flex items-center justify-center shadow-lg">
                  {localTimeLeft}
                </div>
              </div>
            )}

            {/* Color Buttons: Green, Violet, Red */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => openBetSheet('color', 'Green')}
                className="h-11 rounded-tr-xl rounded-bl-xl rounded-tl-md rounded-br-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
              >
                Green
              </button>
              <button
                type="button"
                onClick={() => openBetSheet('color', 'Violet')}
                className="h-11 rounded-md bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
              >
                Violet
              </button>
              <button
                type="button"
                onClick={() => openBetSheet('color', 'Red')}
                className="h-11 rounded-tl-xl rounded-br-xl rounded-tr-md rounded-bl-md bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
              >
                Red
              </button>
            </div>

            {/* Number Balls 0-9 */}
            <div className="bg-[#160D2E] border border-purple-800/60 rounded-xl p-3 sm:p-4 grid grid-cols-5 gap-3 justify-items-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => openBetSheet('number', String(num))}
                  aria-label={`Bet on number ${num}`}
                  className="p-1 rounded-full hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                  <WinGoBall digit={num} size="lg" />
                </button>
              ))}
            </div>

            {/* Random + Multiplier Strip */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleRandomPick}
                className="px-3 h-9 rounded-lg border border-amber-400/60 text-amber-300 hover:bg-amber-500/15 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Random
              </button>
              {MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMultiplier(m)}
                  className={`flex-1 min-w-[44px] h-9 rounded-lg text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                    selectedMultiplier === m
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#2B1B54] text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  X{m}
                </button>
              ))}
            </div>

            {/* Big / Small Split Action */}
            <div className="grid grid-cols-2 rounded-full overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => openBetSheet('size', 'Big')}
                className="h-11 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Big
              </button>
              <button
                type="button"
                onClick={() => openBetSheet('size', 'Small')}
                className="h-11 bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Small
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5/12): Game History (10 rows), SVG Chart, My Betting History */}
        <div className="lg:col-span-5 bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
          <div className="p-3 border-b border-purple-800/60 grid grid-cols-3 gap-2 bg-[#160D2E]">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-[#28194E] text-purple-200 border border-purple-700/50 hover:bg-purple-800/60'
              }`}
            >
              Game history
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'chart'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-[#28194E] text-purple-200 border border-purple-700/50 hover:bg-purple-800/60'
              }`}
            >
              Chart
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mybets')}
              className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'mybets'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-[#28194E] text-purple-200 border border-purple-700/50 hover:bg-purple-800/60'
              }`}
            >
              My history
            </button>
          </div>

          {/* TAB 1: Game History (10 Results + Pagination) */}
          {activeTab === 'history' && (
            <div>
              <div className="grid grid-cols-12 bg-[#3B1E7A] text-purple-100 text-xs font-semibold py-3 px-4">
                <span className="col-span-5">Period</span>
                <span className="col-span-2 text-center">Number</span>
                <span className="col-span-3 text-center">Big Small</span>
                <span className="col-span-2 text-right">Color</span>
              </div>

              <div className="divide-y divide-purple-800/40">
                {(state?.history ?? []).map((row) => {
                  const num = row.resultNumber ?? 0;
                  const numColorClass =
                    num === 0
                      ? 'text-rose-400'
                      : num === 5
                      ? 'text-emerald-400'
                      : num % 2 === 1
                      ? 'text-emerald-400'
                      : 'text-rose-400';

                  return (
                    <div
                      key={row.period}
                      className="grid grid-cols-12 items-center py-2.5 px-4 text-xs sm:text-sm hover:bg-purple-900/30"
                    >
                      <span className="col-span-5 font-mono-num text-purple-100 font-medium truncate">
                        {row.period}
                      </span>
                      <span className={`col-span-2 text-center font-display font-bold text-lg ${numColorClass}`}>
                        {num}
                      </span>
                      <span className="col-span-3 text-center font-medium text-purple-200">
                        {row.resultSize}
                      </span>
                      <span className="col-span-2 flex items-center justify-end gap-1">
                        {row.resultColors.map((c) => (
                          <span
                            key={c}
                            title={c}
                            className={`w-3 h-3 rounded-full inline-block ${
                              c === 'Green'
                                ? 'bg-emerald-400'
                                : c === 'Red'
                                ? 'bg-rose-400'
                                : 'bg-violet-400'
                            }`}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-purple-800/50 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous history page"
                  className="w-9 h-9 rounded-lg border border-purple-700/60 bg-[#28194E] flex items-center justify-center text-purple-100 hover:bg-purple-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono-num text-xs font-semibold text-purple-200">
                  {state?.page ?? 1} / {state?.totalPages ?? 1}
                </span>
                <button
                  type="button"
                  disabled={!state || page >= state.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next history page"
                  className="w-9 h-9 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Trend Chart (Missing/Freq Stats + Aligned SVG Polyline Matrix) */}
          {activeTab === 'chart' && state && (
            <div className="p-3 sm:p-4 space-y-4">
              {/* Statistic Summary */}
              <div className="text-[11px] font-mono-num space-y-1.5 pb-3 border-b border-purple-800/50">
                <p className="text-xs font-sans font-semibold text-purple-100 mb-2">
                  Statistic (last 20 Periods)
                </p>
                {[
                  { label: 'Missing', vals: state.trendStats.missing },
                  { label: 'Avg missing', vals: state.trendStats.avgMissing },
                  { label: 'Frequency', vals: state.trendStats.frequency },
                  { label: 'Max consec', vals: state.trendStats.maxConsecutive },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-12 items-center">
                    <span className="col-span-4 font-sans text-purple-300/80">{row.label}</span>
                    <div className="col-span-8 grid grid-cols-10 text-center text-purple-100 font-medium">
                      {row.vals.map((v, i) => (
                        <span key={i}>{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* SVG Polyline + Digit Matrix */}
              <div className="flex items-stretch gap-2">
                <div className="w-[114px] shrink-0 divide-y divide-purple-800/40">
                  {state.chartRounds.map((r) => (
                    <div
                      key={r.period}
                      className="h-[40px] flex items-center font-mono-num text-[11px] text-purple-200 truncate"
                    >
                      {r.period}
                    </div>
                  ))}
                </div>

                <div className="flex-1 relative">
                  {state.chartRounds.length > 1 && (
                    <svg
                      viewBox={`0 0 100 ${state.chartRounds.length * 40}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none z-0"
                    >
                      <polyline
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        points={state.chartRounds
                          .map((r, idx) => {
                            const x = (r.resultNumber ?? 0) * 10 + 5;
                            const y = idx * 40 + 20;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    </svg>
                  )}

                  <div className="divide-y divide-purple-800/40 relative z-10">
                    {state.chartRounds.map((r) => {
                      const winDigit = r.resultNumber ?? 0;
                      return (
                        <div
                          key={r.period}
                          className="h-[40px] grid grid-cols-10 items-center justify-items-center"
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                            const hit = d === winDigit;
                            const hitBg =
                              d === 0 || d === 5
                                ? 'bg-violet-500 text-white'
                                : d % 2 === 1
                                ? 'bg-emerald-500 text-white'
                                : 'bg-rose-500 text-white';
                            return (
                              <span
                                key={d}
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-mono-num text-[10px] font-bold ${
                                  hit
                                    ? hitBg
                                    : 'border border-purple-700/60 text-purple-300/70 bg-[#190F33]'
                                }`}
                              >
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="w-6 shrink-0 divide-y divide-purple-800/40">
                  {state.chartRounds.map((r) => {
                    const isBig = r.resultSize === 'Big';
                    return (
                      <div key={r.period} className="h-[40px] flex items-center justify-end">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                            isBig ? 'bg-amber-500 text-slate-950' : 'bg-sky-500'
                          }`}
                        >
                          {isBig ? 'B' : 'S'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: My Betting History */}
          {activeTab === 'mybets' && (
            <div className="divide-y divide-purple-800/40">
              {!user ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-purple-200">Sign in to view your live betting history.</p>
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : (state?.myBets ?? []).length === 0 ? (
                <div className="p-8 text-center text-sm text-purple-300/75">
                  No bets placed in {activeCfg.label} yet. Pick a color, number, or Big/Small to start.
                </div>
              ) : (
                (state?.myBets ?? []).map((b) => (
                  <div key={b.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-mono-num font-semibold text-white">{b.period}</p>
                      <p className="text-purple-200/80 mt-0.5">
                        Picked <span className="font-semibold text-amber-300">{b.betValue}</span> · ₹
                        {b.totalAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right font-mono-num flex items-center gap-2.5">
                      {b.status === 'won' && (
                        <button
                          type="button"
                          onClick={() => openReceiptForBet('win', b.period, b.payout)}
                          className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/50 text-orange-300 font-sans text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trophy className="w-3 h-3" />
                          Slip
                        </button>
                      )}
                      {b.status === 'lost' && (
                        <button
                          type="button"
                          onClick={() => openReceiptForBet('loss', b.period, 0)}
                          className="px-2.5 py-1 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 border border-slate-400/40 text-slate-300 font-sans text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          Slip
                        </button>
                      )}
                      <div>
                        {b.status === 'pending' ? (
                          <span className="font-semibold text-amber-300">Pending</span>
                        ) : b.status === 'won' ? (
                          <span className="font-bold text-emerald-400">+₹{b.payout.toFixed(2)}</span>
                        ) : (
                          <span className="font-semibold text-rose-400">-₹{b.totalAmount.toFixed(2)}</span>
                        )}
                        <p className="text-[11px] text-purple-300/60 mt-0.5">{b.status.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Celebratory Winning Result Popup (Matching Screenshot Reference) */}
      {winningModal && (
        <WinGoWinningModal data={winningModal} onClose={() => setWinningModal(null)} />
      )}

      {/* Betting Sheet Modal */}
      {betModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={betModal.label}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-[#1F133D] border border-purple-600/50 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl text-white">
            {/* Colored Header */}
            <div className={`${betModal.headerBg} text-white px-6 pt-5 pb-6 text-center relative`}>
              <p className="text-sm font-semibold opacity-95">{activeCfg.label}</p>
              <div className="mt-2.5 bg-[#140B29] text-white border border-white/20 font-bold text-sm py-2 px-4 rounded-lg mx-auto max-w-xs">
                {betModal.label}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Balance Unit */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-purple-100">Balance</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {UNIT_BALANCES.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnitAmount(u)}
                      className={`px-2.5 py-1.5 rounded-md font-mono-num text-xs font-semibold transition-colors cursor-pointer ${
                        unitAmount === u
                          ? `${betModal.headerBg} text-white`
                          : 'bg-[#2B1B54] text-purple-100 hover:bg-purple-800'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-purple-100">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className={`w-8 h-8 rounded-md ${betModal.headerBg} text-white font-bold flex items-center justify-center cursor-pointer`}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    aria-label="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                    className="w-16 h-8 text-center font-mono-num text-sm font-semibold bg-[#140B29] text-white rounded-md border border-purple-700/60"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(1000, q + 1))}
                    className={`w-8 h-8 rounded-md ${betModal.headerBg} text-white font-bold flex items-center justify-center cursor-pointer`}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Multipliers */}
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                {MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModalMultiplier(m)}
                    className={`px-2.5 py-1.5 rounded-md font-mono-num text-xs font-semibold transition-colors cursor-pointer ${
                      modalMultiplier === m
                        ? `${betModal.headerBg} text-white`
                        : 'bg-[#2B1B54] text-purple-100 hover:bg-purple-800'
                    }`}
                  >
                    X{m}
                  </button>
                ))}
              </div>

              {/* Pre-sale rules */}
              <label className="flex items-center gap-2 text-xs text-purple-100 cursor-pointer select-none">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agreedRules}
                  onClick={() => setAgreedRules((v) => !v)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    agreedRules ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-purple-500 bg-[#140B29]'
                  }`}
                >
                  {agreedRules && <Check className="w-3 h-3" />}
                </button>
                <span>
                  I agree <span className="text-amber-300 font-medium">《Pre-sale rules》</span>
                </span>
              </label>

              <p className="text-[11px] text-purple-200/75 font-mono-num">
                2% service fee: ₹{betCalc.fee.toFixed(2)} · Net contract: ₹{betCalc.contractAmount.toFixed(2)} (Win
                2x = ₹{(betCalc.contractAmount * 2).toFixed(2)})
              </p>
            </div>

            {/* Bottom Split CTA */}
            <div className="grid grid-cols-12 border-t border-purple-800/60">
              <button
                type="button"
                onClick={() => setBetModal(null)}
                className="col-span-4 h-12 bg-[#140B29] hover:bg-purple-950 text-purple-200 font-semibold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={placingBet}
                onClick={confirmBet}
                className={`col-span-8 h-12 ${betModal.buttonBg} text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60`}
              >
                {placingBet ? 'Placing Bet...' : `Total amount ₹${betCalc.totalAmount.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How To Play Rules Modal */}
      {showHowToPlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How to play WinGo"
          className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#1F133D] border border-purple-600/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-purple-50">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">WinGo Trading Rules</h3>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                aria-label="Close rules"
                className="p-1 text-purple-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-purple-200 space-y-2.5 leading-relaxed">
              <p>
                Rounds run continuously across 30sec, 1Min, 3Min, 5Min, and 10Min cycles. Betting locks 5
                seconds before settlement.
              </p>
              <p>
                <strong className="text-white">Example Payouts:</strong> ₹50 bet pays{' '}
                <span className="text-amber-300 font-mono-num font-bold">₹98.00</span> · ₹100 bet pays{' '}
                <span className="text-amber-300 font-mono-num font-bold">₹196.00</span>.
              </p>
              <p>
                <strong className="text-emerald-400">Green (1, 3, 7, 9):</strong> Pays 2x net contract (1.5x if 5).
              </p>
              <p>
                <strong className="text-rose-400">Red (2, 4, 6, 8):</strong> Pays 2x net contract (1.5x if 0).
              </p>
              <p>
                <strong className="text-violet-300">Violet (0, 5):</strong> Pays 4.5x net contract.
              </p>
              <p>
                <strong className="text-amber-300">Big (5–9) / Small (0–4):</strong> Pays 2x net contract.
              </p>
              <p>
                <strong className="text-white">Exact Number (0–9):</strong> Pays 9x net contract.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
