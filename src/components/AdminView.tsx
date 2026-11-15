import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  Clock,
  Headphones,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  AdminLiveIntervalSummary,
  AdminOverviewData,
  AdminPlayerRow,
  AdminSupportThread,
  DepositRequest,
  GameInterval,
  PaymentSettings,
  SupportMessage,
  WithdrawRequest,
} from '../types';
import { WinGoBall } from './WinGoBall';

type AdminTab =
  | 'overview'
  | 'results'
  | 'players'
  | 'deposits'
  | 'withdrawals'
  | 'support'
  | 'settings';

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('results');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [liveIntervals, setLiveIntervals] = useState<AdminLiveIntervalSummary[]>([]);
  const [players, setPlayers] = useState<AdminPlayerRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [supportThreads, setSupportThreads] = useState<AdminSupportThread[]>([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState<number | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportReply, setSupportReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [settings, setSettings] = useState<PaymentSettings>({
    paymentQrDataUrl: '',
    paymentUpiId: '',
    paymentMerchantName: '',
    announcementText: '',
  });

  const [playerQuery, setPlayerQuery] = useState('');
  const [selectedInterval, setSelectedInterval] = useState<GameInterval>('30s');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadSupportThread = useCallback(async (userId: number) => {
    try {
      const res = await api.getAdminSupportThread(userId);
      setSupportMessages(res.messages);
      setSupportThreads((prev) =>
        prev.map((t) => (t.userId === userId ? { ...t, unreadCount: 0 } : t))
      );
    } catch {
      // ignore
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [ov, live, pl, deps, wds, setRes, supRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminLiveRounds(),
        api.getAdminPlayers(),
        api.getAdminDeposits(),
        api.getAdminWithdrawals(),
        api.getAdminSettings(),
        api.getAdminSupportThreads(),
      ]);
      setOverview(ov);
      setLiveIntervals(live.intervals);
      setPlayers(pl.players);
      setDeposits(deps.deposits);
      setWithdrawals(wds.withdrawals);
      setSettings(setRes);
      setSupportThreads(supRes.threads);
      if (supRes.threads.length > 0 && selectedSupportUserId === null) {
        const firstId = supRes.threads[0].userId;
        setSelectedSupportUserId(firstId);
        loadSupportThread(firstId);
      }
    } catch {
      // ignore transient error
    }
  }, [selectedSupportUserId, loadSupportThread]);

  useEffect(() => {
    loadAll();
    const timer = setInterval(() => {
      api
        .getAdminLiveRounds()
        .then((live) => setLiveIntervals(live.intervals))
        .catch(() => {});
      api
        .getAdminSupportThreads()
        .then((sup) => setSupportThreads(sup.threads))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'support' && selectedSupportUserId !== null) {
      loadSupportThread(selectedSupportUserId);
      const timer = setInterval(() => loadSupportThread(selectedSupportUserId), 3000);
      return () => clearInterval(timer);
    }
  }, [tab, selectedSupportUserId, loadSupportThread]);

  async function handleSetOverride(intervalKey: GameInterval, period: string, forcedNumber: number | null) {
    setFeedback(null);
    try {
      await api.setAdminOverride(intervalKey, period, forcedNumber);
      setFeedback({
        type: 'success',
        text:
          forcedNumber === null
            ? `Period ${period} (${intervalKey}) reset to random RNG.`
            : `Period ${period} (${intervalKey}) locked to result ${forcedNumber}.`,
      });
      const live = await api.getAdminLiveRounds();
      setLiveIntervals(live.intervals);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Override failed.' });
    }
  }

  async function handleDepositReview(id: number, action: 'approve' | 'reject') {
    setFeedback(null);
    try {
      await api.reviewDeposit(id, action);
      setFeedback({ type: 'success', text: `Deposit #${id} ${action}d.` });
      loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
    }
  }

  async function handleWithdrawalReview(id: number, action: 'approve' | 'reject') {
    setFeedback(null);
    try {
      await api.reviewWithdrawal(id, action);
      setFeedback({ type: 'success', text: `Withdrawal #${id} ${action}d.` });
      loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
    }
  }

  async function handleAdjustBalance(playerId: number, delta: number) {
    setFeedback(null);
    try {
      await api.adjustAdminPlayer(playerId, { deltaBalance: delta });
      setFeedback({ type: 'success', text: `Adjusted player #${playerId} balance by ₹${delta}.` });
      loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Adjustment failed.' });
    }
  }

  async function handleToggleBan(player: AdminPlayerRow) {
    setFeedback(null);
    try {
      const nextStatus = player.status === 'active' ? 'banned' : 'active';
      await api.adjustAdminPlayer(player.id, { status: nextStatus });
      setFeedback({ type: 'success', text: `${player.username} is now ${nextStatus}.` });
      loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Status update failed.' });
    }
  }

  function handleQrUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'QR image must be smaller than 4 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSettings((prev) => ({ ...prev, paymentQrDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const saved = await api.saveAdminSettings(settings);
      setSettings(saved);
      setFeedback({ type: 'success', text: 'Payment QR & site settings saved.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSendSupportReply(e: FormEvent) {
    e.preventDefault();
    if (selectedSupportUserId === null || !supportReply.trim() || sendingReply) return;
    setSendingReply(true);
    setFeedback(null);
    try {
      const res = await api.replyAdminSupportThread(selectedSupportUserId, supportReply.trim());
      setSupportMessages((prev) => [...prev, res.message]);
      setSupportReply('');
      const supRes = await api.getAdminSupportThreads();
      setSupportThreads(supRes.threads);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Reply failed.' });
    } finally {
      setSendingReply(false);
    }
  }

  const activeIntervalData = liveIntervals.find((i) => i.interval === selectedInterval);
  const filteredPlayers = players.filter(
    (p) =>
      p.username.toLowerCase().includes(playerQuery.toLowerCase()) ||
      p.phone.includes(playerQuery) ||
      p.email.toLowerCase().includes(playerQuery.toLowerCase())
  );
  const totalUnreadSupport = supportThreads.reduce((acc, t) => acc + t.unreadCount, 0);
  const activeSupportThread = supportThreads.find((t) => t.userId === selectedSupportUserId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Admin Control Console</h1>
          <p className="text-xs text-purple-200/75 mt-0.5">
            Monitor player earnings, control live WinGo results, verify QR deposits &amp; reply to customer support
          </p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F133D] border border-purple-700/60 hover:bg-purple-900/60 text-xs font-semibold text-purple-100 w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Data
        </button>
      </div>

      {/* KPI Strip */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4">
            <p className="text-xs text-purple-200/75">Registered Players</p>
            <p className="font-mono-num text-2xl font-bold text-white mt-1">{overview.totalPlayers}</p>
          </div>
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4">
            <p className="text-xs text-purple-200/75">Approved Deposits</p>
            <p className="font-mono-num text-2xl font-bold text-emerald-400 mt-1">
              ₹{overview.totalDeposited.toFixed(2)}
            </p>
            <p className="text-[11px] text-amber-300 mt-0.5 font-medium">
              {overview.pendingDepositsCount} pending approval
            </p>
          </div>
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4">
            <p className="text-xs text-purple-200/75">Approved Withdrawals</p>
            <p className="font-mono-num text-2xl font-bold text-rose-400 mt-1">
              ₹{overview.totalWithdrawn.toFixed(2)}
            </p>
            <p className="text-[11px] text-amber-300 mt-0.5 font-medium">
              {overview.pendingWithdrawsCount} pending payout
            </p>
          </div>
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-4">
            <p className="text-xs text-purple-200/75">House Net P&amp;L</p>
            <p
              className={`font-mono-num text-2xl font-bold mt-1 ${
                overview.houseProfit >= 0 ? 'text-amber-300' : 'text-rose-400'
              }`}
            >
              ₹{overview.houseProfit.toFixed(2)}
            </p>
            <p className="text-[11px] text-purple-300/70 mt-0.5 font-mono-num">
              Vol ₹{overview.totalWagered.toFixed(0)}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#1F133D] p-1.5 rounded-2xl border border-purple-700/50">
        {[
          { id: 'results', label: 'Result Control', icon: Sliders },
          { id: 'players', label: `Players (${players.length})`, icon: Users },
          {
            id: 'deposits',
            label: `Deposits (${deposits.filter((d) => d.status === 'pending').length})`,
            icon: Wallet,
          },
          {
            id: 'withdrawals',
            label: `Withdrawals (${withdrawals.filter((w) => w.status === 'pending').length})`,
            icon: ShieldAlert,
          },
          {
            id: 'support',
            label: totalUnreadSupport > 0 ? `Customer Support (${totalUnreadSupport})` : 'Customer Support',
            icon: Headphones,
          },
          { id: 'settings', label: 'Payment QR & Settings', icon: QrCode },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id as AdminTab);
                setFeedback(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'bg-violet-600 text-white' : 'text-purple-200/80 hover:bg-purple-900/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB: LIVE RESULT CONTROL */}
      {tab === 'results' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {liveIntervals.map((item) => {
              const isSelected = item.interval === selectedInterval;
              return (
                <button
                  key={item.interval}
                  type="button"
                  onClick={() => setSelectedInterval(item.interval)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-violet-700 text-white border-purple-400/60'
                      : 'bg-[#1F133D] text-purple-100 border-purple-700/50 hover:border-violet-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{item.label}</span>
                    <Clock className="w-3.5 h-3.5 opacity-75" />
                  </div>
                  <p className="font-mono-num text-xl font-bold mt-1.5">
                    {String(Math.floor(item.timeRemainingSec / 60)).padStart(2, '0')}:
                    {String(item.timeRemainingSec % 60).padStart(2, '0')}
                  </p>
                  <p className="font-mono-num text-[11px] opacity-75 mt-0.5 truncate">
                    {item.activeRound.period}
                  </p>
                </button>
              );
            })}
          </div>

          {activeIntervalData && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-[#1F133D] rounded-2xl border border-purple-700/50 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-purple-800/50">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">
                      Set Result — {activeIntervalData.label}
                    </h2>
                    <p className="font-mono-num text-xs text-purple-200/75 mt-0.5">
                      Live Period: {activeIntervalData.activeRound.period} · Mode:{' '}
                      <strong className="text-amber-300">
                        {activeIntervalData.activeRound.adminOverride !== null &&
                        activeIntervalData.activeRound.adminOverride !== undefined
                          ? `FORCED → ${activeIntervalData.activeRound.adminOverride}`
                          : 'Random RNG'}
                      </strong>
                    </p>
                  </div>
                  {activeIntervalData.activeRound.adminOverride !== null &&
                    activeIntervalData.activeRound.adminOverride !== undefined && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSetOverride(
                            activeIntervalData.interval,
                            activeIntervalData.activeRound.period,
                            null
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#2B1B54] hover:bg-purple-800 text-xs font-semibold text-purple-100 cursor-pointer"
                      >
                        Reset to Random
                      </button>
                    )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-purple-200 mb-2.5">
                    Click any digit (0–9) to force the outcome for active period{' '}
                    <span className="font-mono-num text-amber-300">{activeIntervalData.activeRound.period}</span>:
                  </p>
                  <div className="grid grid-cols-5 gap-2.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                      const isForced = activeIntervalData.activeRound.adminOverride === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            handleSetOverride(
                              activeIntervalData.interval,
                              activeIntervalData.activeRound.period,
                              d
                            )
                          }
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            isForced
                              ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50'
                              : 'border-purple-700/60 hover:border-violet-400 bg-[#160D2E]'
                          }`}
                        >
                          <WinGoBall digit={d} size="md" />
                          <span className="font-mono-num text-[11px] text-purple-200/80">
                            Bet ₹{activeIntervalData.exposure.numbers[d].toFixed(0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-purple-200">Live Round Bet Exposure</span>
                    <span className="font-mono-num text-xs font-bold text-white">
                      Total Pool: ₹{activeIntervalData.exposure.totalPool.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: 'Green', val: activeIntervalData.exposure.Green, cls: 'text-emerald-300 bg-emerald-950/50 border border-emerald-700/40' },
                      { label: 'Violet', val: activeIntervalData.exposure.Violet, cls: 'text-violet-300 bg-violet-950/50 border border-violet-700/40' },
                      { label: 'Red', val: activeIntervalData.exposure.Red, cls: 'text-rose-300 bg-rose-950/50 border border-rose-700/40' },
                      { label: 'Big', val: activeIntervalData.exposure.Big, cls: 'text-amber-300 bg-amber-950/50 border border-amber-700/40' },
                      { label: 'Small', val: activeIntervalData.exposure.Small, cls: 'text-sky-300 bg-sky-950/50 border border-sky-700/40' },
                    ].map((ex) => (
                      <div key={ex.label} className={`p-2.5 rounded-xl ${ex.cls}`}>
                        <p className="text-[11px] font-semibold">{ex.label}</p>
                        <p className="font-mono-num text-xs font-bold mt-0.5">₹{ex.val.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5">
                  <h3 className="font-display text-base font-bold text-white">
                    Pre-Set Upcoming Periods
                  </h3>
                  <p className="text-xs text-purple-200/75 mt-0.5 mb-3">
                    Optionally lock outcomes for the next 5 rounds in advance
                  </p>
                  <div className="divide-y divide-purple-800/40">
                    {activeIntervalData.upcomingPeriods.map((up) => (
                      <div key={up.period} className="py-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono-num text-xs font-semibold text-purple-100">
                          {up.period}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Force result for period ${up.period}`}
                            value={up.forcedNumber === null ? '' : String(up.forcedNumber)}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleSetOverride(
                                activeIntervalData.interval,
                                up.period,
                                val === '' ? null : Number(val)
                              );
                            }}
                            className="h-8 px-2 rounded-lg border border-purple-600/60 text-xs font-mono-num bg-[#140B29] text-white"
                          >
                            <option value="">Random</option>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                              <option key={d} value={d}>
                                {d} ({d >= 5 ? 'Big' : 'Small'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5">
                  <h3 className="font-display text-base font-bold text-white mb-3">Recent Settled</h3>
                  <div className="space-y-2">
                    {activeIntervalData.recentRounds.map((r) => (
                      <div key={r.period} className="flex items-center justify-between text-xs">
                        <span className="font-mono-num text-purple-200">{r.period}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-purple-300/70">
                            {r.isOverridden ? 'Admin' : 'RNG'}
                          </span>
                          <WinGoBall digit={r.resultNumber ?? 0} size="xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PLAYERS DIRECTORY */}
      {tab === 'players' && (
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
          <div className="p-4 border-b border-purple-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">Registered Players &amp; Earnings</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-purple-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="Search name, phone, email..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#160D2E] border-b border-purple-800/60 text-purple-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-right">Deposited</th>
                  <th className="py-3 px-4 text-right">Withdrawn</th>
                  <th className="py-3 px-4 text-right">Wagered</th>
                  <th className="py-3 px-4 text-right">Total Won</th>
                  <th className="py-3 px-4 text-right">Net P&amp;L</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-800/40">
                {filteredPlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-purple-900/30">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">
                        {p.username} {p.role === 'admin' ? '(Admin)' : ''}
                      </p>
                      <p className="text-purple-300/75 font-mono-num">
                        {p.phone} · {p.email}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-white">
                      ₹{p.balance.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-emerald-400">
                      ₹{p.totalDeposited.toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-rose-400">
                      ₹{p.totalWithdrawn.toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-purple-200">
                      ₹{p.totalWagered.toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-amber-300 font-semibold">
                      ₹{p.totalWon.toFixed(0)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-bold ${
                        p.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {p.netProfit >= 0 ? `+₹${p.netProfit.toFixed(0)}` : `-₹${Math.abs(p.netProfit).toFixed(0)}`}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustBalance(p.id, 500)}
                        className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold cursor-pointer"
                      >
                        +₹500
                      </button>
                      {p.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleBan(p)}
                          className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                            p.status === 'active'
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300'
                              : 'bg-purple-800 text-purple-100'
                          }`}
                        >
                          {p.status === 'active' ? 'Ban' : 'Unban'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: DEPOSIT REQUESTS */}
      {tab === 'deposits' && (
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
          <div className="p-4 border-b border-purple-800/60">
            <h2 className="font-display text-lg font-bold text-white">Player Deposit Requests</h2>
          </div>
          <div className="divide-y divide-purple-800/40">
            {deposits.length === 0 ? (
              <p className="p-8 text-center text-sm text-purple-300/75">No deposit requests found.</p>
            ) : (
              deposits.map((d) => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {d.username} ({d.phone}) ·{' '}
                      <span className="font-mono-num text-emerald-400">₹{d.amount.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-purple-300/75 font-mono-num mt-0.5">
                      UTR: {d.utr} · {d.createdAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDepositReview(d.id, 'approve')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDepositReview(d.id, 'reject')}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs font-bold uppercase ${
                          d.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: WITHDRAWAL REQUESTS */}
      {tab === 'withdrawals' && (
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
          <div className="p-4 border-b border-purple-800/60">
            <h2 className="font-display text-lg font-bold text-white">Player Withdrawal Requests</h2>
          </div>
          <div className="divide-y divide-purple-800/40">
            {withdrawals.length === 0 ? (
              <p className="p-8 text-center text-sm text-purple-300/75">No withdrawal requests found.</p>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {w.username} ({w.phone}) ·{' '}
                      <span className="font-mono-num text-rose-400">₹{w.amount.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-purple-200/80 mt-0.5">
                      Account: {w.accountName} · <span className="font-mono-num">{w.upiOrBank}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleWithdrawalReview(w.id, 'approve')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWithdrawalReview(w.id, 'reject')}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject &amp; Refund
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs font-bold uppercase ${
                          w.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {w.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: CUSTOMER SUPPORT INBOX & REPLY */}
      {tab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: Player Support Threads */}
          <div className="lg:col-span-4 bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-purple-800/60 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">Support Threads</h2>
              <span className="text-xs font-mono-num text-purple-300/80">{supportThreads.length}</span>
            </div>
            <div className="divide-y divide-purple-800/40 max-h-[460px] overflow-y-auto">
              {supportThreads.length === 0 ? (
                <p className="p-8 text-center text-xs text-purple-300/75">
                  No customer service inquiries yet.
                </p>
              ) : (
                supportThreads.map((t) => {
                  const selected = t.userId === selectedSupportUserId;
                  return (
                    <button
                      key={t.userId}
                      type="button"
                      onClick={() => {
                        setSelectedSupportUserId(t.userId);
                        loadSupportThread(t.userId);
                      }}
                      className={`w-full p-4 text-left transition-colors cursor-pointer ${
                        selected ? 'bg-violet-800/60' : 'hover:bg-purple-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white truncate">{t.username}</span>
                        {t.unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono-num text-[10px] font-black">
                            {t.unreadCount} new
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono-num text-purple-300/75 mt-0.5">{t.phone}</p>
                      <p className="text-xs text-purple-100/85 mt-1.5 truncate">{t.lastMessage}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Conversation & Admin Reply Box */}
          <div className="lg:col-span-8 bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden flex flex-col min-h-[460px]">
            {!activeSupportThread ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-purple-300/75">
                <Headphones className="w-10 h-10 text-amber-300/60 mb-2" />
                <p className="text-sm font-medium">
                  Select a player thread on the left to read messages and send a reply.
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3.5 bg-[#160D2E] border-b border-purple-800/60 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      {activeSupportThread.username}
                    </h3>
                    <p className="text-xs font-mono-num text-purple-300/75">
                      UID {100000 + activeSupportThread.userId} · {activeSupportThread.phone}
                    </p>
                  </div>
                </div>

                <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[340px] bg-[#140B29]">
                  {supportMessages.map((m) => {
                    const isAdmin = m.senderRole === 'admin';
                    return (
                      <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm ${
                            isAdmin
                              ? 'rounded-tr-sm bg-violet-600 text-white'
                              : 'rounded-tl-sm bg-[#25154A] border border-purple-700/50 text-purple-50'
                          }`}
                        >
                          <p className="font-bold text-[10px] uppercase tracking-wider opacity-80 mb-0.5">
                            {isAdmin ? 'Admin Reply' : activeSupportThread.username}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          <p className="text-[10px] opacity-65 mt-1 text-right font-mono-num">
                            {m.createdAt}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleSendSupportReply}
                  className="p-4 bg-[#160D2E] border-t border-purple-800/60 flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="Reply to player"
                    value={supportReply}
                    onChange={(e) => setSupportReply(e.target.value)}
                    placeholder={`Reply to ${activeSupportThread.username}...`}
                    maxLength={1000}
                    className="flex-1 h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-300/50 text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !supportReply.trim()}
                    className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send Reply
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: PAYMENT QR & SETTINGS */}
      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-2xl bg-[#160D2E] border border-purple-700/50">
            <p className="text-xs font-semibold text-purple-200 mb-3">Live Deposit QR Preview</p>
            <div className="w-52 h-52 rounded-xl bg-white border border-purple-300 p-2 flex items-center justify-center overflow-hidden">
              {settings.paymentQrDataUrl ? (
                <img
                  src={settings.paymentQrDataUrl}
                  alt="Admin Payment QR Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-16 h-16 text-slate-400" />
              )}
            </div>
            <label className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload Custom QR Image
              <input type="file" accept="image/*" onChange={handleQrUpload} className="sr-only" />
            </label>
            <p className="text-[11px] text-purple-300/75 mt-2 text-center">
              Supports PNG, JPG, SVG, WebP. Shown to all players on the Deposit screen.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Payment &amp; Platform Settings</h2>

            <div>
              <label htmlFor="admin-upi" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Official UPI ID
              </label>
              <input
                id="admin-upi"
                type="text"
                required
                value={settings.paymentUpiId}
                onChange={(e) => setSettings((s) => ({ ...s, paymentUpiId: e.target.value }))}
                className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white font-mono-num text-sm focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="admin-merchant" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Merchant Display Name
              </label>
              <input
                id="admin-merchant"
                type="text"
                required
                value={settings.paymentMerchantName}
                onChange={(e) => setSettings((s) => ({ ...s, paymentMerchantName: e.target.value }))}
                className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white text-sm focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="admin-announcement" className="block text-xs font-semibold text-purple-200 mb-1.5">
                Site Announcement Banner
              </label>
              <textarea
                id="admin-announcement"
                rows={3}
                value={settings.announcementText}
                onChange={(e) => setSettings((s) => ({ ...s, announcementText: e.target.value }))}
                className="w-full p-3.5 rounded-xl bg-[#140B29] border border-purple-700/60 text-white text-sm focus:outline-none focus:border-violet-400"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save QR & Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
