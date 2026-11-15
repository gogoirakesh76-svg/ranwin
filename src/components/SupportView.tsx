import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Headphones, Send } from 'lucide-react';
import { api } from '../lib/api';
import type { SupportMessage, User } from '../types';

interface SupportViewProps {
  user: User | null;
  onBack: () => void;
  onRequireAuth: () => void;
}

const QUICK_TOPICS = [
  'Deposit UTR Help',
  'Withdrawal Status',
  'VIP Bonus Query',
];

export function SupportView({ user, onBack, onRequireAuth }: SupportViewProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getSupportMessages();
      setMessages(res.messages);
    } catch {
      // ignore transient poll errors
    }
  }, [user]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 3000);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function submitMessage(text: string) {
    if (!user) {
      onRequireAuth();
      return;
    }
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendSupportMessage(clean);
      setMessages((prev) => [...prev, res.message]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    submitMessage(draft);
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-8 shadow-xl">
          <Headphones className="w-10 h-10 text-amber-300 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-white mt-3">Customer Service</h1>
          <p className="text-sm text-purple-200/80 mt-2">
            Sign in to chat directly with the RANWIN support desk for deposit, withdrawal, and VIP
            assistance.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-[#2B1B54] text-purple-100 text-sm font-semibold cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10">
      <div className="bg-[#1F133D] rounded-2xl border border-purple-700/50 overflow-hidden shadow-xl flex flex-col h-[76vh] min-h-[480px]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#160D2E] border-b border-purple-800/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Account"
              className="p-2 rounded-xl bg-[#2B1B54] hover:bg-purple-800 text-purple-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-display text-base font-bold text-white">Customer Service</h1>
                <p className="text-[11px] text-emerald-400 font-medium">
                  RANWIN Support Desk · Replies sync live
                </p>
              </div>
            </div>
          </div>
          <span className="font-mono-num text-xs text-purple-200/75">
            UID {100000 + user.id}
          </span>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#140B29]">
          <div className="flex justify-start">
            <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-[#25154A] border border-purple-700/50 px-4 py-3 text-xs sm:text-sm text-purple-100">
              <p className="font-bold text-amber-300 text-[11px] mb-1">RANWIN Support</p>
              <p>
                Hello {user.username}! Share your deposit UTR, withdrawal request, or VIP query
                below and our team will reply right here.
              </p>
            </div>
          </div>

          {messages.map((m) => {
            const isPlayer = m.senderRole === 'player';
            return (
              <div
                key={m.id}
                className={`flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                    isPlayer
                      ? 'rounded-tr-sm bg-violet-600 text-white'
                      : 'rounded-tl-sm bg-[#25154A] border border-amber-400/40 text-purple-50'
                  }`}
                >
                  {!isPlayer && (
                    <p className="font-bold text-amber-300 text-[11px] mb-1">Admin Support</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className="text-[10px] opacity-70 mt-1 text-right font-mono-num">
                    {m.createdAt}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Quick Topics + Input */}
        <div className="p-4 bg-[#160D2E] border-t border-purple-800/60 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => submitMessage(topic)}
                className="px-2.5 py-1 rounded-lg bg-[#27184B] hover:bg-purple-800 text-[11px] font-semibold text-purple-100 border border-purple-700/50 transition-colors cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-400">
              {error}
            </p>
          )}

          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Support message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your message to customer service..."
              maxLength={1000}
              className="flex-1 h-11 px-4 rounded-xl bg-[#140B29] border border-purple-700/60 text-white placeholder:text-purple-300/50 text-sm focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 shrink-0"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
