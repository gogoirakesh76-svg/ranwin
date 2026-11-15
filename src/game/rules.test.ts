import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_PERIOD,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  INTERLEAVED_WIN_CYCLE,
  incrementPeriod,
  getNumberProperties,
  calculateBetAmount,
  calculateWinGoPayout,
  computeTrendStats,
  calculateVortexPayout,
  calculateChickenPayout,
  calculateAviatorMultiplierAtElapsed,
  calculateAviatorPayout,
  calculateMinesMultiplier,
  calculateMinesPayout,
  calculateFirstDepositBonus,
  calculateReferralCommission,
  getVipLevelForExp,
  VIP_TIERS,
  shouldWinInInterleavedCycle,
  pickDigitForTarget,
  formatCountdown,
} from './rules';

test('period numbering starts at 2026000000001 and increments safely for unlimited rounds', () => {
  assert.equal(INITIAL_PERIOD, '2026000000001');
  assert.equal(incrementPeriod(INITIAL_PERIOD), '2026000000002');
  assert.equal(incrementPeriod(INITIAL_PERIOD, 10), '2026000000011');
  assert.equal(incrementPeriod('2026999999999', 1), '2027000000000');
});

test('digit color and Big/Small classification matches WinGo rules', () => {
  assert.deepEqual(getNumberProperties(0), {
    number: 0,
    size: 'Small',
    colors: ['Red', 'Violet'],
    primaryColor: 'Red',
  });
  assert.deepEqual(getNumberProperties(5), {
    number: 5,
    size: 'Big',
    colors: ['Green', 'Violet'],
    primaryColor: 'Green',
  });
  assert.deepEqual(getNumberProperties(3), {
    number: 3,
    size: 'Small',
    colors: ['Green'],
    primaryColor: 'Green',
  });
  assert.deepEqual(getNumberProperties(8), {
    number: 8,
    size: 'Big',
    colors: ['Red'],
    primaryColor: 'Red',
  });
});

test('WinGo payout calculation handles Green, Red, Violet, split 0/5, exact Number, Big, and Small', () => {
  const { totalAmount, fee, contractAmount } = calculateBetAmount(100, 1, 1);
  assert.equal(totalAmount, 100);
  assert.equal(fee, 2);
  assert.equal(contractAmount, 98);

  // Exact ₹100 -> ₹196 and ₹50 -> ₹98 winning payouts
  assert.deepEqual(calculateWinGoPayout('color', 'Green', 100, 7), { won: true, payout: 196 });
  assert.deepEqual(calculateWinGoPayout('color', 'Green', 50, 7), { won: true, payout: 98 });
  assert.deepEqual(calculateWinGoPayout('size', 'Big', 50, 8), { won: true, payout: 98 });
  // Green wins 1.5x on 5 (split with Violet: 98 * 1.5 = 147)
  assert.deepEqual(calculateWinGoPayout('color', 'Green', 100, 5), { won: true, payout: 147 });
  // Red wins 1.5x on 0 (98 * 1.5 = 147)
  assert.deepEqual(calculateWinGoPayout('color', 'Red', 100, 0), { won: true, payout: 147 });
  // Violet wins 4.5x on 0 or 5 (98 * 4.5 = 441)
  assert.deepEqual(calculateWinGoPayout('color', 'Violet', 100, 0), { won: true, payout: 441 });
  assert.deepEqual(calculateWinGoPayout('color', 'Violet', 100, 2), { won: false, payout: 0 });
  // Exact number wins 9x (98 * 9 = 882)
  assert.deepEqual(calculateWinGoPayout('number', '7', 100, 7), { won: true, payout: 882 });
  // Big/Small wins 2x
  assert.deepEqual(calculateWinGoPayout('size', 'Big', 100, 9), { won: true, payout: 196 });
  assert.deepEqual(calculateWinGoPayout('size', 'Small', 100, 9), { won: false, payout: 0 });
});

test('interleaved 5-win / 3-loss cycle has exact 5:3 ratio and never clumps all losses or 5 wins consecutively', () => {
  assert.equal(INTERLEAVED_WIN_CYCLE.length, 8);
  const wins = INTERLEAVED_WIN_CYCLE.filter(Boolean).length;
  const losses = INTERLEAVED_WIN_CYCLE.filter((x) => !x).length;
  assert.equal(wins, 5);
  assert.equal(losses, 3);

  // Verify interleaving: no 3 consecutive losses and no 5 consecutive wins
  const seq = Array.from({ length: 16 }, (_, i) => shouldWinInInterleavedCycle(i));
  for (let i = 0; i <= seq.length - 3; i++) {
    assert.equal(seq[i] === false && seq[i + 1] === false && seq[i + 2] === false, false);
  }
  for (let i = 0; i <= seq.length - 5; i++) {
    assert.equal(
      seq[i] && seq[i + 1] && seq[i + 2] && seq[i + 3] && seq[i + 4],
      false
    );
  }

  // Verify pickDigitForTarget matches target outcome
  const winBig = pickDigitForTarget('size', 'Big', true, () => 0);
  assert.equal(calculateWinGoPayout('size', 'Big', 100, winBig).won, true);
  const loseGreen = pickDigitForTarget('color', 'Green', false, () => 1);
  assert.equal(calculateWinGoPayout('color', 'Green', 100, loseGreen).won, false);
});

test('limits, first deposit bonuses, and Chicken Road payout match RANWIN spec', () => {
  assert.equal(MIN_DEPOSIT_AMOUNT, 90);
  assert.equal(MIN_WITHDRAW_AMOUNT, 110);

  assert.equal(calculateFirstDepositBonus(1000), 88);
  assert.equal(calculateFirstDepositBonus(500), 58);
  assert.equal(calculateFirstDepositBonus(200), 18);
  assert.equal(calculateFirstDepositBonus(90), 10);
  assert.equal(calculateFirstDepositBonus(50), 0);

  assert.equal(calculateChickenPayout(100, 1.56), 156);

  // VIP Tiers: VIP1 = 3000 EXP -> ₹60 bonus, VIP2 = 10000 EXP -> ₹180 bonus
  assert.equal(VIP_TIERS[0].requiredExp, 3000);
  assert.equal(VIP_TIERS[0].levelUpBonus, 60);
  assert.equal(VIP_TIERS[1].requiredExp, 10000);
  assert.equal(VIP_TIERS[1].levelUpBonus, 180);
  assert.equal(getVipLevelForExp(0), 0);
  assert.equal(getVipLevelForExp(2999), 0);
  assert.equal(getVipLevelForExp(3000), 1);
  assert.equal(getVipLevelForExp(10000), 2);

  // Referral commissions
  assert.equal(calculateReferralCommission(1000, 1), 50);
  assert.equal(calculateReferralCommission(1000, 2), 20);
});

test('Aviator and Mines multiplier math and payouts are accurate', () => {
  assert.equal(calculateAviatorMultiplierAtElapsed(0), 1.0);
  assert.ok(calculateAviatorMultiplierAtElapsed(5000) > 1.5);
  assert.equal(calculateAviatorPayout(100, 2.35), 235);

  assert.equal(calculateMinesMultiplier(3, 0), 1.0);
  assert.equal(calculateMinesMultiplier(3, 1), 1.1);
  assert.equal(calculateMinesMultiplier(3, 2), 1.26);
  assert.equal(calculateMinesMultiplier(3, 3), 1.45);
  assert.equal(calculateMinesPayout(100, 1.45), 145);
});

test('computeTrendStats calculates missing, frequency, and maxConsecutive', () => {
  // Newest first: [2, 7, 3, 3, 9]
  const stats = computeTrendStats([2, 7, 3, 3, 9]);
  assert.equal(stats.missing[2], 0);
  assert.equal(stats.missing[7], 1);
  assert.equal(stats.missing[3], 2);
  assert.equal(stats.frequency[3], 2);
  assert.equal(stats.maxConsecutive[3], 2);
  assert.equal(stats.frequency[0], 0);
  assert.equal(stats.missing[0], 5);
});

test('Vortex payout and countdown formatter work accurately', () => {
  assert.equal(calculateVortexPayout(250, 2.25), 562.5);
  assert.deepEqual(formatCountdown(19), { m1: '0', m2: '0', s1: '1', s2: '9' });
  assert.deepEqual(formatCountdown(600), { m1: '1', m2: '0', s1: '0', s2: '0' });
});
