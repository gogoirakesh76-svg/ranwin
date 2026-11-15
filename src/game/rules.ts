import type { BetType, ChickenDifficulty, ColorName, GameInterval, SizeName, TrendStatRow } from '../types';

export const BRAND_NAME = 'RANWIN';
export const INITIAL_PERIOD = '2026000000001';
export const MIN_DEPOSIT_AMOUNT = 90;
export const MAX_DEPOSIT_AMOUNT = 500000;
export const MIN_WITHDRAW_AMOUNT = 110;
export const MAX_WITHDRAW_AMOUNT = 200000;

export const FIRST_DEPOSIT_TIERS = [
  { depositMin: 1000, bonus: 88 },
  { depositMin: 500, bonus: 58 },
  { depositMin: 200, bonus: 18 },
  { depositMin: 90, bonus: 10 },
] as const;

export const VIP_TIERS = [
  {
    level: 1,
    name: 'VIP1',
    requiredExp: 3000,
    levelUpBonus: 60,
    monthlyBonus: 10,
    depositBonusPct: 1,
    gradient: 'from-[#94A3B8] via-[#CBD5E1] to-[#64748B]',
  },
  {
    level: 2,
    name: 'VIP2',
    requiredExp: 10000,
    levelUpBonus: 180,
    monthlyBonus: 30,
    depositBonusPct: 2,
    gradient: 'from-[#F59E0B] via-[#FBBF24] to-[#D97706]',
  },
  {
    level: 3,
    name: 'VIP3',
    requiredExp: 50000,
    levelUpBonus: 500,
    monthlyBonus: 90,
    depositBonusPct: 3,
    gradient: 'from-[#FB7185] via-[#F43F5E] to-[#E11D48]',
  },
  {
    level: 4,
    name: 'VIP4',
    requiredExp: 150000,
    levelUpBonus: 1500,
    monthlyBonus: 250,
    depositBonusPct: 4,
    gradient: 'from-[#38BDF8] via-[#0EA5E9] to-[#0284C7]',
  },
] as const;

export function getVipLevelForExp(exp: number): number {
  let lvl = 0;
  for (const tier of VIP_TIERS) {
    if (exp >= tier.requiredExp) {
      lvl = tier.level;
    }
  }
  return lvl;
}

export function calculateReferralCommission(depositAmount: number, level: 1 | 2): number {
  const rate = level === 1 ? 0.05 : 0.02; // 5% direct commission, 2% team level-2 commission
  return Number((depositAmount * rate).toFixed(2));
}

export function calculateFirstDepositBonus(depositAmount: number): number {
  for (const tier of FIRST_DEPOSIT_TIERS) {
    if (depositAmount >= tier.depositMin) {
      return tier.bonus;
    }
  }
  return 0;
}

/**
 * Interleaved 5-win / 3-loss cycle (never 5 wins or 3 losses clumped consecutively).
 * Sequence: W, W, L, W, L, W, W, L (5 wins, 3 losses per 8 bets).
 */
export const INTERLEAVED_WIN_CYCLE = [true, true, false, true, false, true, true, false] as const;

export function shouldWinInInterleavedCycle(index: number): boolean {
  const safeIdx = ((Math.floor(index) % INTERLEAVED_WIN_CYCLE.length) + INTERLEAVED_WIN_CYCLE.length) % INTERLEAVED_WIN_CYCLE.length;
  return INTERLEAVED_WIN_CYCLE[safeIdx];
}

export function pickDigitForTarget(
  betType: BetType,
  betValue: string,
  wantWin: boolean,
  pickIndex: (length: number) => number = (len) => Math.floor(Math.random() * len)
): number {
  const matching: number[] = [];
  for (let d = 0; d <= 9; d++) {
    const res = calculateWinGoPayout(betType, betValue, 100, d);
    if (res.won === wantWin) {
      matching.push(d);
    }
  }
  if (matching.length === 0) {
    return pickIndex(10) % 10;
  }
  const idx = Math.abs(pickIndex(matching.length)) % matching.length;
  return matching[idx];
}

export const INTERVAL_CONFIG: Record<
  GameInterval,
  { key: GameInterval; label: string; shortLabel: string; durationSec: number }
> = {
  '30s': { key: '30s', label: 'WinGo 30sec', shortLabel: '30sec', durationSec: 30 },
  '1m': { key: '1m', label: 'WinGo 1Min', shortLabel: '1Min', durationSec: 60 },
  '3m': { key: '3m', label: 'WinGo 3Min', shortLabel: '3Min', durationSec: 180 },
  '5m': { key: '5m', label: 'WinGo 5Min', shortLabel: '5Min', durationSec: 300 },
  '10m': { key: '10m', label: 'WinGo 10Min', shortLabel: '10Min', durationSec: 600 },
};

export const INTERVAL_LIST: GameInterval[] = ['30s', '1m', '3m', '5m', '10m'];

export const WINGO_LOCK_SECONDS = 5;
export const WINGO_FEE_RATE = 0.02; // 2% contract fee matching colour trading rules

export function incrementPeriod(period: string, step = 1): string {
  const num = BigInt(period) + BigInt(step);
  return num.toString();
}

export function getNumberProperties(num: number): {
  number: number;
  size: SizeName;
  colors: ColorName[];
  primaryColor: 'Green' | 'Red';
} {
  if (!Number.isInteger(num) || num < 0 || num > 9) {
    throw new Error(`Invalid WinGo digit: ${num}`);
  }

  const size: SizeName = num >= 5 ? 'Big' : 'Small';

  if (num === 0) {
    return { number: 0, size, colors: ['Red', 'Violet'], primaryColor: 'Red' };
  }
  if (num === 5) {
    return { number: 5, size, colors: ['Green', 'Violet'], primaryColor: 'Green' };
  }
  if (num % 2 === 1) {
    return { number: num, size, colors: ['Green'], primaryColor: 'Green' };
  }
  return { number: num, size, colors: ['Red'], primaryColor: 'Red' };
}

export function calculateBetAmount(unitAmount: number, quantity: number, multiplier: number): {
  totalAmount: number;
  fee: number;
  contractAmount: number;
} {
  const rawTotal = Number((unitAmount * quantity * multiplier).toFixed(2));
  const fee = Number((rawTotal * WINGO_FEE_RATE).toFixed(2));
  const contractAmount = Number((rawTotal - fee).toFixed(2));
  return { totalAmount: rawTotal, fee, contractAmount };
}

export function calculateWinGoPayout(
  betType: BetType,
  betValue: string,
  totalAmount: number,
  resultNumber: number
): { won: boolean; payout: number } {
  const props = getNumberProperties(resultNumber);
  const contractAmount = totalAmount * (1 - WINGO_FEE_RATE);

  if (betType === 'number') {
    const target = Number(betValue);
    if (target === resultNumber) {
      return { won: true, payout: Number((contractAmount * 9).toFixed(2)) };
    }
    return { won: false, payout: 0 };
  }

  if (betType === 'size') {
    if (betValue === props.size) {
      return { won: true, payout: Number((contractAmount * 2).toFixed(2)) };
    }
    return { won: false, payout: 0 };
  }

  if (betType === 'color') {
    if (betValue === 'Violet') {
      if (props.colors.includes('Violet')) {
        return { won: true, payout: Number((contractAmount * 4.5).toFixed(2)) };
      }
      return { won: false, payout: 0 };
    }

    if (betValue === 'Green') {
      if (resultNumber === 5) {
        return { won: true, payout: Number((contractAmount * 1.5).toFixed(2)) };
      }
      if (props.colors.includes('Green')) {
        return { won: true, payout: Number((contractAmount * 2).toFixed(2)) };
      }
      return { won: false, payout: 0 };
    }

    if (betValue === 'Red') {
      if (resultNumber === 0) {
        return { won: true, payout: Number((contractAmount * 1.5).toFixed(2)) };
      }
      if (props.colors.includes('Red')) {
        return { won: true, payout: Number((contractAmount * 2).toFixed(2)) };
      }
      return { won: false, payout: 0 };
    }
  }

  return { won: false, payout: 0 };
}

/**
 * Computes Missing, Avg Missing, Frequency, and Max Consecutive for digits 0..9
 * given an array of recent winning numbers ordered newest-first.
 */
export function computeTrendStats(newestFirstNumbers: number[]): TrendStatRow {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const total = newestFirstNumbers.length;

  const missing: number[] = [];
  const avgMissing: number[] = [];
  const frequency: number[] = [];
  const maxConsecutive: number[] = [];

  for (const d of digits) {
    const firstIdx = newestFirstNumbers.indexOf(d);
    missing.push(firstIdx === -1 ? total : firstIdx);

    let freq = 0;
    let maxRun = 0;
    let currentRun = 0;

    for (let i = total - 1; i >= 0; i--) {
      if (newestFirstNumbers[i] === d) {
        freq++;
        currentRun++;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 0;
      }
    }

    frequency.push(freq);
    maxConsecutive.push(maxRun);

    if (freq === 0) {
      avgMissing.push(total);
    } else {
      const avg = Math.round((total - freq) / freq);
      avgMissing.push(avg);
    }
  }

  return { missing, avgMissing, frequency, maxConsecutive };
}

export const VORTEX_LADDER = [1.0, 1.28, 1.68, 2.25, 3.1, 4.4, 6.5, 9.8, 15.0];

export function calculateVortexPayout(betAmount: number, multiplier: number): number {
  return Number((betAmount * multiplier).toFixed(2));
}

export const CHICKEN_LADDERS: Record<ChickenDifficulty, readonly number[]> = {
  easy: [1.0, 1.15, 1.32, 1.54, 1.82, 2.18, 2.65, 3.25, 4.10],
  medium: [1.0, 1.24, 1.56, 1.98, 2.55, 3.35, 4.45, 6.0, 8.5],
  hard: [1.0, 1.45, 2.15, 3.25, 4.9, 7.5, 11.5, 17.5, 26.0],
};

export function calculateChickenPayout(betAmount: number, multiplier: number): number {
  return Number((betAmount * multiplier).toFixed(2));
}

export function calculateAviatorMultiplierAtElapsed(elapsedMs: number): number {
  const safeMs = Math.max(0, elapsedMs);
  return Number(Math.pow(Math.E, 0.00012 * safeMs).toFixed(2));
}

export function calculateAviatorPayout(betAmount: number, multiplier: number): number {
  return Number((betAmount * multiplier).toFixed(2));
}

export function calculateMinesMultiplier(minesCount: number, safeRevealed: number): number {
  const safeMines = Math.min(24, Math.max(1, Math.floor(minesCount)));
  const revealed = Math.max(0, Math.min(25 - safeMines, Math.floor(safeRevealed)));
  if (revealed === 0) return 1.0;

  let prob = 1;
  for (let i = 0; i < revealed; i++) {
    prob *= (25 - safeMines - i) / (25 - i);
  }
  const raw = (0.97 / prob);
  return Number(raw.toFixed(2));
}

export function calculateMinesPayout(betAmount: number, multiplier: number): number {
  return Number((betAmount * multiplier).toFixed(2));
}

export function formatCountdown(seconds: number): { m1: string; m2: string; s1: string; s2: string } {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  return {
    m1: mStr[0],
    m2: mStr[1],
    s1: sStr[0],
    s2: sStr[1],
  };
}
