import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { FIRST_DEPOSIT_TIERS } from '../game/rules';

interface FirstDepositBonusModalProps {
  claimed?: boolean;
  onClose: (dontRemindToday: boolean) => void;
  onSelectDepositAmount: (amount: number) => void;
}

export function FirstDepositBonusModal({
  claimed = false,
  onClose,
  onSelectDepositAmount,
}: FirstDepositBonusModalProps) {
  const [dontRemindToday, setDontRemindToday] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Extra first deposit bonus"
      data-testid="first-deposit-bonus-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-[390px] rounded-2xl bg-[#27184A] border border-purple-600/50 shadow-2xl overflow-hidden text-purple-50">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 bg-[#311F5B] border-b border-purple-700/50 text-center">
          <h2 className="font-display text-lg font-bold text-amber-200">Extra first deposit bonus</h2>
          <p className="text-xs text-purple-200/80 mt-1">
            Each account can only receive rewards once
          </p>
        </div>

        {/* Tier Cards */}
        <div className="p-3.5 space-y-2.5 max-h-[58vh] overflow-y-auto">
          {FIRST_DEPOSIT_TIERS.map((tier) => (
            <div
              key={tier.depositMin}
              className="rounded-xl bg-[#1C1037] border border-purple-700/50 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  First deposit{' '}
                  <span className="font-mono-num text-amber-300 font-bold">{tier.depositMin}</span>
                </p>
                <span className="font-mono-num text-sm font-bold text-amber-300">
                  + ₹{tier.bonus.toFixed(2)}
                </span>
              </div>

              <p className="text-xs text-purple-200/75 leading-relaxed">
                Deposit {tier.depositMin} for the first time and you will receive {tier.bonus} bonus
              </p>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <div className="flex-1 h-5 rounded-full bg-[#120926] border border-purple-800/70 relative overflow-hidden flex items-center justify-center">
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 transition-all ${
                      claimed ? 'w-full opacity-50' : 'w-0'
                    }`}
                  />
                  <span className="relative z-10 font-mono-num text-[11px] font-semibold text-purple-100">
                    {claimed ? `${tier.depositMin}/${tier.depositMin}` : `0/${tier.depositMin}`}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={claimed}
                  onClick={() => onSelectDepositAmount(tier.depositMin)}
                  className="px-4 py-1.5 rounded-lg border border-amber-400/70 text-amber-300 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                >
                  {claimed ? 'Claimed' : 'Deposit'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3.5 bg-[#311F5B] border-t border-purple-700/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDontRemindToday((v) => !v)}
            className="inline-flex items-center gap-2 text-xs text-purple-100 hover:text-white cursor-pointer select-none"
          >
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                dontRemindToday
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'border-purple-300/70 bg-transparent'
              }`}
            >
              {dontRemindToday && <Check className="w-3 h-3" />}
            </span>
            <span>No more reminders today</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDepositAmount(200)}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
          >
            Activity
          </button>
        </div>
      </div>

      {/* Circular Close Button */}
      <button
        type="button"
        onClick={() => onClose(dontRemindToday)}
        aria-label="Close deposit bonus chart"
        className="mt-4 w-9 h-9 rounded-full border-2 border-white/80 text-white hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
