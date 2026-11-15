import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_PERIOD,
  INTERVAL_CONFIG,
  INTERVAL_LIST,
  getNumberProperties,
  incrementPeriod,
} from '../src/game/rules';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, 'jade_trade.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    balance REAL NOT NULL DEFAULT 0,
    invite_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interval_key TEXT NOT NULL,
    period TEXT NOT NULL,
    result_number INTEGER,
    result_size TEXT,
    result_colors TEXT NOT NULL DEFAULT '[]',
    admin_override INTEGER,
    is_overridden INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    settled INTEGER NOT NULL DEFAULT 0,
    UNIQUE(interval_key, period)
  );

  CREATE TABLE IF NOT EXISTS period_overrides (
    interval_key TEXT NOT NULL,
    period TEXT NOT NULL,
    forced_number INTEGER NOT NULL,
    PRIMARY KEY (interval_key, period)
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    interval_key TEXT NOT NULL,
    period TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    bet_value TEXT NOT NULL,
    unit_amount REAL NOT NULL,
    quantity INTEGER NOT NULL,
    multiplier INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    fee REAL NOT NULL,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS vortex_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bet_amount REAL NOT NULL,
    steps_cleared INTEGER NOT NULL DEFAULT 0,
    multiplier REAL NOT NULL DEFAULT 1,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    history_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chicken_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bet_amount REAL NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    current_lane INTEGER NOT NULL DEFAULT 0,
    multiplier REAL NOT NULL DEFAULT 1.0,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    trap_lane INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    utr TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'UPI QR',
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    upi_or_bank TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vip_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    vip_level INTEGER NOT NULL,
    bonus_amount REAL NOT NULL,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, vip_level),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS referral_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    subordinate_id INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    source_amount REAL NOT NULL,
    commission_amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subordinate_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS aviator_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bet_amount REAL NOT NULL,
    crash_multiplier REAL NOT NULL,
    cashout_multiplier REAL,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    started_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mines_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bet_amount REAL NOT NULL,
    mines_count INTEGER NOT NULL DEFAULT 3,
    mine_indices_json TEXT NOT NULL,
    revealed_indices_json TEXT NOT NULL DEFAULT '[]',
    multiplier REAL NOT NULL DEFAULT 1.0,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read_by_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Safe column migration for existing SQLite databases
const userColumns = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
if (!userColumns.some((c) => c.name === 'first_deposit_bonus_claimed')) {
  db.exec(`ALTER TABLE users ADD COLUMN first_deposit_bonus_claimed INTEGER NOT NULL DEFAULT 0`);
}
if (!userColumns.some((c) => c.name === 'referred_by_user_id')) {
  db.exec(`ALTER TABLE users ADD COLUMN referred_by_user_id INTEGER`);
}
if (!userColumns.some((c) => c.name === 'last_login_at')) {
  db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`);
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash: derived, salt: s };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const DEFAULT_QR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
    <rect width="220" height="220" rx="16" fill="#FFFFFF"/>
    <rect x="14" y="14" width="192" height="192" rx="12" fill="none" stroke="#6D28D9" stroke-width="3"/>
    <g fill="#0F172A">
      <rect x="28" y="28" width="44" height="44" rx="6"/>
      <rect x="36" y="36" width="28" height="28" rx="3" fill="#FFFFFF"/>
      <rect x="42" y="42" width="16" height="16" rx="2" fill="#6D28D9"/>
      <rect x="148" y="28" width="44" height="44" rx="6"/>
      <rect x="156" y="36" width="28" height="28" rx="3" fill="#FFFFFF"/>
      <rect x="162" y="42" width="16" height="16" rx="2" fill="#6D28D9"/>
      <rect x="28" y="148" width="44" height="44" rx="6"/>
      <rect x="36" y="156" width="28" height="28" rx="3" fill="#FFFFFF"/>
      <rect x="42" y="162" width="16" height="16" rx="2" fill="#6D28D9"/>
      <rect x="86" y="32" width="10" height="10"/><rect x="104" y="32" width="10" height="10"/><rect x="122" y="32" width="10" height="10"/>
      <rect x="86" y="50" width="18" height="10"/><rect x="114" y="50" width="18" height="10"/>
      <rect x="32" y="86" width="14" height="14"/><rect x="56" y="86" width="18" height="10"/><rect x="86" y="86" width="44" height="44" rx="8" fill="#6D28D9"/>
      <text x="108" y="113" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">UPI</text>
      <rect x="142" y="86" width="16" height="16"/><rect x="168" y="86" width="20" height="12"/>
      <rect x="32" y="114" width="24" height="12"/><rect x="142" y="114" width="12" height="20"/><rect x="166" y="114" width="22" height="16"/>
      <rect x="86" y="146" width="14" height="14"/><rect x="110" y="146" width="24" height="14"/><rect x="148" y="148" width="18" height="18"/><rect x="174" y="148" width="14" height="24"/>
      <rect x="86" y="172" width="32" height="16"/><rect x="128" y="172" width="18" height="16"/><rect x="156" y="176" width="32" height="14"/>
    </g>
  </svg>`
)}`;

export function seedDatabase(): void {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

  if (userCount === 0) {
    const adminPass = hashPassword('admin123');
    db.prepare(
      `INSERT INTO users (username, phone, email, password_hash, salt, role, balance, invite_code)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`
    ).run('Admin Master', '9999999999', 'admin@jadepulse.win', adminPass.hash, adminPass.salt, 100000, 'RWADMIN');

    const playerPass = hashPassword('player123');
    db.prepare(
      `INSERT INTO users (username, phone, email, password_hash, salt, role, balance, invite_code, first_deposit_bonus_claimed)
       VALUES (?, ?, ?, ?, ?, 'player', ?, ?, 0)`
    ).run('Aarav Trader', '9876543210', 'player@jadepulse.win', playerPass.hash, playerPass.salt, 5000, 'RW88421');

    const p2 = hashPassword('player123');
    db.prepare(
      `INSERT INTO users (username, phone, email, password_hash, salt, role, balance, invite_code)
       VALUES (?, ?, ?, ?, ?, 'player', ?, ?)`
    ).run('Rohan Verma', '9811223344', 'rohan@jadepulse.win', p2.hash, p2.salt, 2450, 'RW55109');

    const p3 = hashPassword('player123');
    db.prepare(
      `INSERT INTO users (username, phone, email, password_hash, salt, role, balance, invite_code)
       VALUES (?, ?, ?, ?, ?, 'player', ?, ?)`
    ).run('Neha Sharma', '9765432109', 'neha@jadepulse.win', p3.hash, p3.salt, 8120, 'RW33902');

    // Seed sample deposits & withdrawals for admin visibility
    db.prepare(
      `INSERT INTO deposits (user_id, amount, utr, payment_method, status)
       VALUES (2, 1000, '431988120451', 'UPI QR', 'approved'),
              (3, 500, '431990441822', 'UPI QR', 'pending')`
    ).run();

    db.prepare(
      `INSERT INTO withdrawals (user_id, amount, upi_or_bank, account_name, status)
       VALUES (4, 1500, 'neha.sharma@okaxis', 'Neha Sharma', 'pending')`
    ).run();
  }

  // Default settings
  const defaultSettings: Record<string, string> = {
    payment_qr_data_url: DEFAULT_QR_SVG,
    payment_upi_id: 'ranwin.pay@okicici',
    payment_merchant_name: 'RANWIN Verified Merchant',
    announcement_text:
      'Welcome to RANWIN! Deposit min ₹90 via official QR & claim Extra First Deposit Bonus up to ₹88. WinGo, Vortex & Chicken Road settle 24/7!',
    wingo_cycle_index: '0',
    vortex_cycle_index: '0',
    chicken_cycle_index: '0',
    aviator_cycle_index: '0',
    mines_cycle_index: '0',
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  // Upgrade legacy default copy if unchanged by admin
  const currentMerchant = getSetting('payment_merchant_name');
  if (currentMerchant === 'JadePulse Merchant Services') {
    setSetting('payment_merchant_name', defaultSettings.payment_merchant_name);
  }
  const currentUpi = getSetting('payment_upi_id');
  if (currentUpi === 'jadepulse.pay@okicici') {
    setSetting('payment_upi_id', defaultSettings.payment_upi_id);
  }
  const currentAnn = getSetting('announcement_text');
  if (currentAnn.includes('JadePulse')) {
    setSetting('announcement_text', defaultSettings.announcement_text);
  }

  // Seed initial 10 historical rounds starting at 2026000000001 + live period 2026000000011 for every interval
  const now = Date.now();
  const sampleDigits = [9, 8, 3, 3, 2, 2, 7, 3, 7, 2];

  for (const intervalKey of INTERVAL_LIST) {
    const existingCount = (
      db.prepare('SELECT COUNT(*) as c FROM rounds WHERE interval_key = ?').get(intervalKey) as { c: number }
    ).c;

    if (existingCount === 0) {
      const durationMs = INTERVAL_CONFIG[intervalKey].durationSec * 1000;
      const insertRound = db.prepare(
        `INSERT INTO rounds (interval_key, period, result_number, result_size, result_colors, started_at, ends_at, settled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (let i = 0; i < 10; i++) {
        const period = incrementPeriod(INITIAL_PERIOD, i);
        const digit = sampleDigits[(i + intervalKey.length) % sampleDigits.length];
        const props = getNumberProperties(digit);
        const endsAt = now - (10 - i) * durationMs;
        const startedAt = endsAt - durationMs;

        insertRound.run(
          intervalKey,
          period,
          digit,
          props.size,
          JSON.stringify(props.colors),
          startedAt,
          endsAt,
          1
        );
      }

      // Active round starting from 2026000000011
      const activePeriod = incrementPeriod(INITIAL_PERIOD, 10);
      insertRound.run(
        intervalKey,
        activePeriod,
        null,
        null,
        '[]',
        now,
        now + durationMs,
        0
      );
    }
  }
}

export function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
