import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, QrCode, Wallet } from 'lucide-react';
import { api, getStoredToken } from '../lib/api';
import { MIN_DEPOSIT_AMOUNT, MIN_WITHDRAW_AMOUNT } from '../game/rules';
import type { DepositRequest, PaymentSettings, User, WithdrawRequest } from '../types';

interface WalletViewProps {
  user: User | null;
  initialTab?: 'deposit' | 'withdraw';
  initialDepositAmount?: number | null;
  onBalanceChange: (newBalance: number) => void;
  onRequireAuth: () => void;
}

const DEPOSIT_PRESETS = [90, 200, 500, 1000, 5000, 10000];

export function WalletView({
  user,
  initialTab = 'deposit',
  initialDepositAmount = null,
  onBalanceChange,
  onRequireAuth,
}: WalletViewProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);

  // Deposit form
  const [depAmount, setDepAmount] = useState(String(initialDepositAmount ?? 200));
  const [utr, setUtr] = useState('');
  const [depSubmitting, setDepSubmitting] = useState(false);

  // Withdraw form
  const [wdAmount, setWdAmount] = useState('500');
  const [accountName, setAccountName] = useState('');
  const [upiOrBank, setUpiOrBank] = useState('');
  const [wdSubmitting, setWdSubmitting] = useState(false);

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialDepositAmount && initialDepositAmount >= MIN_DEPOSIT_AMOUNT) {
      setDepAmount(String(initialDepositAmount));
    }
  }, [initialDepositAmount]);

  const loadWallet = useCallback(async () => {
    if (!user || !getStoredToken()) return;
    try {
      const data = await api.getWalletInfo();
      onBalanceChange(data.balance);
      setSettings(data.paymentSettings);
      setDeposits(data.deposits);
      setWithdrawals(data.withdrawals);
    } catch {
      // ignore
    }
  }, [user, onBalanceChange]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-8">
          <Wallet className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-white mt-3">Wallet &amp; QR Payments</h1>
          <p className="text-sm text-purple-200/80 mt-2">
            Sign in to view the official payment QR code, submit deposit UTRs, and request withdrawals.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-5 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm cursor-pointer"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  function handleCopyUpi() {
    if (!settings?.paymentUpiId) return;
    navigator.clipboard?.writeText(settings.paymentUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleDepositSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setDepSubmitting(true);
    try {
      await api.requestDeposit(Number(depAmount), utr);
      setUtr('');
      setFeedback({
        type: 'success',
        text: 'Deposit request submitted! Payment verification will credit your wallet shortly.',
      });
      loadWallet();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Deposit submission failed.' });
    } finally {
      setDepSubmitting(false);
    }
  }

  async function handleWithdrawSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setWdSubmitting(true);
    try {
      const res = await api.requestWithdraw(Number(wdAmount), upiOrBank, accountName);
      onBalanceChange(res.balance);
      setFeedback({
        type: 'success',
        text: 'Withdrawal request submitted! Amount reserved from wallet pending payout transfer.',
      });
      loadWallet();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Withdrawal failed.' });
    } finally {
      setWdSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10 space-y-6">
      {/* Header Balance Card */}
      <div className="bg-gradient-to-r from-[#3B1E7A] via-[#5B21B6] to-[#7C3AED] text-white rounded-2xl border border-purple-400/30 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-purple-100/85">Available Balance</p>
          <p className="font-mono-num text-3xl font-bold mt-1">₹{user.balance.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2 bg-[#140B29]/50 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTab('deposit');
              setFeedback(null);
            }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'deposit' ? 'bg-amber-500 text-slate-950' : 'text-white hover:bg-white/10'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            Deposit
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('withdraw');
              setFeedback(null);
            }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'withdraw' ? 'bg-amber-500 text-slate-950' : 'text-white hover:bg-white/10'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Withdraw
          </button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form + Official Payment QR */}
        <div className="lg:col-span-6 bg-[#1F133D] rounded-2xl border border-purple-700/50 p-6">
          {tab === 'deposit' ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Scan QR &amp; Deposit</h2>
                <p className="text-xs text-purple-200/75 mt-1">
                  Pay using any UPI app (GPay, PhonePe, Paytm) via the QR code below (Min ₹{MIN_DEPOSIT_AMOUNT}), then submit your 12-digit UTR reference.
                </p>
              </div>

              {/* Official Payment QR Display */}
              <div className="rounded-2xl border border-purple-700/60 bg-[#160D2E] p-5 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-44 h-44 rounded-xl bg-white border border-purple-300 p-2 flex items-center justify-center shrink-0 overflow-hidden">
                  {settings?.paymentQrDataUrl ? (
                    <img
                      src={settings.paymentQrDataUrl}
                      alt="Official Payment QR Code"
                      data-testid="deposit-qr-image"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <QrCode className="w-16 h-16 text-slate-400" />
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left min-w-0">
                  <p className="text-xs font-semibold text-amber-300">
                    {settings?.paymentMerchantName || 'RANWIN Verified Merchant'}
                  </p>
                  <p className="font-mono-num text-sm font-bold text-white break-all">
                    {settings?.paymentUpiId || 'ranwin.pay@okicici'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B1B54] border border-purple-600/60 hover:bg-purple-800 text-xs font-semibold text-purple-100 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'UPI Copied' : 'Copy UPI ID'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleDepositSubmit} className="space-y-4">
                <div>
                  <label htmlFor="deposit-amount" className="block text-xs font-semibold text-purple-200 mb-1.5">
                    Deposit Amount (Min ₹{MIN_DEPOSIT_AMOUNT})
                  </label>
                  <input
                    id="deposit-amount"
                    type="number"
                    min={MIN_DEPOSIT_AMOUNT}
                    max={500000}
                    required
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white font-mono-num text-sm font-bold focus:outline-none focus:border-violet-400"
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
                    {DEPOSIT_PRESETS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepAmount(String(amt))}
                        className={`h-8 rounded-lg font-mono-num text-xs font-semibold transition-colors cursor-pointer ${
                          Number(depAmount) === amt
                            ? 'bg-violet-600 text-white'
                            : 'bg-[#2B1B54] text-purple-100 hover:bg-purple-800'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="deposit-utr" className="block text-xs font-semibold text-purple-200 mb-1.5">
                    UTR / Transaction Reference Number
                  </label>
                  <input
                    id="deposit-utr"
                    type="text"
                    required
                    minLength={6}
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="e.g. 432198765432"
                    className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 font-mono-num text-sm focus:outline-none focus:border-violet-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depSubmitting}
                  className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {depSubmitting ? 'Submitting...' : 'Submit Deposit Request'}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Request Withdrawal</h2>
                <p className="text-xs text-purple-200/75 mt-1">
                  Minimum withdrawal is ₹{MIN_WITHDRAW_AMOUNT}. Funds are reserved immediately and transferred upon payout verification.
                </p>
              </div>

              <div>
                <label htmlFor="withdraw-amount" className="block text-xs font-semibold text-purple-200 mb-1.5">
                  Withdrawal Amount (Min ₹{MIN_WITHDRAW_AMOUNT})
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min={MIN_WITHDRAW_AMOUNT}
                  max={200000}
                  required
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white font-mono-num text-sm font-bold focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label htmlFor="withdraw-name" className="block text-xs font-semibold text-purple-200 mb-1.5">
                  Account Holder Name
                </label>
                <input
                  id="withdraw-name"
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Name on bank / UPI account"
                  className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label htmlFor="withdraw-dest" className="block text-xs font-semibold text-purple-200 mb-1.5">
                  UPI ID or Bank Account &amp; IFSC
                </label>
                <input
                  id="withdraw-dest"
                  type="text"
                  required
                  value={upiOrBank}
                  onChange={(e) => setUpiOrBank(e.target.value)}
                  placeholder="e.g. name@okaxis or Acc 1234567890 / HDFC0001234"
                  className="w-full h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-400/50 text-sm focus:outline-none focus:border-violet-400"
                />
              </div>

              <button
                type="submit"
                disabled={wdSubmitting}
                className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {wdSubmitting ? 'Processing...' : 'Submit Withdrawal Request'}
              </button>
            </form>
          )}
        </div>

        {/* Right Transaction Ledger */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">Deposit Requests</h3>
              <span className="text-xs text-purple-300/75 font-mono-num">{deposits.length} records</span>
            </div>
            <div className="divide-y divide-purple-800/40">
              {deposits.length === 0 ? (
                <p className="p-6 text-sm text-purple-300/70 text-center">No deposit requests yet.</p>
              ) : (
                deposits.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono-num font-bold text-white">₹{d.amount.toFixed(2)}</p>
                      <p className="text-purple-300/75 font-mono-num mt-0.5">UTR: {d.utr}</p>
                    </div>
                    <span
                      className={`font-semibold uppercase text-[11px] ${
                        d.status === 'approved'
                          ? 'text-emerald-400'
                          : d.status === 'rejected'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-purple-800/60 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">Withdrawal Requests</h3>
              <span className="text-xs text-purple-300/75 font-mono-num">{withdrawals.length} records</span>
            </div>
            <div className="divide-y divide-purple-800/40">
              {withdrawals.length === 0 ? (
                <p className="p-6 text-sm text-purple-300/70 text-center">No withdrawal requests yet.</p>
              ) : (
                withdrawals.map((w) => (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono-num font-bold text-white">₹{w.amount.toFixed(2)}</p>
                      <p className="text-purple-300/75 mt-0.5">{w.upiOrBank}</p>
                    </div>
                    <span
                      className={`font-semibold uppercase text-[11px] ${
                        w.status === 'approved'
                          ? 'text-emerald-400'
                          : w.status === 'rejected'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
