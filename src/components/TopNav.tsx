import {
  Bird,
  Bomb,
  Compass,
  Disc3,
  Home,
  LogOut,
  Plane,
  Plus,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { isSoundMuted, playSound, soundEngine, toggleSoundMute } from '../lib/soundEngine';
import type { User } from '../types';

export type AppView =
  | 'lobby'
  | 'wingo'
  | 'aviator'
  | 'mines'
  | 'vortex'
  | 'chicken'
  | 'promotion'
  | 'wallet'
  | 'account'
  | 'vip'
  | 'support'
  | 'auth';

interface TopNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenDeposit: () => void;
  user: User | null;
  onLogout: () => void;
}

export function TopNav({ currentView, onNavigate, onOpenDeposit, user, onLogout }: TopNavProps) {
  const [soundMuted, setSoundMuted] = useState(() => isSoundMuted());

  useEffect(() => {
    return soundEngine.subscribe(setSoundMuted);
  }, []);

  function handleToggleSound() {
    const nextMuted = toggleSoundMute();
    if (!nextMuted) {
      playSound('click');
    }
  }

  const desktopItems: { id: AppView; label: string; icon: typeof Home }[] = [
    { id: 'lobby', label: 'Home', icon: Home },
    { id: 'wingo', label: 'WinGo', icon: Compass },
    { id: 'aviator', label: 'Aviator', icon: Plane },
    { id: 'mines', label: 'Mines', icon: Bomb },
    { id: 'vortex', label: 'Vortex', icon: Disc3 },
    { id: 'chicken', label: 'Chicken', icon: Bird },
    { id: 'promotion', label: 'Promotion', icon: UsersRound },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'account', label: 'Account', icon: UserRound },
  ];

  const mobileItems: { id: AppView; label: string; icon: typeof Home }[] = [
    { id: 'promotion', label: 'Promotion', icon: UsersRound },
    { id: 'wingo', label: 'WinGo', icon: Compass },
    { id: 'lobby', label: 'Home', icon: Home },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'account', label: 'Account', icon: UserRound },
  ];

  return (
    <>
      {/* Desktop & Tablet 3-Zone Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#0E0720]/95 backdrop-blur-md text-white border-b border-purple-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: RANWIN Prominent Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('lobby')}
            className="inline-flex items-center gap-2 font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black text-base flex items-center justify-center shadow-sm">
              R
            </span>
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              RANWIN
            </span>
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="hidden lg:flex items-center gap-4 text-sm font-medium">
            {desktopItems.map((item) => {
              const active =
                currentView === item.id ||
                (item.id === 'account' && (currentView === 'vip' || currentView === 'support'));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'text-amber-300 border-amber-400'
                      : 'text-purple-200/80 border-transparent hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Sound Toggle + Balance Pill + Quick Deposit (+) + Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={soundMuted ? 'Sound Off — click to unmute' : 'Sound On — click to mute'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                soundMuted
                  ? 'bg-[#1D1238] border-purple-700/60 text-purple-300/70 hover:text-white'
                  : 'bg-purple-900/70 border-amber-400/50 text-amber-300 hover:bg-purple-800'
              }`}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-purple-900/80 border border-purple-600/50 pl-3 pr-1 py-1 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('wallet')}
                    className="text-left cursor-pointer"
                    aria-label="Open wallet"
                  >
                    <span className="block font-mono-num text-sm font-bold text-amber-300 leading-tight">
                      ₹{user.balance.toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-purple-200/75 leading-none">
                      VIP{user.vipLevel ?? 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenDeposit}
                    aria-label="Quick deposit"
                    className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('auth')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1B1038]/95 backdrop-blur-md border-t border-purple-800/60"
      >
        <div className="grid h-[60px] items-center grid-cols-5">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active =
              currentView === item.id ||
              (item.id === 'account' && (currentView === 'vip' || currentView === 'support'));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
                  active ? 'text-amber-300 font-semibold' : 'text-purple-200/70 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] leading-tight mt-0.5 whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
