import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { db, getSetting, hashPassword, seedDatabase, setSetting, verifyPassword } from './server/db';
import { startGameEngine, tickAllIntervals } from './server/engine';
import {
  CHICKEN_LADDERS,
  INTERVAL_CONFIG,
  INTERVAL_LIST,
  MAX_DEPOSIT_AMOUNT,
  MAX_WITHDRAW_AMOUNT,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  VORTEX_LADDER,
  WINGO_LOCK_SECONDS,
  calculateBetAmount,
  calculateAviatorMultiplierAtElapsed,
  calculateAviatorPayout,
  calculateChickenPayout,
  calculateFirstDepositBonus,
  calculateMinesMultiplier,
  calculateMinesPayout,
  calculateReferralCommission,
  calculateVortexPayout,
  computeTrendStats,
  getVipLevelForExp,
  incrementPeriod,
  shouldWinInInterleavedCycle,
  VIP_TIERS,
} from './src/game/rules';
import type { BetType, ChickenDifficulty, GameInterval, PromotionSubordinate, User, WinGoRound } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

seedDatabase();
startGameEngine();

const app = express();
app.use(express.json({ limit: '10mb' }));

interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

function getUserBetExp(userId: number): number {
  const row = db
    .prepare(
      `SELECT
         COALESCE((SELECT SUM(total_amount) FROM bets WHERE user_id = ?), 0) +
         COALESCE((SELECT SUM(bet_amount) FROM vortex_plays WHERE user_id = ?), 0) +
         COALESCE((SELECT SUM(bet_amount) FROM chicken_plays WHERE user_id = ?), 0) +
         COALESCE((SELECT SUM(bet_amount) FROM aviator_plays WHERE user_id = ?), 0) +
         COALESCE((SELECT SUM(bet_amount) FROM mines_plays WHERE user_id = ?), 0) as exp`
    )
    .get(userId, userId, userId, userId, userId) as { exp: number } | undefined;
  return Number(Number(row?.exp ?? 0).toFixed(2));
}

function mapUserRow(row: Record<string, unknown>): User {
  const userId = Number(row.id);
  const totalBetExp = getUserBetExp(userId);
  const vipLevel = getVipLevelForExp(totalBetExp);
  const claimRows = db
    .prepare(`SELECT vip_level FROM vip_claims WHERE user_id = ? ORDER BY vip_level ASC`)
    .all(userId) as { vip_level: number }[];
  return {
    id: userId,
    username: String(row.username),
    phone: String(row.phone),
    email: String(row.email),
    role: row.role === 'admin' ? 'admin' : 'player',
    balance: Number(Number(row.balance).toFixed(2)),
    inviteCode: String(row.invite_code),
    status: row.status === 'banned' ? 'banned' : 'active',
    firstDepositBonusClaimed: Number(row.first_deposit_bonus_claimed ?? 0) === 1,
    totalBetExp,
    vipLevel,
    claimedVipLevels: claimRows.map((c) => Number(c.vip_level)),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : String(row.created_at),
    createdAt: String(row.created_at),
  };
}

function mapRoundRow(row: Record<string, unknown>, includeOverride = false): WinGoRound {
  const base: WinGoRound = {
    id: Number(row.id),
    intervalKey: String(row.interval_key) as GameInterval,
    period: String(row.period),
    resultNumber: row.result_number !== null && row.result_number !== undefined ? Number(row.result_number) : null,
    resultSize: (row.result_size as WinGoRound['resultSize']) ?? null,
    resultColors: JSON.parse(String(row.result_colors || '[]')),
    startedAt: Number(row.started_at),
    endsAt: Number(row.ends_at),
    settled: Number(row.settled) === 1,
  };
  if (includeOverride) {
    base.isOverridden = Number(row.is_overridden) === 1;
    base.adminOverride =
      row.admin_override !== null && row.admin_override !== undefined ? Number(row.admin_override) : null;
  }
  return base;
}

function getSessionUser(req: AuthRequest): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const session = db
    .prepare(`SELECT user_id, expires_at FROM sessions WHERE token = ?`)
    .get(token) as { user_id: number; expires_at: number } | undefined;

  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }

  const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(session.user_id) as
    | Record<string, unknown>
    | undefined;
  if (!userRow || userRow.status === 'banned') return null;
  req.token = token;
  return mapUserRow(userRow);
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  req.user = user;
  next();
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(token, userId, expiresAt);
  return token;
}

// ---------- AUTH ROUTES ----------

app.post('/api/auth/register', (req, res) => {
  const { username, phone, email, password, inviteCode } = req.body ?? {};
  const cleanName = String(username ?? '').trim();
  const cleanPhone = String(phone ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const cleanPass = String(password ?? '');

  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (!/^\d{8,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Enter a valid 8–15 digit phone number.' });
    return;
  }
  if (!cleanEmail.includes('@')) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (cleanPass.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM users WHERE phone = ? OR email = ?`)
    .get(cleanPhone, cleanEmail) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Phone number or email is already registered.' });
    return;
  }

  const { hash, salt } = hashPassword(cleanPass);
  const userInvite = `RW${crypto.randomInt(10000, 99999)}`;
  const cleanInvite = String(inviteCode ?? '').trim().toUpperCase();
  const referrer = cleanInvite
    ? (db.prepare(`SELECT id FROM users WHERE UPPER(invite_code) = ?`).get(cleanInvite) as { id: number } | undefined)
    : undefined;
  const referrerId = referrer ? Number(referrer.id) : null;

  // No free demo coins on registration — bonuses are earned via the First Deposit Bonus chart
  const welcomeBonus = 0;

  const result = db
    .prepare(
      `INSERT INTO users (username, phone, email, password_hash, salt, role, balance, invite_code, referred_by_user_id, last_login_at)
       VALUES (?, ?, ?, ?, ?, 'player', ?, ?, ?, datetime('now'))`
    )
    .run(cleanName, cleanPhone, cleanEmail, hash, salt, welcomeBonus, userInvite, referrerId);

  const userId = Number(result.lastInsertRowid);
  const token = createSession(userId);
  const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Record<string, unknown>;

  res.status(201).json({ token, user: mapUserRow(userRow) });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body ?? {};
  const cleanId = String(identifier ?? '').trim().toLowerCase();
  const cleanPass = String(password ?? '');

  if (!cleanId || !cleanPass) {
    res.status(400).json({ error: 'Phone/Email and password are required.' });
    return;
  }

  const row = db
    .prepare(`SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?`)
    .get(cleanId, cleanId) as Record<string, unknown> | undefined;

  if (!row || !verifyPassword(cleanPass, String(row.password_hash), String(row.salt))) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  if (row.status === 'banned') {
    res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    return;
  }

  const uid = Number(row.id);
  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(uid);
  const updatedRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(uid) as Record<string, unknown>;

  const token = createSession(uid);
  res.json({ token, user: mapUserRow(updatedRow) });
});

app.post('/api/auth/logout', (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(authHeader.slice(7).trim());
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// ---------- PROMOTION & VIP ROUTES ----------

app.get('/api/promotion/stats', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;

  const totalCommRow = db
    .prepare(`SELECT COALESCE(SUM(commission_amount), 0) as s FROM referral_commissions WHERE referrer_id = ?`)
    .get(user.id) as { s: number };

  const yestCommRow = db
    .prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) as s FROM referral_commissions
       WHERE referrer_id = ? AND date(created_at) = date('now', '-1 day')`
    )
    .get(user.id) as { s: number };

  const directRows = db
    .prepare(
      `SELECT id, username, phone, created_at FROM users WHERE referred_by_user_id = ? ORDER BY id DESC`
    )
    .all(user.id) as { id: number; username: string; phone: string; created_at: string }[];

  const directIds = directRows.map((d) => Number(d.id));
  let teamRows: { id: number; username: string; phone: string; created_at: string }[] = [];
  if (directIds.length > 0) {
    const placeholders = directIds.map(() => '?').join(',');
    teamRows = db
      .prepare(
        `SELECT id, username, phone, created_at FROM users WHERE referred_by_user_id IN (${placeholders}) ORDER BY id DESC`
      )
      .all(...directIds) as { id: number; username: string; phone: string; created_at: string }[];
  }

  function summarizeGroup(rows: { id: number; username: string; phone: string; created_at: string }[], level: 1 | 2) {
    let depositCount = 0;
    let depositAmount = 0;
    let firstDepositCount = 0;
    const list: PromotionSubordinate[] = [];

    for (const r of rows) {
      const uid = Number(r.id);
      const depAgg = db
        .prepare(
          `SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s FROM deposits WHERE user_id = ? AND status = 'approved'`
        )
        .get(uid) as { c: number; s: number };
      const commAgg = db
        .prepare(
          `SELECT COALESCE(SUM(commission_amount), 0) as s FROM referral_commissions WHERE referrer_id = ? AND subordinate_id = ?`
        )
        .get(user.id, uid) as { s: number };

      const c = Number(depAgg.c);
      const s = Number(depAgg.s);
      depositCount += c;
      depositAmount += s;
      if (c > 0) firstDepositCount += 1;

      list.push({
        id: uid,
        username: String(r.username),
        phone: String(r.phone),
        depositCount: c,
        depositAmount: Number(s.toFixed(2)),
        commissionEarned: Number(Number(commAgg.s).toFixed(2)),
        level,
        createdAt: String(r.created_at),
      });
    }

    return {
      summary: {
        registers: rows.length,
        depositCount,
        depositAmount: Number(depositAmount.toFixed(2)),
        firstDepositCount,
      },
      list,
    };
  }

  const directGroup = summarizeGroup(directRows, 1);
  const teamGroup = summarizeGroup(teamRows, 2);

  res.json({
    inviteCode: user.inviteCode,
    totalCommission: Number(Number(totalCommRow.s).toFixed(2)),
    yesterdayCommission: Number(Number(yestCommRow.s).toFixed(2)),
    direct: directGroup.summary,
    team: teamGroup.summary,
    subordinates: [...directGroup.list, ...teamGroup.list].slice(0, 50),
  });
});

app.post('/api/vip/claim', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const level = Number(req.body?.level);
  const tier = VIP_TIERS.find((t) => t.level === level);
  if (!tier) {
    res.status(400).json({ error: 'Invalid VIP tier.' });
    return;
  }

  const currentExp = getUserBetExp(user.id);
  if (currentExp < tier.requiredExp) {
    res.status(400).json({
      error: `Bet ₹${tier.requiredExp.toLocaleString()} total to unlock ${tier.name} (Current: ₹${currentExp.toFixed(0)} EXP).`,
    });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM vip_claims WHERE user_id = ? AND vip_level = ?`)
    .get(user.id, level) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: `${tier.name} level-up bonus has already been claimed.` });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO vip_claims (user_id, vip_level, bonus_amount) VALUES (?, ?, ?)`).run(
      user.id,
      level,
      tier.levelUpBonus
    );
    db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(tier.levelUpBonus, user.id);
    const updated = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    const claimRows = db
      .prepare(`SELECT vip_level FROM vip_claims WHERE user_id = ? ORDER BY vip_level ASC`)
      .all(user.id) as { vip_level: number }[];
    db.exec('COMMIT');

    res.json({
      balance: Number(Number(updated.balance).toFixed(2)),
      claimedVipLevels: claimRows.map((c) => Number(c.vip_level)),
      bonusAmount: tier.levelUpBonus,
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('VIP claim error:', err);
    res.status(500).json({ error: 'Could not claim VIP bonus.' });
  }
});

// ---------- WINGO ROUTES ----------

app.get('/api/wingo/state', (req: AuthRequest, res) => {
  tickAllIntervals();
  const intervalParam = String(req.query.interval || '30s') as GameInterval;
  const interval: GameInterval = INTERVAL_LIST.includes(intervalParam) ? intervalParam : '30s';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(25, Math.max(5, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const activeRow = db
    .prepare(`SELECT * FROM rounds WHERE interval_key = ? AND settled = 0 ORDER BY id DESC LIMIT 1`)
    .get(interval) as Record<string, unknown>;

  const activeRound = mapRoundRow(activeRow);
  const now = Date.now();
  const timeRemainingSec = Math.max(0, Math.ceil((activeRound.endsAt - now) / 1000));

  const totalRounds = (
    db.prepare(`SELECT COUNT(*) as c FROM rounds WHERE interval_key = ? AND settled = 1`).get(interval) as {
      c: number;
    }
  ).c;
  const totalPages = Math.max(1, Math.ceil(totalRounds / limit));

  const historyRows = db
    .prepare(
      `SELECT * FROM rounds WHERE interval_key = ? AND settled = 1 ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(interval, limit, offset) as Record<string, unknown>[];

  const chartRows = db
    .prepare(`SELECT * FROM rounds WHERE interval_key = ? AND settled = 1 ORDER BY id DESC LIMIT 20`)
    .all(interval) as Record<string, unknown>[];

  const history = historyRows.map((r) => mapRoundRow(r));
  const chartRounds = chartRows.map((r) => mapRoundRow(r));
  const last5 = chartRounds.slice(0, 5);
  const trendStats = computeTrendStats(chartRounds.map((r) => r.resultNumber ?? 0));

  const user = getSessionUser(req);
  let myBets: Record<string, unknown>[] = [];
  if (user) {
    myBets = db
      .prepare(
        `SELECT * FROM bets WHERE user_id = ? AND interval_key = ? ORDER BY id DESC LIMIT 30`
      )
      .all(user.id, interval) as Record<string, unknown>[];
  }

  res.json({
    interval,
    activeRound,
    timeRemainingSec,
    isLocked: timeRemainingSec <= WINGO_LOCK_SECONDS,
    last5,
    history,
    page,
    totalPages,
    totalRounds,
    chartRounds: chartRounds.slice(0, 10),
    trendStats,
    announcement: getSetting('announcement_text'),
    myBets: myBets.map((b) => ({
      id: Number(b.id),
      userId: Number(b.user_id),
      intervalKey: String(b.interval_key),
      period: String(b.period),
      betType: String(b.bet_type),
      betValue: String(b.bet_value),
      unitAmount: Number(b.unit_amount),
      quantity: Number(b.quantity),
      multiplier: Number(b.multiplier),
      totalAmount: Number(b.total_amount),
      fee: Number(b.fee),
      payout: Number(b.payout),
      status: String(b.status),
      createdAt: String(b.created_at),
    })),
  });
});

app.post('/api/wingo/bet', requireAuth, (req: AuthRequest, res) => {
  tickAllIntervals();
  const user = req.user!;
  const { intervalKey, period, betType, betValue, unitAmount, quantity, multiplier } = req.body ?? {};

  if (!INTERVAL_LIST.includes(intervalKey)) {
    res.status(400).json({ error: 'Invalid game interval.' });
    return;
  }

  const validTypes: BetType[] = ['color', 'size', 'number'];
  if (!validTypes.includes(betType)) {
    res.status(400).json({ error: 'Invalid bet type.' });
    return;
  }

  const cleanValue = String(betValue ?? '').trim();
  if (betType === 'color' && !['Green', 'Red', 'Violet'].includes(cleanValue)) {
    res.status(400).json({ error: 'Invalid color selection.' });
    return;
  }
  if (betType === 'size' && !['Big', 'Small'].includes(cleanValue)) {
    res.status(400).json({ error: 'Invalid size selection.' });
    return;
  }
  if (betType === 'number' && !/^[0-9]$/.test(cleanValue)) {
    res.status(400).json({ error: 'Invalid number selection.' });
    return;
  }

  const unit = Number(unitAmount);
  const qty = Math.floor(Number(quantity));
  const mult = Math.floor(Number(multiplier));

  if (![1, 10, 50, 100, 1000].includes(unit) || qty < 1 || qty > 1000 || mult < 1 || mult > 1000) {
    res.status(400).json({ error: 'Invalid bet unit, quantity, or multiplier.' });
    return;
  }

  const activeRound = db
    .prepare(`SELECT * FROM rounds WHERE interval_key = ? AND settled = 0 ORDER BY id DESC LIMIT 1`)
    .get(intervalKey) as { period: string; ends_at: number } | undefined;

  if (!activeRound || activeRound.period !== String(period)) {
    res.status(409).json({ error: 'Period has already closed. Please place your bet on the new period.' });
    return;
  }

  const remaining = Math.ceil((activeRound.ends_at - Date.now()) / 1000);
  if (remaining <= WINGO_LOCK_SECONDS) {
    res.status(409).json({ error: 'Betting is locked in the final 5 seconds for round settlement.' });
    return;
  }

  const { totalAmount, fee } = calculateBetAmount(unit, qty, mult);

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < totalAmount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance. Please deposit funds.' });
      return;
    }

    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(totalAmount, user.id);
    const insertRes = db
      .prepare(
        `INSERT INTO bets (user_id, interval_key, period, bet_type, bet_value, unit_amount, quantity, multiplier, total_amount, fee, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(user.id, intervalKey, activeRound.period, betType, cleanValue, unit, qty, mult, totalAmount, fee);

    const updatedUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as Record<string, unknown>;
    const betRow = db.prepare(`SELECT * FROM bets WHERE id = ?`).get(insertRes.lastInsertRowid) as Record<
      string,
      unknown
    >;

    db.exec('COMMIT');
    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      bet: {
        id: Number(betRow.id),
        userId: Number(betRow.user_id),
        intervalKey: String(betRow.interval_key),
        period: String(betRow.period),
        betType: String(betRow.bet_type),
        betValue: String(betRow.bet_value),
        unitAmount: Number(betRow.unit_amount),
        quantity: Number(betRow.quantity),
        multiplier: Number(betRow.multiplier),
        totalAmount: Number(betRow.total_amount),
        fee: Number(betRow.fee),
        payout: Number(betRow.payout),
        status: String(betRow.status),
        createdAt: String(betRow.created_at),
      },
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Bet placement error:', err);
    res.status(500).json({ error: 'Could not place bet. Please try again.' });
  }
});

// ---------- VORTEX MINI-GAME ROUTES ----------

function mapVortexRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    betAmount: Number(row.bet_amount),
    stepsCleared: Number(row.steps_cleared),
    multiplier: Number(row.multiplier),
    payout: Number(row.payout),
    status: String(row.status),
    history: JSON.parse(String(row.history_json || '[]')),
    createdAt: String(row.created_at),
  };
}

app.get('/api/vortex/history', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const rows = db
    .prepare(`SELECT * FROM vortex_plays WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .all(user.id) as Record<string, unknown>[];
  const activeRow = db
    .prepare(`SELECT * FROM vortex_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  res.json({
    activePlay: activeRow ? mapVortexRow(activeRow) : null,
    history: rows.map(mapVortexRow),
  });
});

app.post('/api/vortex/start', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const betAmount = Number(Number(req.body?.betAmount).toFixed(2));
  if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
    res.status(400).json({ error: 'Vortex bet must be between ₹10 and ₹50,000.' });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM vortex_plays WHERE user_id = ? AND status = 'active'`)
    .get(user.id) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Finish or cash out your active Vortex run first.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < betAmount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance.' });
      return;
    }
    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(betAmount, user.id);
    const ins = db
      .prepare(
        `INSERT INTO vortex_plays (user_id, bet_amount, steps_cleared, multiplier, payout, status, history_json)
         VALUES (?, ?, 0, 1.0, 0, 'active', '[]')`
      )
      .run(user.id, betAmount);

    const playRow = db.prepare(`SELECT * FROM vortex_plays WHERE id = ?`).get(ins.lastInsertRowid) as Record<
      string,
      unknown
    >;
    const updatedUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    db.exec('COMMIT');
    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      play: mapVortexRow(playRow),
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to start Vortex run.' });
  }
});

app.post('/api/vortex/spin', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM vortex_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow) {
    res.status(404).json({ error: 'No active Vortex run found.' });
    return;
  }

  const currentStep = Number(playRow.steps_cleared);
  const history = JSON.parse(String(playRow.history_json || '[]')) as {
    step: number;
    outcome: 'advance' | 'bonus' | 'collapse';
    multiplier: number;
    ringColor: string;
  }[];

  // Interleaved 5-win / 3-loss cycle on step 0, scaling smoothly at deeper rings
  let isCollapse = false;
  if (currentStep === 0) {
    const cycleIdx = Number(getSetting('vortex_cycle_index') || '0') || 0;
    const wantWin = shouldWinInInterleavedCycle(cycleIdx);
    setSetting('vortex_cycle_index', String((cycleIdx + 1) % 8));
    isCollapse = !wantWin;
  } else {
    const collapseChance = Math.min(48, 20 + currentStep * 5);
    const roll = crypto.randomInt(0, 100);
    isCollapse = roll < collapseChance;
  }

  const roll = crypto.randomInt(0, 100);
  const colors = ['Emerald', 'Gold', 'Violet'];
  const ringColor = colors[currentStep % colors.length];

  const playId = Number(playRow.id);

  if (isCollapse) {
    history.push({ step: currentStep + 1, outcome: 'collapse', multiplier: 0, ringColor });
    db.prepare(
      `UPDATE vortex_plays SET status = 'collapsed', multiplier = 0, payout = 0, history_json = ? WHERE id = ?`
    ).run(JSON.stringify(history), playId);

    const updated = db.prepare(`SELECT * FROM vortex_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapVortexRow(updated) });
    return;
  }

  const nextStep = Math.min(VORTEX_LADDER.length - 1, currentStep + 1);
  const isBonus = roll > 86 && nextStep < VORTEX_LADDER.length - 1;
  const finalStep = isBonus ? Math.min(VORTEX_LADDER.length - 1, nextStep + 1) : nextStep;
  const newMult = VORTEX_LADDER[finalStep];

  history.push({
    step: finalStep,
    outcome: isBonus ? 'bonus' : 'advance',
    multiplier: newMult,
    ringColor,
  });

  if (finalStep >= VORTEX_LADDER.length - 1) {
    // Max multiplier reached -> auto cash out!
    const payout = calculateVortexPayout(Number(playRow.bet_amount), newMult);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE vortex_plays SET steps_cleared = ?, multiplier = ?, payout = ?, status = 'cashed_out', history_json = ? WHERE id = ?`
      ).run(finalStep, newMult, payout, JSON.stringify(history), playId);
      db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } else {
    db.prepare(
      `UPDATE vortex_plays SET steps_cleared = ?, multiplier = ?, history_json = ? WHERE id = ?`
    ).run(finalStep, newMult, JSON.stringify(history), playId);
  }

  const updated = db.prepare(`SELECT * FROM vortex_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapVortexRow(updated) });
});

app.post('/api/vortex/cashout', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM vortex_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow || Number(playRow.steps_cleared) < 1) {
    res.status(400).json({ error: 'Spin at least one ring before cashing out.' });
    return;
  }

  const playId = Number(playRow.id);
  const payout = calculateVortexPayout(Number(playRow.bet_amount), Number(playRow.multiplier));
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE vortex_plays SET payout = ?, status = 'cashed_out' WHERE id = ?`).run(payout, playId);
    db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Cashout failed.' });
    return;
  }

  const updated = db.prepare(`SELECT * FROM vortex_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapVortexRow(updated) });
});

// ---------- CHICKEN ROAD MINI-GAME ROUTES ----------

function mapChickenRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    betAmount: Number(row.bet_amount),
    difficulty: String(row.difficulty) as ChickenDifficulty,
    currentLane: Number(row.current_lane),
    multiplier: Number(row.multiplier),
    payout: Number(row.payout),
    status: String(row.status),
    trapLane: row.trap_lane !== null && row.trap_lane !== undefined ? Number(row.trap_lane) : null,
    createdAt: String(row.created_at),
  };
}

app.get('/api/chicken/history', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const rows = db
    .prepare(`SELECT * FROM chicken_plays WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .all(user.id) as Record<string, unknown>[];
  const activeRow = db
    .prepare(`SELECT * FROM chicken_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  res.json({
    activePlay: activeRow ? mapChickenRow(activeRow) : null,
    history: rows.map(mapChickenRow),
  });
});

app.post('/api/chicken/start', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const betAmount = Number(Number(req.body?.betAmount).toFixed(2));
  const difficulty: ChickenDifficulty =
    req.body?.difficulty === 'easy' || req.body?.difficulty === 'hard' ? req.body.difficulty : 'medium';

  if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
    res.status(400).json({ error: 'Chicken Road bet must be between ₹10 and ₹50,000.' });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM chicken_plays WHERE user_id = ? AND status = 'active'`)
    .get(user.id) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Finish or cash out your active Chicken Road run first.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < betAmount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance.' });
      return;
    }

    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(betAmount, user.id);
    const ins = db
      .prepare(
        `INSERT INTO chicken_plays (user_id, bet_amount, difficulty, current_lane, multiplier, payout, status)
         VALUES (?, ?, ?, 0, 1.0, 0, 'active')`
      )
      .run(user.id, betAmount, difficulty);

    const playRow = db.prepare(`SELECT * FROM chicken_plays WHERE id = ?`).get(ins.lastInsertRowid) as Record<
      string,
      unknown
    >;
    const updatedUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    db.exec('COMMIT');
    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      play: mapChickenRow(playRow),
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to start Chicken Road run.' });
  }
});

app.post('/api/chicken/step', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM chicken_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow) {
    res.status(404).json({ error: 'No active Chicken Road run found.' });
    return;
  }

  const playId = Number(playRow.id);
  const currentLane = Number(playRow.current_lane);
  const difficulty = (String(playRow.difficulty) as ChickenDifficulty) || 'medium';
  const ladder = CHICKEN_LADDERS[difficulty] ?? CHICKEN_LADDERS.medium;
  const nextLane = currentLane + 1;

  // Lane 1 follows interleaved 5-win / 3-loss rate; deeper lanes scale cleanly by difficulty
  let crashed = false;
  if (currentLane === 0) {
    const cycleIdx = Number(getSetting('chicken_cycle_index') || '0') || 0;
    const wantWin = shouldWinInInterleavedCycle(cycleIdx);
    setSetting('chicken_cycle_index', String((cycleIdx + 1) % 8));
    crashed = !wantWin;
  } else {
    const baseCrash = difficulty === 'easy' ? 16 : difficulty === 'hard' ? 34 : 24;
    const risk = Math.min(58, baseCrash + currentLane * 4);
    crashed = crypto.randomInt(0, 100) < risk;
  }

  if (crashed) {
    db.prepare(
      `UPDATE chicken_plays SET status = 'crashed', multiplier = 0, payout = 0, trap_lane = ? WHERE id = ?`
    ).run(nextLane, playId);
    const updated = db.prepare(`SELECT * FROM chicken_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapChickenRow(updated) });
    return;
  }

  const finalLane = Math.min(ladder.length - 1, nextLane);
  const newMult = ladder[finalLane];

  if (finalLane >= ladder.length - 1) {
    const payout = calculateChickenPayout(Number(playRow.bet_amount), newMult);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE chicken_plays SET current_lane = ?, multiplier = ?, payout = ?, status = 'cashed_out' WHERE id = ?`
      ).run(finalLane, newMult, payout, playId);
      db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } else {
    db.prepare(`UPDATE chicken_plays SET current_lane = ?, multiplier = ? WHERE id = ?`).run(
      finalLane,
      newMult,
      playId
    );
  }

  const updated = db.prepare(`SELECT * FROM chicken_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapChickenRow(updated) });
});

app.post('/api/chicken/cashout', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM chicken_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow || Number(playRow.current_lane) < 1) {
    res.status(400).json({ error: 'Cross at least 1 lane before cashing out.' });
    return;
  }

  const playId = Number(playRow.id);
  const payout = calculateChickenPayout(Number(playRow.bet_amount), Number(playRow.multiplier));

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE chicken_plays SET payout = ?, status = 'cashed_out' WHERE id = ?`).run(payout, playId);
    db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Chicken Road cashout failed.' });
    return;
  }

  const updated = db.prepare(`SELECT * FROM chicken_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapChickenRow(updated) });
});

// ---------- AVIATOR CRASH MINI-GAME ROUTES ----------

function mapAviatorRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    betAmount: Number(row.bet_amount),
    crashMultiplier: Number(row.crash_multiplier),
    cashoutMultiplier:
      row.cashout_multiplier !== null && row.cashout_multiplier !== undefined
        ? Number(row.cashout_multiplier)
        : null,
    payout: Number(row.payout),
    status: String(row.status),
    startedAt: Number(row.started_at),
    createdAt: String(row.created_at),
  };
}

app.get('/api/aviator/history', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const activeRow = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (activeRow) {
    const elapsed = Date.now() - Number(activeRow.started_at);
    const liveMult = calculateAviatorMultiplierAtElapsed(elapsed);
    if (liveMult >= Number(activeRow.crash_multiplier)) {
      db.prepare(`UPDATE aviator_plays SET status = 'crashed', payout = 0 WHERE id = ?`).run(Number(activeRow.id));
    }
  }

  const freshActive = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  const rows = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .all(user.id) as Record<string, unknown>[];
  const recentCrashRows = db
    .prepare(`SELECT crash_multiplier FROM aviator_plays WHERE status != 'active' ORDER BY id DESC LIMIT 14`)
    .all() as { crash_multiplier: number }[];

  const recentMultipliers =
    recentCrashRows.length > 0
      ? recentCrashRows.map((r) => Number(r.crash_multiplier))
      : [1.34, 2.22, 1.14, 3.14, 1.76, 8.66, 1.24, 2.85, 1.03, 3.08];

  res.json({
    activePlay: freshActive ? mapAviatorRow(freshActive) : null,
    history: rows.map(mapAviatorRow),
    recentMultipliers,
  });
});

app.post('/api/aviator/start', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const betAmount = Number(Number(req.body?.betAmount).toFixed(2));
  if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
    res.status(400).json({ error: 'Aviator bet must be between ₹10 and ₹50,000.' });
    return;
  }

  const existing = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  if (existing) {
    const elapsed = Date.now() - Number(existing.started_at);
    if (calculateAviatorMultiplierAtElapsed(elapsed) >= Number(existing.crash_multiplier)) {
      db.prepare(`UPDATE aviator_plays SET status = 'crashed', payout = 0 WHERE id = ?`).run(Number(existing.id));
    } else {
      res.status(409).json({ error: 'Cash out or finish your current Aviator flight first.' });
      return;
    }
  }

  // Interleaved 5-win / 3-loss friendly crash curve
  const cycleIdx = Number(getSetting('aviator_cycle_index') || '0') || 0;
  const wantWin = shouldWinInInterleavedCycle(cycleIdx);
  setSetting('aviator_cycle_index', String((cycleIdx + 1) % 8));

  const crashMultiplier = wantWin
    ? Number((1.65 + (crypto.randomInt(0, 680) / 100)).toFixed(2))
    : Number((1.03 + (crypto.randomInt(0, 15) / 100)).toFixed(2));

  const startedAt = Date.now();

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < betAmount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance.' });
      return;
    }

    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(betAmount, user.id);
    const ins = db
      .prepare(
        `INSERT INTO aviator_plays (user_id, bet_amount, crash_multiplier, status, started_at)
         VALUES (?, ?, ?, 'active', ?)`
      )
      .run(user.id, betAmount, crashMultiplier, startedAt);

    const playRow = db.prepare(`SELECT * FROM aviator_plays WHERE id = ?`).get(ins.lastInsertRowid) as Record<
      string,
      unknown
    >;
    const updatedUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    db.exec('COMMIT');

    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      play: mapAviatorRow(playRow),
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to launch Aviator flight.' });
  }
});

app.post('/api/aviator/cashout', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow) {
    res.status(404).json({ error: 'No active Aviator flight found.' });
    return;
  }

  const playId = Number(playRow.id);
  const crashMult = Number(playRow.crash_multiplier);
  const elapsed = Date.now() - Number(playRow.started_at);
  const currentMult = calculateAviatorMultiplierAtElapsed(elapsed);

  if (currentMult >= crashMult) {
    db.prepare(`UPDATE aviator_plays SET status = 'crashed', payout = 0 WHERE id = ?`).run(playId);
    const updated = db.prepare(`SELECT * FROM aviator_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapAviatorRow(updated) });
    return;
  }

  const cashoutMult = Math.max(1.01, Math.min(crashMult - 0.01, currentMult));
  const payout = calculateAviatorPayout(Number(playRow.bet_amount), cashoutMult);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE aviator_plays SET cashout_multiplier = ?, payout = ?, status = 'cashed_out' WHERE id = ?`
    ).run(cashoutMult, payout, playId);
    db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Aviator cashout failed.' });
    return;
  }

  const updated = db.prepare(`SELECT * FROM aviator_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapAviatorRow(updated) });
});

app.post('/api/aviator/crash', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM aviator_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow) {
    res.json({ play: null });
    return;
  }

  const playId = Number(playRow.id);
  const elapsed = Date.now() - Number(playRow.started_at);
  const currentMult = calculateAviatorMultiplierAtElapsed(elapsed);
  if (currentMult >= Number(playRow.crash_multiplier)) {
    db.prepare(`UPDATE aviator_plays SET status = 'crashed', payout = 0 WHERE id = ?`).run(playId);
  }
  const updated = db.prepare(`SELECT * FROM aviator_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  res.json({ play: mapAviatorRow(updated) });
});

// ---------- MINES MINI-GAME ROUTES ----------

function mapMinesRow(row: Record<string, unknown>, revealMines = false) {
  const status = String(row.status);
  const showMines = revealMines || status !== 'active';
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    betAmount: Number(row.bet_amount),
    minesCount: Number(row.mines_count),
    revealedIndices: JSON.parse(String(row.revealed_indices_json || '[]')) as number[],
    mineIndices: showMines ? (JSON.parse(String(row.mine_indices_json || '[]')) as number[]) : undefined,
    multiplier: Number(row.multiplier),
    payout: Number(row.payout),
    status,
    createdAt: String(row.created_at),
  };
}

app.get('/api/mines/history', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const activeRow = db
    .prepare(`SELECT * FROM mines_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  const rows = db
    .prepare(`SELECT * FROM mines_plays WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .all(user.id) as Record<string, unknown>[];

  res.json({
    activePlay: activeRow ? mapMinesRow(activeRow, false) : null,
    history: rows.map((r) => mapMinesRow(r, false)),
  });
});

app.post('/api/mines/start', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const betAmount = Number(Number(req.body?.betAmount).toFixed(2));
  const minesCount = Math.floor(Number(req.body?.minesCount ?? 3));

  if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
    res.status(400).json({ error: 'Mines bet must be between ₹10 and ₹50,000.' });
    return;
  }
  if (!Number.isInteger(minesCount) || minesCount < 1 || minesCount > 24) {
    res.status(400).json({ error: 'Mines count must be between 1 and 24.' });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM mines_plays WHERE user_id = ? AND status = 'active'`)
    .get(user.id) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Finish or cash out your active Mines board first.' });
    return;
  }

  // Generate shuffled 0..24 mine positions
  const pool = Array.from({ length: 25 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const mineIndices = pool.slice(0, minesCount);

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < betAmount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance.' });
      return;
    }

    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(betAmount, user.id);
    const ins = db
      .prepare(
        `INSERT INTO mines_plays (user_id, bet_amount, mines_count, mine_indices_json, revealed_indices_json, multiplier, payout, status)
         VALUES (?, ?, ?, ?, '[]', 1.0, 0, 'active')`
      )
      .run(user.id, betAmount, minesCount, JSON.stringify(mineIndices));

    const playRow = db.prepare(`SELECT * FROM mines_plays WHERE id = ?`).get(ins.lastInsertRowid) as Record<
      string,
      unknown
    >;
    const updatedUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    db.exec('COMMIT');

    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      play: mapMinesRow(playRow, false),
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to start Mines board.' });
  }
});

app.post('/api/mines/reveal', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const tileIndex = Number(req.body?.tileIndex);
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > 24) {
    res.status(400).json({ error: 'Invalid tile index (0–24).' });
    return;
  }

  const playRow = db
    .prepare(`SELECT * FROM mines_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;
  if (!playRow) {
    res.status(404).json({ error: 'No active Mines game found.' });
    return;
  }

  const playId = Number(playRow.id);
  const mineIndices = JSON.parse(String(playRow.mine_indices_json || '[]')) as number[];
  const revealed = JSON.parse(String(playRow.revealed_indices_json || '[]')) as number[];
  const minesCount = Number(playRow.mines_count);

  if (revealed.includes(tileIndex)) {
    res.status(400).json({ error: 'Tile already revealed.' });
    return;
  }

  // On first reveal, gently enforce 5:3 win/loss cycle if hitting a mine
  if (revealed.length === 0) {
    const cycleIdx = Number(getSetting('mines_cycle_index') || '0') || 0;
    const wantWin = shouldWinInInterleavedCycle(cycleIdx);
    setSetting('mines_cycle_index', String((cycleIdx + 1) % 8));

    if (wantWin && mineIndices.includes(tileIndex)) {
      const safeChoices = Array.from({ length: 25 }, (_, i) => i).filter(
        (i) => i !== tileIndex && !mineIndices.includes(i)
      );
      if (safeChoices.length > 0) {
        const swapTile = safeChoices[crypto.randomInt(0, safeChoices.length)];
        const mIdx = mineIndices.indexOf(tileIndex);
        mineIndices[mIdx] = swapTile;
        db.prepare(`UPDATE mines_plays SET mine_indices_json = ? WHERE id = ?`).run(
          JSON.stringify(mineIndices),
          playId
        );
      }
    }
  }

  if (mineIndices.includes(tileIndex)) {
    db.prepare(
      `UPDATE mines_plays SET status = 'exploded', multiplier = 0, payout = 0, revealed_indices_json = ? WHERE id = ?`
    ).run(JSON.stringify([...revealed, tileIndex]), playId);
    const updated = db.prepare(`SELECT * FROM mines_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapMinesRow(updated, true) });
    return;
  }

  const nextRevealed = [...revealed, tileIndex];
  const nextMult = calculateMinesMultiplier(minesCount, nextRevealed.length);
  const allSafeCleared = nextRevealed.length >= 25 - minesCount;

  if (allSafeCleared) {
    const payout = calculateMinesPayout(Number(playRow.bet_amount), nextMult);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE mines_plays SET revealed_indices_json = ?, multiplier = ?, payout = ?, status = 'cashed_out' WHERE id = ?`
      ).run(JSON.stringify(nextRevealed), nextMult, payout, playId);
      db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } else {
    db.prepare(`UPDATE mines_plays SET revealed_indices_json = ?, multiplier = ? WHERE id = ?`).run(
      JSON.stringify(nextRevealed),
      nextMult,
      playId
    );
  }

  const updated = db.prepare(`SELECT * FROM mines_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({
    balance: Number(Number(freshUser.balance).toFixed(2)),
    play: mapMinesRow(updated, allSafeCleared),
  });
});

app.post('/api/mines/cashout', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const playRow = db
    .prepare(`SELECT * FROM mines_plays WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined;

  if (!playRow) {
    res.status(404).json({ error: 'No active Mines game found.' });
    return;
  }

  const revealed = JSON.parse(String(playRow.revealed_indices_json || '[]')) as number[];
  if (revealed.length < 1) {
    res.status(400).json({ error: 'Reveal at least 1 safe gem before cashing out.' });
    return;
  }

  const playId = Number(playRow.id);
  const payout = calculateMinesPayout(Number(playRow.bet_amount), Number(playRow.multiplier));

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE mines_plays SET payout = ?, status = 'cashed_out' WHERE id = ?`).run(payout, playId);
    db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(payout, user.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Mines cashout failed.' });
    return;
  }

  const updated = db.prepare(`SELECT * FROM mines_plays WHERE id = ?`).get(playId) as Record<string, unknown>;
  const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
  res.json({ balance: Number(Number(freshUser.balance).toFixed(2)), play: mapMinesRow(updated, true) });
});

// ---------- CUSTOMER SUPPORT CHAT ROUTES ----------

function mapSupportRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    senderRole: row.sender_role === 'admin' ? 'admin' : 'player',
    message: String(row.message),
    isReadByAdmin: Number(row.is_read_by_admin) === 1,
    createdAt: String(row.created_at),
  };
}

app.get('/api/support/messages', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const rows = db
    .prepare(`SELECT * FROM support_messages WHERE user_id = ? ORDER BY id ASC LIMIT 100`)
    .all(user.id) as Record<string, unknown>[];
  res.json({ messages: rows.map(mapSupportRow) });
});

app.post('/api/support/messages', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const cleanMsg = String(req.body?.message ?? '').trim();
  if (!cleanMsg || cleanMsg.length > 1000) {
    res.status(400).json({ error: 'Message must be between 1 and 1000 characters.' });
    return;
  }

  const ins = db
    .prepare(
      `INSERT INTO support_messages (user_id, sender_role, message, is_read_by_admin)
       VALUES (?, 'player', ?, 0)`
    )
    .run(user.id, cleanMsg);
  const row = db.prepare(`SELECT * FROM support_messages WHERE id = ?`).get(ins.lastInsertRowid) as Record<
    string,
    unknown
  >;
  res.status(201).json({ message: mapSupportRow(row) });
});

// ---------- WALLET & PAYMENT ROUTES ----------

app.get('/api/wallet/info', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const deposits = db
    .prepare(`SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 30`)
    .all(user.id) as Record<string, unknown>[];
  const withdrawals = db
    .prepare(`SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 30`)
    .all(user.id) as Record<string, unknown>[];

  res.json({
    balance: user.balance,
    firstDepositBonusClaimed: Boolean(user.firstDepositBonusClaimed),
    paymentSettings: {
      paymentQrDataUrl: getSetting('payment_qr_data_url'),
      paymentUpiId: getSetting('payment_upi_id'),
      paymentMerchantName: getSetting('payment_merchant_name'),
      announcementText: getSetting('announcement_text'),
    },
    deposits: deposits.map((d) => ({
      id: Number(d.id),
      userId: Number(d.user_id),
      amount: Number(d.amount),
      utr: String(d.utr),
      paymentMethod: String(d.payment_method),
      status: String(d.status),
      adminNote: d.admin_note ? String(d.admin_note) : null,
      createdAt: String(d.created_at),
      reviewedAt: d.reviewed_at ? String(d.reviewed_at) : null,
    })),
    withdrawals: withdrawals.map((w) => ({
      id: Number(w.id),
      userId: Number(w.user_id),
      amount: Number(w.amount),
      upiOrBank: String(w.upi_or_bank),
      accountName: String(w.account_name),
      status: String(w.status),
      adminNote: w.admin_note ? String(w.admin_note) : null,
      createdAt: String(w.created_at),
      reviewedAt: w.reviewed_at ? String(w.reviewed_at) : null,
    })),
  });
});

app.post('/api/wallet/deposit', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const amount = Number(Number(req.body?.amount).toFixed(2));
  const utr = String(req.body?.utr ?? '').trim();

  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_AMOUNT || amount > MAX_DEPOSIT_AMOUNT) {
    res
      .status(400)
      .json({ error: `Deposit amount must be between ₹${MIN_DEPOSIT_AMOUNT} and ₹${MAX_DEPOSIT_AMOUNT.toLocaleString()}.` });
    return;
  }
  if (utr.length < 6) {
    res.status(400).json({ error: 'Enter a valid 6+ character UTR / Transaction Reference ID.' });
    return;
  }

  const ins = db
    .prepare(`INSERT INTO deposits (user_id, amount, utr, payment_method, status) VALUES (?, ?, ?, 'UPI QR', 'pending')`)
    .run(user.id, amount, utr);

  const row = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(ins.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json({
    deposit: {
      id: Number(row.id),
      userId: Number(row.user_id),
      amount: Number(row.amount),
      utr: String(row.utr),
      paymentMethod: String(row.payment_method),
      status: String(row.status),
      adminNote: null,
      createdAt: String(row.created_at),
      reviewedAt: null,
    },
  });
});

app.post('/api/wallet/withdraw', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const amount = Number(Number(req.body?.amount).toFixed(2));
  const upiOrBank = String(req.body?.upiOrBank ?? '').trim();
  const accountName = String(req.body?.accountName ?? '').trim();

  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_AMOUNT || amount > MAX_WITHDRAW_AMOUNT) {
    res
      .status(400)
      .json({ error: `Withdrawal amount must be between ₹${MIN_WITHDRAW_AMOUNT} and ₹${MAX_WITHDRAW_AMOUNT.toLocaleString()}.` });
    return;
  }
  if (upiOrBank.length < 4 || accountName.length < 2) {
    res.status(400).json({ error: 'Enter valid account holder name and UPI ID or Bank Account.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const freshUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    if (freshUser.balance < amount) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: 'Insufficient wallet balance for withdrawal.' });
      return;
    }

    db.prepare(`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?`).run(amount, user.id);
    const ins = db
      .prepare(
        `INSERT INTO withdrawals (user_id, amount, upi_or_bank, account_name, status) VALUES (?, ?, ?, ?, 'pending')`
      )
      .run(user.id, amount, upiOrBank, accountName);

    const row = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(ins.lastInsertRowid) as Record<
      string,
      unknown
    >;
    const updatedUser = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(user.id) as { balance: number };
    db.exec('COMMIT');

    res.status(201).json({
      balance: Number(Number(updatedUser.balance).toFixed(2)),
      withdrawal: {
        id: Number(row.id),
        userId: Number(row.user_id),
        amount: Number(row.amount),
        upiOrBank: String(row.upi_or_bank),
        accountName: String(row.account_name),
        status: String(row.status),
        adminNote: null,
        createdAt: String(row.created_at),
        reviewedAt: null,
      },
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Withdrawal request failed.' });
  }
});

// ---------- ADMIN ROUTES ----------

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const totalPlayers = (
    db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'player'`).get() as { c: number }
  ).c;
  const totalDeposited = (
    db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM deposits WHERE status = 'approved'`).get() as { s: number }
  ).s;
  const totalWithdrawn = (
    db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM withdrawals WHERE status = 'approved'`).get() as { s: number }
  ).s;
  const pendingDepositsCount = (
    db.prepare(`SELECT COUNT(*) as c FROM deposits WHERE status = 'pending'`).get() as { c: number }
  ).c;
  const pendingWithdrawsCount = (
    db.prepare(`SELECT COUNT(*) as c FROM withdrawals WHERE status = 'pending'`).get() as { c: number }
  ).c;
  const betAgg = db
    .prepare(`SELECT COALESCE(SUM(total_amount), 0) as wagered, COALESCE(SUM(payout), 0) as payouts FROM bets`)
    .get() as { wagered: number; payouts: number };

  const vortexAgg = db
    .prepare(`SELECT COALESCE(SUM(bet_amount), 0) as wagered, COALESCE(SUM(payout), 0) as payouts FROM vortex_plays`)
    .get() as { wagered: number; payouts: number };

  const chickenAgg = db
    .prepare(`SELECT COALESCE(SUM(bet_amount), 0) as wagered, COALESCE(SUM(payout), 0) as payouts FROM chicken_plays`)
    .get() as { wagered: number; payouts: number };

  const aviatorAgg = db
    .prepare(`SELECT COALESCE(SUM(bet_amount), 0) as wagered, COALESCE(SUM(payout), 0) as payouts FROM aviator_plays`)
    .get() as { wagered: number; payouts: number };

  const minesAgg = db
    .prepare(`SELECT COALESCE(SUM(bet_amount), 0) as wagered, COALESCE(SUM(payout), 0) as payouts FROM mines_plays`)
    .get() as { wagered: number; payouts: number };

  const totalWagered = Number(
    (betAgg.wagered + vortexAgg.wagered + chickenAgg.wagered + aviatorAgg.wagered + minesAgg.wagered).toFixed(2)
  );
  const totalPayouts = Number(
    (betAgg.payouts + vortexAgg.payouts + chickenAgg.payouts + aviatorAgg.payouts + minesAgg.payouts).toFixed(2)
  );
  const houseProfit = Number((totalWagered - totalPayouts).toFixed(2));

  res.json({
    totalPlayers,
    totalDeposited: Number(totalDeposited.toFixed(2)),
    totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
    pendingDepositsCount,
    pendingWithdrawsCount,
    totalWagered,
    totalPayouts,
    houseProfit,
  });
});

app.get('/api/admin/live-rounds', requireAdmin, (_req, res) => {
  tickAllIntervals();
  const now = Date.now();
  const summaries = INTERVAL_LIST.map((intervalKey) => {
    const activeRow = db
      .prepare(`SELECT * FROM rounds WHERE interval_key = ? AND settled = 0 ORDER BY id DESC LIMIT 1`)
      .get(intervalKey) as Record<string, unknown>;
    const activeRound = mapRoundRow(activeRow, true);
    const timeRemainingSec = Math.max(0, Math.ceil((activeRound.endsAt - now) / 1000));

    // Upcoming 5 queued periods
    const upcomingPeriods: { period: string; forcedNumber: number | null }[] = [];
    for (let i = 1; i <= 5; i++) {
      const p = incrementPeriod(activeRound.period, i);
      const ov = db
        .prepare(`SELECT forced_number FROM period_overrides WHERE interval_key = ? AND period = ?`)
        .get(intervalKey, p) as { forced_number: number } | undefined;
      upcomingPeriods.push({ period: p, forcedNumber: ov ? ov.forced_number : null });
    }

    // Live bet exposure in current active period
    const activeBets = db
      .prepare(`SELECT bet_type, bet_value, total_amount FROM bets WHERE interval_key = ? AND period = ?`)
      .all(intervalKey, activeRound.period) as { bet_type: BetType; bet_value: string; total_amount: number }[];

    const exposure = {
      Green: 0,
      Violet: 0,
      Red: 0,
      Big: 0,
      Small: 0,
      numbers: Array(10).fill(0) as number[],
      totalPool: 0,
    };

    for (const b of activeBets) {
      exposure.totalPool = Number((exposure.totalPool + b.total_amount).toFixed(2));
      if (b.bet_type === 'color' && (b.bet_value === 'Green' || b.bet_value === 'Violet' || b.bet_value === 'Red')) {
        exposure[b.bet_value] = Number((exposure[b.bet_value] + b.total_amount).toFixed(2));
      } else if (b.bet_type === 'size' && (b.bet_value === 'Big' || b.bet_value === 'Small')) {
        exposure[b.bet_value] = Number((exposure[b.bet_value] + b.total_amount).toFixed(2));
      } else if (b.bet_type === 'number') {
        const idx = Number(b.bet_value);
        if (idx >= 0 && idx <= 9) {
          exposure.numbers[idx] = Number((exposure.numbers[idx] + b.total_amount).toFixed(2));
        }
      }
    }

    const recentRows = db
      .prepare(`SELECT * FROM rounds WHERE interval_key = ? AND settled = 1 ORDER BY id DESC LIMIT 6`)
      .all(intervalKey) as Record<string, unknown>[];

    return {
      interval: intervalKey,
      label: INTERVAL_CONFIG[intervalKey].label,
      durationSec: INTERVAL_CONFIG[intervalKey].durationSec,
      activeRound,
      timeRemainingSec,
      upcomingPeriods,
      exposure,
      recentRounds: recentRows.map((r) => mapRoundRow(r, true)),
    };
  });

  res.json({ intervals: summaries });
});

app.post('/api/admin/override', requireAdmin, (req, res) => {
  const { intervalKey, period, forcedNumber } = req.body ?? {};
  if (!INTERVAL_LIST.includes(intervalKey)) {
    res.status(400).json({ error: 'Invalid interval.' });
    return;
  }
  const cleanPeriod = String(period ?? '').trim();
  if (!/^\d{10,20}$/.test(cleanPeriod)) {
    res.status(400).json({ error: 'Invalid period number.' });
    return;
  }

  const clearOverride = forcedNumber === null || forcedNumber === undefined || forcedNumber === '';
  const num = clearOverride ? null : Number(forcedNumber);
  if (!clearOverride && (!Number.isInteger(num) || num! < 0 || num! > 9)) {
    res.status(400).json({ error: 'Forced result must be a digit between 0 and 9 (or null to clear).' });
    return;
  }

  // Check if it's currently the live active round
  const liveRound = db
    .prepare(`SELECT id, settled FROM rounds WHERE interval_key = ? AND period = ?`)
    .get(intervalKey, cleanPeriod) as { id: number; settled: number } | undefined;

  if (liveRound) {
    if (liveRound.settled === 1) {
      res.status(409).json({ error: 'This period has already settled.' });
      return;
    }
    db.prepare(`UPDATE rounds SET admin_override = ?, is_overridden = ? WHERE id = ?`).run(
      num,
      num !== null ? 1 : 0,
      liveRound.id
    );
  } else {
    if (num === null) {
      db.prepare(`DELETE FROM period_overrides WHERE interval_key = ? AND period = ?`).run(intervalKey, cleanPeriod);
    } else {
      db.prepare(
        `INSERT INTO period_overrides (interval_key, period, forced_number) VALUES (?, ?, ?)
         ON CONFLICT(interval_key, period) DO UPDATE SET forced_number = excluded.forced_number`
      ).run(intervalKey, cleanPeriod, num);
    }
  }

  res.json({ ok: true, intervalKey, period: cleanPeriod, forcedNumber: num });
});

app.get('/api/admin/players', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.phone, u.email, u.role, u.balance, u.status, u.created_at,
        COALESCE((SELECT SUM(d.amount) FROM deposits d WHERE d.user_id = u.id AND d.status = 'approved'), 0) as total_deposited,
        COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = u.id AND w.status = 'approved'), 0) as total_withdrawn,
        COALESCE((SELECT SUM(b.total_amount) FROM bets b WHERE b.user_id = u.id), 0) +
        COALESCE((SELECT SUM(v.bet_amount) FROM vortex_plays v WHERE v.user_id = u.id), 0) +
        COALESCE((SELECT SUM(c.bet_amount) FROM chicken_plays c WHERE c.user_id = u.id), 0) as total_wagered,
        COALESCE((SELECT SUM(b.payout) FROM bets b WHERE b.user_id = u.id), 0) +
        COALESCE((SELECT SUM(v.payout) FROM vortex_plays v WHERE v.user_id = u.id), 0) +
        COALESCE((SELECT SUM(c.payout) FROM chicken_plays c WHERE c.user_id = u.id), 0) as total_won
       FROM users u
       ORDER BY u.id DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    players: rows.map((r) => {
      const wagered = Number(r.total_wagered);
      const won = Number(r.total_won);
      return {
        id: Number(r.id),
        username: String(r.username),
        phone: String(r.phone),
        email: String(r.email),
        role: r.role === 'admin' ? 'admin' : 'player',
        balance: Number(Number(r.balance).toFixed(2)),
        status: r.status === 'banned' ? 'banned' : 'active',
        createdAt: String(r.created_at),
        totalDeposited: Number(Number(r.total_deposited).toFixed(2)),
        totalWithdrawn: Number(Number(r.total_withdrawn).toFixed(2)),
        totalWagered: Number(wagered.toFixed(2)),
        totalWon: Number(won.toFixed(2)),
        netProfit: Number((won - wagered).toFixed(2)),
      };
    }),
  });
});

app.post('/api/admin/players/:id/adjust', requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const { deltaBalance, status } = req.body ?? {};

  const target = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetId) as Record<string, unknown> | undefined;
  if (!target) {
    res.status(404).json({ error: 'Player not found.' });
    return;
  }

  if (typeof deltaBalance === 'number' && Number.isFinite(deltaBalance) && deltaBalance !== 0) {
    const newBal = Math.max(0, Number((Number(target.balance) + deltaBalance).toFixed(2)));
    db.prepare(`UPDATE users SET balance = ? WHERE id = ?`).run(newBal, targetId);
  }

  if (status === 'active' || status === 'banned') {
    if (target.role === 'admin' && status === 'banned') {
      res.status(400).json({ error: 'Cannot ban an admin account.' });
      return;
    }
    db.prepare(`UPDATE users SET status = ? WHERE id = ?`).run(status, targetId);
  }

  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetId) as Record<string, unknown>;
  res.json({ player: mapUserRow(updated) });
});

app.get('/api/admin/deposits', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, u.username, u.phone FROM deposits d
       JOIN users u ON u.id = d.user_id
       ORDER BY CASE WHEN d.status = 'pending' THEN 0 ELSE 1 END, d.id DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    deposits: rows.map((d) => ({
      id: Number(d.id),
      userId: Number(d.user_id),
      username: String(d.username),
      phone: String(d.phone),
      amount: Number(d.amount),
      utr: String(d.utr),
      paymentMethod: String(d.payment_method),
      status: String(d.status),
      adminNote: d.admin_note ? String(d.admin_note) : null,
      createdAt: String(d.created_at),
      reviewedAt: d.reviewed_at ? String(d.reviewed_at) : null,
    })),
  });
});

app.post('/api/admin/deposits/:id/review', requireAdmin, (req, res) => {
  const depId = Number(req.params.id);
  const action = req.body?.action;
  const note = String(req.body?.note ?? '').trim() || null;

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: 'Action must be approve or reject.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(depId) as
      | { id: number; user_id: number; amount: number; status: string }
      | undefined;
    if (!dep) {
      db.exec('ROLLBACK');
      res.status(404).json({ error: 'Deposit request not found.' });
      return;
    }
    if (dep.status !== 'pending') {
      db.exec('ROLLBACK');
      res.status(409).json({ error: 'Deposit request already reviewed.' });
      return;
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(
      `UPDATE deposits SET status = ?, admin_note = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, note, depId);

    if (action === 'approve') {
      const userRow = db
        .prepare(`SELECT first_deposit_bonus_claimed, referred_by_user_id FROM users WHERE id = ?`)
        .get(dep.user_id) as
        | { first_deposit_bonus_claimed: number; referred_by_user_id: number | null }
        | undefined;
      let bonus = 0;
      if (userRow && Number(userRow.first_deposit_bonus_claimed) === 0) {
        bonus = calculateFirstDepositBonus(dep.amount);
        if (bonus > 0) {
          db.prepare(`UPDATE users SET first_deposit_bonus_claimed = 1 WHERE id = ?`).run(dep.user_id);
        }
      }
      db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(
        dep.amount + bonus,
        dep.user_id
      );

      // Credit referral commissions (Level 1: 5%, Level 2: 2%)
      if (userRow && userRow.referred_by_user_id) {
        const ref1Id = Number(userRow.referred_by_user_id);
        const comm1 = calculateReferralCommission(dep.amount, 1);
        if (comm1 > 0) {
          db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(comm1, ref1Id);
          db.prepare(
            `INSERT INTO referral_commissions (referrer_id, subordinate_id, level, source_amount, commission_amount)
             VALUES (?, ?, 1, ?, ?)`
          ).run(ref1Id, dep.user_id, dep.amount, comm1);
        }

        const ref1Row = db
          .prepare(`SELECT referred_by_user_id FROM users WHERE id = ?`)
          .get(ref1Id) as { referred_by_user_id: number | null } | undefined;
        if (ref1Row && ref1Row.referred_by_user_id) {
          const ref2Id = Number(ref1Row.referred_by_user_id);
          const comm2 = calculateReferralCommission(dep.amount, 2);
          if (comm2 > 0) {
            db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(comm2, ref2Id);
            db.prepare(
              `INSERT INTO referral_commissions (referrer_id, subordinate_id, level, source_amount, commission_amount)
               VALUES (?, ?, 2, ?, ?)`
            ).run(ref2Id, dep.user_id, dep.amount, comm2);
          }
        }
      }
    }

    db.exec('COMMIT');
    res.json({ ok: true, status: nextStatus });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to review deposit.' });
  }
});

app.get('/api/admin/withdrawals', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, u.username, u.phone FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       ORDER BY CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END, w.id DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    withdrawals: rows.map((w) => ({
      id: Number(w.id),
      userId: Number(w.user_id),
      username: String(w.username),
      phone: String(w.phone),
      amount: Number(w.amount),
      upiOrBank: String(w.upi_or_bank),
      accountName: String(w.account_name),
      status: String(w.status),
      adminNote: w.admin_note ? String(w.admin_note) : null,
      createdAt: String(w.created_at),
      reviewedAt: w.reviewed_at ? String(w.reviewed_at) : null,
    })),
  });
});

app.post('/api/admin/withdrawals/:id/review', requireAdmin, (req, res) => {
  const wid = Number(req.params.id);
  const action = req.body?.action;
  const note = String(req.body?.note ?? '').trim() || null;

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: 'Action must be approve or reject.' });
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const w = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(wid) as
      | { id: number; user_id: number; amount: number; status: string }
      | undefined;
    if (!w) {
      db.exec('ROLLBACK');
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }
    if (w.status !== 'pending') {
      db.exec('ROLLBACK');
      res.status(409).json({ error: 'Withdrawal request already reviewed.' });
      return;
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(
      `UPDATE withdrawals SET status = ?, admin_note = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, note, wid);

    // Refund wallet balance if rejected
    if (action === 'reject') {
      db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`).run(w.amount, w.user_id);
    }

    db.exec('COMMIT');
    res.json({ ok: true, status: nextStatus });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to review withdrawal.' });
  }
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({
    paymentQrDataUrl: getSetting('payment_qr_data_url'),
    paymentUpiId: getSetting('payment_upi_id'),
    paymentMerchantName: getSetting('payment_merchant_name'),
    announcementText: getSetting('announcement_text'),
  });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { paymentQrDataUrl, paymentUpiId, paymentMerchantName, announcementText } = req.body ?? {};
  if (typeof paymentQrDataUrl === 'string' && paymentQrDataUrl.startsWith('data:image/')) {
    setSetting('payment_qr_data_url', paymentQrDataUrl);
  }
  if (typeof paymentUpiId === 'string' && paymentUpiId.trim()) {
    setSetting('payment_upi_id', paymentUpiId.trim());
  }
  if (typeof paymentMerchantName === 'string' && paymentMerchantName.trim()) {
    setSetting('payment_merchant_name', paymentMerchantName.trim());
  }
  if (typeof announcementText === 'string' && announcementText.trim()) {
    setSetting('announcement_text', announcementText.trim());
  }
  res.json({
    ok: true,
    paymentQrDataUrl: getSetting('payment_qr_data_url'),
    paymentUpiId: getSetting('payment_upi_id'),
    paymentMerchantName: getSetting('payment_merchant_name'),
    announcementText: getSetting('announcement_text'),
  });
});

// ---------- ADMIN CUSTOMER SUPPORT ROUTES ----------

app.get('/api/admin/support/threads', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id as user_id, u.username, u.phone,
        (SELECT m2.message FROM support_messages m2 WHERE m2.user_id = u.id ORDER BY m2.id DESC LIMIT 1) as last_message,
        (SELECT m2.sender_role FROM support_messages m2 WHERE m2.user_id = u.id ORDER BY m2.id DESC LIMIT 1) as last_sender_role,
        (SELECT m2.created_at FROM support_messages m2 WHERE m2.user_id = u.id ORDER BY m2.id DESC LIMIT 1) as updated_at,
        (SELECT COUNT(*) FROM support_messages m3 WHERE m3.user_id = u.id AND m3.sender_role = 'player' AND m3.is_read_by_admin = 0) as unread_count
       FROM users u
       WHERE EXISTS (SELECT 1 FROM support_messages sm WHERE sm.user_id = u.id)
       ORDER BY (SELECT MAX(m4.id) FROM support_messages m4 WHERE m4.user_id = u.id) DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    threads: rows.map((r) => ({
      userId: Number(r.user_id),
      username: String(r.username),
      phone: String(r.phone),
      lastMessage: String(r.last_message ?? ''),
      lastSenderRole: r.last_sender_role === 'admin' ? 'admin' : 'player',
      unreadCount: Number(r.unread_count ?? 0),
      updatedAt: String(r.updated_at ?? ''),
    })),
  });
});

app.get('/api/admin/support/threads/:userId', requireAdmin, (req, res) => {
  const uid = Number(req.params.userId);
  db.prepare(`UPDATE support_messages SET is_read_by_admin = 1 WHERE user_id = ? AND sender_role = 'player'`).run(uid);
  const rows = db
    .prepare(`SELECT * FROM support_messages WHERE user_id = ? ORDER BY id ASC LIMIT 200`)
    .all(uid) as Record<string, unknown>[];
  res.json({ messages: rows.map(mapSupportRow) });
});

app.post('/api/admin/support/threads/:userId/reply', requireAdmin, (req, res) => {
  const uid = Number(req.params.userId);
  const cleanMsg = String(req.body?.message ?? '').trim();
  if (!cleanMsg || cleanMsg.length > 1000) {
    res.status(400).json({ error: 'Reply must be between 1 and 1000 characters.' });
    return;
  }

  const targetUser = db.prepare(`SELECT id FROM users WHERE id = ?`).get(uid) as { id: number } | undefined;
  if (!targetUser) {
    res.status(404).json({ error: 'Player not found.' });
    return;
  }

  db.prepare(`UPDATE support_messages SET is_read_by_admin = 1 WHERE user_id = ? AND sender_role = 'player'`).run(uid);
  const ins = db
    .prepare(
      `INSERT INTO support_messages (user_id, sender_role, message, is_read_by_admin)
       VALUES (?, 'admin', ?, 1)`
    )
    .run(uid, cleanMsg);

  const row = db.prepare(`SELECT * FROM support_messages WHERE id = ?`).get(ins.lastInsertRowid) as Record<
    string,
    unknown
  >;
  res.status(201).json({ message: mapSupportRow(row) });
});

// ---------- VITE / STATIC MOUNT ----------

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`RANWIN server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
