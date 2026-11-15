import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bird,
  Bomb,
  Clock,
  Compass,
  Disc3,
  Flame,
  Gift,
  Headphones,
  Plane,
  Sparkles,
  Trophy,
  Volume2,
} from 'lucide-react';
import type { GameInterval, User } from '../types';
import { INTERVAL_CONFIG, INTERVAL_LIST } from '../game/rules';
import type { AppView } from './TopNav';

import heroBannerImg from '../assets/images/lobby_hero_banner_1794672494324.jpg';
import winGoCardImg from '../assets/images/wingo_card_art_1794672494062.jpg';
import aviatorCardImg from '../assets/images/aviator_card_art_1794709854766.jpg';
import minesCardImg from '../assets/images/mines_card_art_1794709854225.jpg';
import vortexCardImg from '../assets/images/vortex_card_art_1794672495588.jpg';
import chickenRoadCardImg from '../assets/images/chicken_road_card_art_1794707359918.jpg';

type LobbyCategory = 'popular' | 'lottery' | 'minigames';

interface LobbyViewProps {
  user: User | null;
  announcement: string;
  onNavigate: (view: AppView) => void;
  onSelectWinGoInterval: (interval: GameInterval) => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenBonusChart: () => void;
}

interface GamePoster {
  id: AppView;
  title: string;
  subtitle: string;
  rtp: string;
  badge: string;
  image: string;
  category: 'lottery' | 'minigames';
}

const GAME_POSTERS: GamePoster[] = [
  {
    id: 'wingo',
    title: 'WINGO',
    subtitle: '30s · 1m · 3m · 5m · 10m',
    rtp: '96.42%',
    badge: 'LIVE',
    image: winGoCardImg,
    category: 'lottery',
  },
  {
    id: 'aviator',
    title: 'AVIATOR',
    subtitle: 'Crash Multiplier Flight',
    rtp: '96.38%',
    badge: 'CRASH',
    image: aviatorCardImg,
    category: 'minigames',
  },
  {
    id: 'mines',
    title: 'MINES',
    subtitle: '5×5 Gold Coin Jackpot',
    rtp: '96.95%',
    badge: 'JILI',
    image: minesCardImg,
    category: 'minigames',
  },
  {
    id: 'vortex',
    title: 'VORTEX',
    subtitle: 'Orbital Wheel up to 15x',
    rtp: '96.80%',
    badge: 'HOT',
    image: vortexCardImg,
    category: 'minigames',
  },
  {
    id: 'chicken',
    title: 'CHICKEN ROAD',
    subtitle: '8-Lane Multiplier Run',
    rtp: '96.58%',
    badge: 'BONUS',
    image: chickenRoadCardImg,
    category: 'minigames',
  },
];

export function LobbyView({
  user,
  announcement,
  onNavigate,
  onSelectWinGoInterval,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenBonusChart,
}: LobbyViewProps) {
  const [category, setCategory] = useState<LobbyCategory>('popular');

  const showLottery = category === 'popular' || category === 'lottery';
  const showMinigames = category === 'popular' || category === 'minigames';
  const recommendedGames =
    category === 'lottery'
      ? GAME_POSTERS.filter((g) => g.category === 'lottery')
      : category === 'minigames'
      ? GAME_POSTERS.filter((g) => g.category === 'minigames')
      : GAME_POSTERS;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
      {/* Top Hero Banner + Wallet Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border border-purple-600/50 bg-[#1F133D] min-h-[210px] sm:min-h-[235px] flex items-center">
          <img
            src={heroBannerImg}
            alt="RANWIN Daily Check-In Bonus"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#13082C]/95 via-[#251052]/80 to-purple-950/35" />
          <div className="relative z-10 p-6 sm:p-8 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              RANWIN · Daily Check-In Bonus
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1.5 leading-tight text-balance">
              BONUS RECHARGE &amp; WIN INSTANTLY
            </h1>
            <p className="text-xs sm:text-sm text-purple-100/90 mt-2 leading-relaxed">
              Deposit min ₹90 via QR to claim up to ₹88 first deposit reward. Play WinGo, Aviator,
              Mines, Vortex, and Chicken Road 24/7.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenBonusChart}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Gift className="w-4 h-4" />
                CLAIM THE REWARD &gt;
              </button>
              <button
                type="button"
                onClick={() => onNavigate('wingo')}
                className="px-4 py-2.5 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Play WinGo
              </button>
            </div>
          </div>
        </div>

        {/* Right Wallet & Quick Support Card */}
        <div className="lg:col-span-4 bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-200/75">RANWIN Wallet Balance</p>
              <button
                type="button"
                onClick={() => onNavigate('support')}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                Customer Service
              </button>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono-num text-3xl font-bold text-white">
                ₹{user ? user.balance.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs font-medium text-amber-300">
                {user ? user.username : 'Guest Mode'}
              </span>
            </div>
            <p className="text-xs text-purple-200/70 mt-1.5">
              {user
                ? 'Min Deposit ₹90 · Min Withdraw ₹110'
                : 'Sign in or register to place bets and withdraw winnings.'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenWithdraw}
              className="h-11 rounded-xl border border-purple-600/60 bg-[#2B1B54] hover:bg-purple-800/70 text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
              Withdraw
            </button>
            <button
              type="button"
              onClick={onOpenDeposit}
              className="h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4 text-amber-300" />
              Deposit
            </button>
          </div>

          {!user && (
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="mt-3 w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              Sign In / Create Account
            </button>
          )}
        </div>
      </div>

      {/* Announcement Ribbon */}
      <div className="bg-[#1F133D] rounded-xl border border-purple-700/50 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Volume2 className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="overflow-hidden whitespace-nowrap text-xs sm:text-sm text-purple-100/90">
            <div className="animate-marquee">
              <span className="mr-16">{announcement}</span>
              <span className="mr-16">{announcement}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenBonusChart}
          className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Detail &gt;
        </button>
      </div>

      {/* Category Filter Tiles (Matching gameenterface.png) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {[
          { id: 'popular' as const, label: 'Popular', icon: Flame, action: () => setCategory('popular') },
          { id: 'lottery' as const, label: 'Lottery', icon: Compass, action: () => setCategory('lottery') },
          { id: 'minigames' as const, label: 'Mini games', icon: Sparkles, action: () => setCategory('minigames') },
          { id: 'aviator_link' as const, label: 'Aviator', icon: Plane, action: () => onNavigate('aviator') },
          { id: 'mines_link' as const, label: 'Mines', icon: Bomb, action: () => onNavigate('mines') },
        ].map((cat) => {
          const Icon = cat.icon;
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={cat.action}
              className={`rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                active
                  ? 'bg-violet-700 border-amber-400/70 text-white shadow-md'
                  : 'bg-[#1F133D] border-purple-700/50 text-purple-200 hover:border-purple-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-amber-300' : 'text-amber-400/90'}`} />
              <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Platform Recommendation Poster Grid with Golden RTP Bars (Matching 6.21.03 PM) */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-amber-400" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Platform recommendation
            </h2>
          </div>
          <span className="text-xs text-purple-200/70">Tap any game to launch</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {recommendedGames.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => onNavigate(game.id)}
              className="group text-left bg-[#1F133D] rounded-2xl border border-purple-700/50 hover:border-amber-400/80 overflow-hidden flex flex-col justify-between transition-all shadow-md cursor-pointer"
            >
              <div className="relative aspect-[3/4] w-full bg-[#120826] overflow-hidden">
                <img
                  src={game.image}
                  alt={game.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#120826] via-transparent to-black/25" />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black tracking-wide">
                  {game.badge}
                </span>
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="font-display text-base font-black text-white tracking-wide drop-shadow">
                    {game.title}
                  </p>
                  <p className="text-[11px] text-purple-100/85 truncate">{game.subtitle}</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-gradient-to-r from-[#F9D976] to-[#F39F38] text-slate-950 flex items-center justify-between text-xs font-extrabold">
                <span>RTP</span>
                <span className="font-mono-num">{game.rtp}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Lottery Section (Matching gameenterface.png) */}
      {showLottery && (
        <section className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-emerald-400" />
              <h2 className="font-display text-base sm:text-lg font-bold text-white">Lottery</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('wingo')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              Open WinGo &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {INTERVAL_LIST.map((iv) => {
              const cfg = INTERVAL_CONFIG[iv];
              return (
                <button
                  key={iv}
                  type="button"
                  onClick={() => onSelectWinGoInterval(iv)}
                  className="p-3.5 rounded-xl border border-purple-700/50 bg-[#28194E] hover:border-amber-400 hover:bg-purple-800/70 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <Clock className="w-4 h-4 text-amber-300" />
                    <Trophy className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="font-display font-bold text-sm text-white mt-2">{cfg.label}</p>
                  <p className="text-xs text-purple-200/75 mt-0.5 font-mono-num">{cfg.durationSec}s cycle</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Mini Games Section (Matching gameenterface.png) */}
      {showMinigames && (
        <section className="bg-[#1F133D] rounded-2xl border border-purple-700/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-amber-400" />
              <h2 className="font-display text-base sm:text-lg font-bold text-white">Mini games</h2>
            </div>
            <span className="text-xs text-purple-200/75">Instant Cashout</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'aviator' as const, label: 'Aviator', desc: 'Cash out before crash', icon: Plane, rtp: '96.38%' },
              { id: 'mines' as const, label: 'Mines Jackpot', desc: '5×5 hidden gold coins', icon: Bomb, rtp: '96.95%' },
              { id: 'vortex' as const, label: 'Vortex Wheel', desc: 'Orbital ring surge', icon: Disc3, rtp: '96.80%' },
              { id: 'chicken' as const, label: 'Chicken Road', desc: 'Cross 8 highway lanes', icon: Bird, rtp: '96.58%' },
            ].map((mg) => {
              const Icon = mg.icon;
              return (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => onNavigate(mg.id)}
                  className="p-4 rounded-xl border border-purple-700/50 bg-[#28194E] hover:border-amber-400 hover:bg-purple-800/70 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-amber-300" />
                    <span className="font-mono-num text-[11px] font-bold text-emerald-300">
                      RTP {mg.rtp}
                    </span>
                  </div>
                  <p className="font-display font-bold text-sm text-white mt-2.5">{mg.label}</p>
                  <p className="text-xs text-purple-200/75 mt-0.5">{mg.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
