import type {
  AdminLiveIntervalSummary,
  AdminOverviewData,
  AdminPlayerRow,
  AdminSupportThread,
  AviatorPlay,
  BetType,
  ChickenDifficulty,
  ChickenPlay,
  DepositRequest,
  GameInterval,
  MinesPlay,
  PaymentSettings,
  PromotionStats,
  SupportMessage,
  User,
  VortexPlay,
  WinGoBet,
  WinGoStateResponse,
  WithdrawRequest,
} from '../types';

const TOKEN_KEY = 'jadepulse_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  register: (payload: {
    username: string;
    phone: string;
    email: string;
    password: string;
    inviteCode?: string;
  }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/api/auth/me'),

  // WinGo
  getWinGoState: (interval: GameInterval, page = 1) =>
    request<WinGoStateResponse>(`/api/wingo/state?interval=${encodeURIComponent(interval)}&page=${page}&limit=10`),

  placeWinGoBet: (payload: {
    intervalKey: GameInterval;
    period: string;
    betType: BetType;
    betValue: string;
    unitAmount: number;
    quantity: number;
    multiplier: number;
  }) =>
    request<{ balance: number; bet: WinGoBet }>('/api/wingo/bet', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Vortex
  getVortexHistory: () =>
    request<{ activePlay: VortexPlay | null; history: VortexPlay[] }>('/api/vortex/history'),

  startVortex: (betAmount: number) =>
    request<{ balance: number; play: VortexPlay }>('/api/vortex/start', {
      method: 'POST',
      body: JSON.stringify({ betAmount }),
    }),

  spinVortex: () =>
    request<{ balance: number; play: VortexPlay }>('/api/vortex/spin', { method: 'POST' }),

  cashoutVortex: () =>
    request<{ balance: number; play: VortexPlay }>('/api/vortex/cashout', { method: 'POST' }),

  // Chicken Road
  getChickenHistory: () =>
    request<{ activePlay: ChickenPlay | null; history: ChickenPlay[] }>('/api/chicken/history'),

  startChicken: (betAmount: number, difficulty: ChickenDifficulty) =>
    request<{ balance: number; play: ChickenPlay }>('/api/chicken/start', {
      method: 'POST',
      body: JSON.stringify({ betAmount, difficulty }),
    }),

  stepChicken: () =>
    request<{ balance: number; play: ChickenPlay }>('/api/chicken/step', { method: 'POST' }),

  cashoutChicken: () =>
    request<{ balance: number; play: ChickenPlay }>('/api/chicken/cashout', { method: 'POST' }),

  // Aviator
  getAviatorHistory: () =>
    request<{ activePlay: AviatorPlay | null; history: AviatorPlay[] }>('/api/aviator/history'),

  startAviator: (betAmount: number) =>
    request<{ balance: number; play: AviatorPlay }>('/api/aviator/start', {
      method: 'POST',
      body: JSON.stringify({ betAmount }),
    }),

  cashoutAviator: () =>
    request<{ balance: number; play: AviatorPlay }>('/api/aviator/cashout', { method: 'POST' }),

  crashAviator: () =>
    request<{ balance: number; play: AviatorPlay }>('/api/aviator/crash', { method: 'POST' }),

  // Mines
  getMinesHistory: () =>
    request<{ activePlay: MinesPlay | null; history: MinesPlay[] }>('/api/mines/history'),

  startMines: (betAmount: number, minesCount: number) =>
    request<{ balance: number; play: MinesPlay }>('/api/mines/start', {
      method: 'POST',
      body: JSON.stringify({ betAmount, minesCount }),
    }),

  revealMinesTile: (tileIndex: number) =>
    request<{ balance: number; play: MinesPlay }>('/api/mines/reveal', {
      method: 'POST',
      body: JSON.stringify({ tileIndex }),
    }),

  cashoutMines: () =>
    request<{ balance: number; play: MinesPlay }>('/api/mines/cashout', { method: 'POST' }),

  // Customer Support (Player)
  getSupportMessages: () =>
    request<{ messages: SupportMessage[] }>('/api/support/messages'),

  sendSupportMessage: (message: string) =>
    request<{ message: SupportMessage }>('/api/support/messages', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  // Wallet
  getWalletInfo: () =>
    request<{
      balance: number;
      firstDepositBonusClaimed?: boolean;
      paymentSettings: PaymentSettings;
      deposits: DepositRequest[];
      withdrawals: WithdrawRequest[];
    }>('/api/wallet/info'),

  requestDeposit: (amount: number, utr: string) =>
    request<{ deposit: DepositRequest }>('/api/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, utr }),
    }),

  requestWithdraw: (amount: number, upiOrBank: string, accountName: string) =>
    request<{ balance: number; withdrawal: WithdrawRequest }>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, upiOrBank, accountName }),
    }),

  // Promotion & VIP
  getPromotionStats: () => request<PromotionStats>('/api/promotion/stats'),

  claimVipReward: (level: number) =>
    request<{ balance: number; claimedVipLevels: number[]; bonusAmount: number }>('/api/vip/claim', {
      method: 'POST',
      body: JSON.stringify({ level }),
    }),

  // Admin
  getAdminOverview: () => request<AdminOverviewData>('/api/admin/overview'),

  getAdminLiveRounds: () =>
    request<{ intervals: AdminLiveIntervalSummary[] }>('/api/admin/live-rounds'),

  setAdminOverride: (intervalKey: GameInterval, period: string, forcedNumber: number | null) =>
    request<{ ok: boolean }>('/api/admin/override', {
      method: 'POST',
      body: JSON.stringify({ intervalKey, period, forcedNumber }),
    }),

  getAdminPlayers: () => request<{ players: AdminPlayerRow[] }>('/api/admin/players'),

  adjustAdminPlayer: (playerId: number, payload: { deltaBalance?: number; status?: 'active' | 'banned' }) =>
    request<{ player: User }>(`/api/admin/players/${playerId}/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminDeposits: () => request<{ deposits: DepositRequest[] }>('/api/admin/deposits'),

  reviewDeposit: (id: number, action: 'approve' | 'reject', note?: string) =>
    request<{ ok: boolean }>(`/api/admin/deposits/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    }),

  getAdminWithdrawals: () => request<{ withdrawals: WithdrawRequest[] }>('/api/admin/withdrawals'),

  reviewWithdrawal: (id: number, action: 'approve' | 'reject', note?: string) =>
    request<{ ok: boolean }>(`/api/admin/withdrawals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    }),

  getAdminSettings: () => request<PaymentSettings>('/api/admin/settings'),

  saveAdminSettings: (payload: Partial<PaymentSettings>) =>
    request<PaymentSettings>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminSupportThreads: () =>
    request<{ threads: AdminSupportThread[] }>('/api/admin/support/threads'),

  getAdminSupportThread: (userId: number) =>
    request<{ messages: SupportMessage[] }>(`/api/admin/support/threads/${userId}`),

  replyAdminSupportThread: (userId: number, message: string) =>
    request<{ message: SupportMessage }>(`/api/admin/support/threads/${userId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
