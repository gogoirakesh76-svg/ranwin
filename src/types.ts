export type GameInterval = '30s' | '1m' | '3m' | '5m' | '10m';

export type ColorName = 'Green' | 'Red' | 'Violet';
export type SizeName = 'Big' | 'Small';
export type BetType = 'color' | 'size' | 'number';

export interface User {
  id: number;
  username: string;
  phone: string;
  email: string;
  role: 'player' | 'admin';
  balance: number;
  inviteCode: string;
  status: 'active' | 'banned';
  firstDepositBonusClaimed?: boolean;
  totalBetExp?: number;
  vipLevel?: number;
  claimedVipLevels?: number[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface PromotionSubordinate {
  id: number;
  username: string;
  phone: string;
  depositCount: number;
  depositAmount: number;
  commissionEarned: number;
  level: 1 | 2;
  createdAt: string;
}

export interface PromotionStats {
  inviteCode: string;
  totalCommission: number;
  yesterdayCommission: number;
  direct: {
    registers: number;
    depositCount: number;
    depositAmount: number;
    firstDepositCount: number;
  };
  team: {
    registers: number;
    depositCount: number;
    depositAmount: number;
    firstDepositCount: number;
  };
  subordinates: PromotionSubordinate[];
}

export interface WinGoRound {
  id: number;
  intervalKey: GameInterval;
  period: string;
  resultNumber: number | null;
  resultSize: SizeName | null;
  resultColors: ColorName[];
  isOverridden?: boolean;
  adminOverride?: number | null;
  startedAt: number;
  endsAt: number;
  settled: boolean;
}

export interface WinGoBet {
  id: number;
  userId: number;
  intervalKey: GameInterval;
  period: string;
  betType: BetType;
  betValue: string;
  unitAmount: number;
  quantity: number;
  multiplier: number;
  totalAmount: number;
  fee: number;
  payout: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
}

export interface TrendStatRow {
  missing: number[];
  avgMissing: number[];
  frequency: number[];
  maxConsecutive: number[];
}

export interface WinGoStateResponse {
  interval: GameInterval;
  activeRound: WinGoRound;
  timeRemainingSec: number;
  isLocked: boolean;
  last5: WinGoRound[];
  history: WinGoRound[];
  page: number;
  totalPages: number;
  totalRounds: number;
  chartRounds: WinGoRound[];
  trendStats: TrendStatRow;
  announcement: string;
  myBets: WinGoBet[];
}

export interface VortexPlay {
  id: number;
  userId: number;
  betAmount: number;
  stepsCleared: number;
  multiplier: number;
  payout: number;
  status: 'active' | 'cashed_out' | 'collapsed';
  history: { step: number; outcome: 'advance' | 'bonus' | 'collapse'; multiplier: number; ringColor: string }[];
  createdAt: string;
}

export type ChickenDifficulty = 'easy' | 'medium' | 'hard';

export interface ChickenPlay {
  id: number;
  userId: number;
  betAmount: number;
  difficulty: ChickenDifficulty;
  currentLane: number;
  multiplier: number;
  payout: number;
  status: 'active' | 'cashed_out' | 'crashed';
  trapLane: number | null;
  createdAt: string;
}

export interface DepositRequest {
  id: number;
  userId: number;
  username?: string;
  phone?: string;
  amount: number;
  utr: string;
  paymentMethod: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface WithdrawRequest {
  id: number;
  userId: number;
  username?: string;
  phone?: string;
  amount: number;
  upiOrBank: string;
  accountName: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PaymentSettings {
  paymentQrDataUrl: string;
  paymentUpiId: string;
  paymentMerchantName: string;
  announcementText: string;
}

export interface AdminPlayerRow {
  id: number;
  username: string;
  phone: string;
  email: string;
  role: 'player' | 'admin';
  balance: number;
  status: 'active' | 'banned';
  createdAt: string;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
}

export interface AdminLiveIntervalSummary {
  interval: GameInterval;
  label: string;
  durationSec: number;
  activeRound: WinGoRound;
  timeRemainingSec: number;
  upcomingPeriods: { period: string; forcedNumber: number | null }[];
  exposure: {
    Green: number;
    Violet: number;
    Red: number;
    Big: number;
    Small: number;
    numbers: number[];
    totalPool: number;
  };
  recentRounds: WinGoRound[];
}

export interface AdminOverviewData {
  totalPlayers: number;
  totalDeposited: number;
  totalWithdrawn: number;
  pendingDepositsCount: number;
  pendingWithdrawsCount: number;
  totalWagered: number;
  totalPayouts: number;
  houseProfit: number;
}

export interface AviatorPlay {
  id: number;
  userId: number;
  betAmount: number;
  crashMultiplier: number;
  cashoutMultiplier: number | null;
  payout: number;
  status: 'active' | 'cashed_out' | 'crashed';
  startedAt: number;
  createdAt: string;
}

export interface MinesPlay {
  id: number;
  userId: number;
  betAmount: number;
  minesCount: number;
  revealedIndices: number[];
  mineIndices?: number[];
  multiplier: number;
  payout: number;
  status: 'active' | 'cashed_out' | 'exploded';
  createdAt: string;
}

export interface SupportMessage {
  id: number;
  userId: number;
  senderRole: 'player' | 'admin';
  message: string;
  isReadByAdmin: boolean;
  createdAt: string;
}

export interface AdminSupportThread {
  userId: number;
  username: string;
  phone: string;
  lastMessage: string;
  lastSenderRole: 'player' | 'admin';
  unreadCount: number;
  updatedAt: string;
}

