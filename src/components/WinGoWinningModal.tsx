import { useEffect, useState } from 'react';
import { Check, Rocket, X } from 'lucide-react';
import type { ColorName, GameInterval, SizeName } from '../types';
import { INTERVAL_CONFIG } from '../game/rules';

export interface WinningCelebrationData {
  outcome: 'win' | 'loss';
  period: string;
  interval: GameInterval;
  totalPayout: number;
  resultNumber: number;
  resultSize: SizeName;
  resultColors: ColorName[];
}

interface WinGoWinningModalProps {
  data: WinningCelebrationData;
  onClose: () => void;
}

export function WinGoWinningModal({ data, onClose }: WinGoWinningModalProps) {
  const [autoShutOff, setAutoShutOff] = useState(false);

  useEffect(() => {
    if (!autoShutOff) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [autoShutOff, onClose]);

  const intervalLabel = INTERVAL_CONFIG[data.interval]?.label ?? data.interval;
  const isWin = data.outcome === 'win';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isWin ? 'Congratulations on your winning' : 'Sorry'}
      data-testid={isWin ? 'winning-modal' : 'loss-modal'}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-4"
    >
      <div className="relative w-full max-w-[340px] pt-10">
        {/* Top Winged Emblem */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div
              className={`w-10 h-6 rounded-l-full -mr-3 -rotate-12 shadow-sm border ${
                isWin
                  ? 'bg-gradient-to-r from-amber-200 to-amber-50 border-amber-300/60'
                  : 'bg-gradient-to-r from-slate-200 to-slate-50 border-slate-300/70'
              }`}
            />
            <div
              className={`relative z-10 w-20 h-20 rounded-full p-1.5 shadow-xl ring-4 ${
                isWin
                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 ring-orange-950/25'
                  : 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 ring-slate-900/20'
              }`}
            >
              <div
                className={`w-full h-full rounded-full flex items-center justify-center border-2 border-white/85 ${
                  isWin
                    ? 'bg-gradient-to-b from-amber-100 to-amber-300'
                    : 'bg-gradient-to-b from-slate-100 to-blue-100'
                }`}
              >
                <Rocket
                  className={`w-9 h-9 -rotate-45 drop-shadow-sm ${
                    isWin ? 'text-orange-600' : 'text-slate-500'
                  }`}
                />
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-r-full -ml-3 rotate-12 shadow-sm border ${
                isWin
                  ? 'bg-gradient-to-l from-amber-200 to-amber-50 border-amber-300/60'
                  : 'bg-gradient-to-l from-slate-200 to-slate-50 border-slate-300/70'
              }`}
            />
          </div>
        </div>

        {/* Ribbon Banner behind emblem */}
        <div
          className={`absolute top-12 left-1/2 -translate-x-1/2 w-[108%] h-10 rounded-xl shadow-md z-10 flex items-center justify-between px-3 ${
            isWin
              ? 'bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600'
              : 'bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
        </div>

        {/* Main Card: Vibrant Orange for Win (image.png) / Silver-Blue for Loss (loss.jpeg) */}
        <div
          className={`relative z-10 mt-6 rounded-3xl pt-12 pb-6 px-5 shadow-2xl border ${
            isWin
              ? 'bg-gradient-to-b from-[#FF7A45] via-[#FF5E3A] to-[#EF4444] border-orange-300/40 text-white'
              : 'bg-gradient-to-b from-[#CAD6E8] via-[#DCE6F5] to-[#B6C7E0] border-white/60 text-slate-700'
          }`}
        >
          <h2
            className={`font-display text-2xl font-extrabold text-center leading-snug ${
              isWin ? 'text-white drop-shadow-sm' : 'text-[#5A6D8C]'
            }`}
          >
            {isWin ? 'Congratulations on your winning' : 'Sorry'}
          </h2>

          {/* Lottery Result Badges */}
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap text-xs">
            <span className={`font-medium ${isWin ? 'text-orange-50' : 'text-slate-600'}`}>
              Lottery results
            </span>
            <div className="flex items-center gap-1.5">
              {data.resultColors.map((c) => (
                <span
                  key={c}
                  className={`px-2.5 py-0.5 rounded-md font-semibold text-white shadow-sm ${
                    c === 'Green'
                      ? 'bg-emerald-500'
                      : c === 'Red'
                      ? 'bg-rose-500'
                      : 'bg-violet-500'
                  }`}
                >
                  {c}
                </span>
              ))}
              <span
                className={`w-6 h-6 rounded-full font-display font-bold flex items-center justify-center shadow-sm ${
                  isWin ? 'bg-white text-orange-600' : 'bg-rose-500 text-white'
                }`}
              >
                {data.resultNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md font-semibold text-white shadow-sm ${
                  data.resultSize === 'Big' ? 'bg-rose-500' : 'bg-sky-500'
                }`}
              >
                {data.resultSize}
              </span>
            </div>
          </div>

          {/* Printer Slot + Slip */}
          <div className="mt-5 relative">
            <div
              className={`h-3.5 w-full rounded-full shadow-inner border ${
                isWin
                  ? 'bg-[#B93815] border-orange-950/30'
                  : 'bg-[#8FA2BF] border-slate-500/30'
              }`}
            />
            <div className="-mt-1.5 mx-2 rounded-b-2xl bg-gradient-to-b from-[#FFFDFB] via-white to-[#F3F4F6] text-center px-4 py-5 shadow-lg border-x border-b border-slate-200/80">
              {isWin ? (
                <>
                  <p className="text-xs font-semibold text-orange-500 tracking-wide">bonus</p>
                  <p
                    data-testid="winning-amount"
                    className="font-mono-num text-3xl font-extrabold text-[#EF4444] mt-1 tracking-tight"
                  >
                    ₹{data.totalPayout.toFixed(2)}
                  </p>
                  <p className="font-mono-num text-[11px] text-slate-500 mt-2.5">
                    Issue: {intervalLabel} {data.period}
                  </p>
                </>
              ) : (
                <>
                  <p
                    data-testid="loss-label"
                    className="font-display text-3xl font-extrabold text-[#6E81A0] tracking-tight"
                  >
                    Lose
                  </p>
                  <p className="font-mono-num text-[11px] text-slate-500 mt-2.5">
                    Period: {intervalLabel}
                  </p>
                  <p className="font-mono-num text-[11px] text-slate-500">{data.period}</p>
                </>
              )}
            </div>
          </div>

          {/* Auto close toggle */}
          <button
            type="button"
            onClick={() => setAutoShutOff((v) => !v)}
            className={`mt-5 flex items-center gap-2 text-xs cursor-pointer select-none ${
              isWin ? 'text-orange-50 hover:text-white' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                autoShutOff
                  ? isWin
                    ? 'bg-white border-white text-orange-600'
                    : 'bg-slate-600 border-slate-600 text-white'
                  : isWin
                  ? 'border-white/70 bg-white/20'
                  : 'border-slate-500/60 bg-white/50'
              }`}
            >
              {autoShutOff && <Check className="w-3 h-3" />}
            </span>
            <span>{isWin ? '3s auto shut off' : '3 seconds auto close'}</span>
          </button>
        </div>
      </div>

      {/* Circular Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label={isWin ? 'Close winning popup' : 'Close loss popup'}
        className="mt-5 w-10 h-10 rounded-full border-2 border-white/80 text-white hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
