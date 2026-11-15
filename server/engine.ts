import crypto from 'node:crypto';
import { db, getSetting, setSetting } from './db';
import {
  INTERVAL_CONFIG,
  INTERVAL_LIST,
  calculateWinGoPayout,
  getNumberProperties,
  incrementPeriod,
  pickDigitForTarget,
  shouldWinInInterleavedCycle,
} from '../src/game/rules';
import type { BetType, GameInterval } from '../src/types';

let tickerHandle: NodeJS.Timeout | null = null;

function settleAndAdvanceInterval(intervalKey: GameInterval, now: number): void {
  const durationMs = INTERVAL_CONFIG[intervalKey].durationSec * 1000;

  let safetyLoop = 0;
  while (safetyLoop < 20) {
    safetyLoop++;
    const active = db
      .prepare(
        `SELECT * FROM rounds WHERE interval_key = ? AND settled = 0 ORDER BY id DESC LIMIT 1`
      )
      .get(intervalKey) as
      | {
          id: number;
          period: string;
          admin_override: number | null;
          ends_at: number;
        }
      | undefined;

    if (!active) {
      // Recover if no active round exists
      const last = db
        .prepare(`SELECT period FROM rounds WHERE interval_key = ? ORDER BY id DESC LIMIT 1`)
        .get(intervalKey) as { period: string } | undefined;
      const nextPeriod = last ? incrementPeriod(last.period) : '2026000000001';
      db.prepare(
        `INSERT OR IGNORE INTO rounds (interval_key, period, started_at, ends_at, settled)
         VALUES (?, ?, ?, ?, 0)`
      ).run(intervalKey, nextPeriod, now, now + durationMs);
      break;
    }

    if (now < active.ends_at) {
      break;
    }

    // Check queued period_overrides as well
    const queuedOverride = db
      .prepare(`SELECT forced_number FROM period_overrides WHERE interval_key = ? AND period = ?`)
      .get(intervalKey, active.period) as { forced_number: number } | undefined;

    const chosenOverride =
      active.admin_override !== null && active.admin_override !== undefined
        ? active.admin_override
        : queuedOverride?.forced_number ?? null;

    // Fetch pending bets before choosing digit so non-overridden rounds follow the 5-win / 3-loss interleaved rate
    const pendingBets = db
      .prepare(
        `SELECT id, user_id, bet_type, bet_value, total_amount
         FROM bets
         WHERE interval_key = ? AND period = ? AND status = 'pending'
         ORDER BY total_amount DESC, id DESC`
      )
      .all(intervalKey, active.period) as {
      id: number;
      user_id: number;
      bet_type: BetType;
      bet_value: string;
      total_amount: number;
    }[];

    let resultNumber: number;
    if (chosenOverride !== null && chosenOverride >= 0 && chosenOverride <= 9) {
      resultNumber = chosenOverride;
    } else if (pendingBets.length > 0) {
      const cycleIdx = Number(getSetting('wingo_cycle_index') || '0') || 0;
      const wantWin = shouldWinInInterleavedCycle(cycleIdx);
      const refBet = pendingBets[0];
      resultNumber = pickDigitForTarget(refBet.bet_type, refBet.bet_value, wantWin, (len) =>
        crypto.randomInt(0, len)
      );
      setSetting('wingo_cycle_index', String((cycleIdx + 1) % 8));
    } else {
      resultNumber = crypto.randomInt(0, 10);
    }

    const props = getNumberProperties(resultNumber);
    const wasOverridden = chosenOverride !== null ? 1 : 0;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE rounds
         SET result_number = ?, result_size = ?, result_colors = ?, is_overridden = ?, settled = 1
         WHERE id = ?`
      ).run(resultNumber, props.size, JSON.stringify(props.colors), wasOverridden, active.id);

      // Clean up queued override if used
      if (queuedOverride) {
        db.prepare(`DELETE FROM period_overrides WHERE interval_key = ? AND period = ?`).run(
          intervalKey,
          active.period
        );
      }

      const updateBet = db.prepare(`UPDATE bets SET status = ?, payout = ? WHERE id = ?`);
      const creditUser = db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?`);

      for (const bet of pendingBets) {
        const outcome = calculateWinGoPayout(bet.bet_type, bet.bet_value, bet.total_amount, resultNumber);
        if (outcome.won) {
          updateBet.run('won', outcome.payout, bet.id);
          creditUser.run(outcome.payout, bet.user_id);
        } else {
          updateBet.run('lost', 0, bet.id);
        }
      }

      // Spawn next period continuously
      const nextPeriod = incrementPeriod(active.period);
      const nextOverrideRow = db
        .prepare(`SELECT forced_number FROM period_overrides WHERE interval_key = ? AND period = ?`)
        .get(intervalKey, nextPeriod) as { forced_number: number } | undefined;

      const nextStart = active.ends_at;
      const nextEnd = nextStart + durationMs;

      db.prepare(
        `INSERT OR IGNORE INTO rounds (interval_key, period, admin_override, is_overridden, started_at, ends_at, settled)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ).run(
        intervalKey,
        nextPeriod,
        nextOverrideRow?.forced_number ?? null,
        nextOverrideRow ? 1 : 0,
        nextStart,
        nextEnd
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      console.error(`Failed settling round ${intervalKey} ${active.period}:`, err);
      break;
    }
  }
}

export function tickAllIntervals(): void {
  const now = Date.now();
  for (const intervalKey of INTERVAL_LIST) {
    settleAndAdvanceInterval(intervalKey, now);
  }
}

export function startGameEngine(): void {
  tickAllIntervals();
  if (tickerHandle) clearInterval(tickerHandle);
  tickerHandle = setInterval(() => {
    tickAllIntervals();
  }, 500);
}
