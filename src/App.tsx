import { useCallback, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from './lib/api';
import type { GameInterval, User } from './types';
import { TopNav, type AppView } from './components/TopNav';
import { AuthScreen } from './components/AuthScreen';
import { LobbyView } from './components/LobbyView';
import { WinGoView } from './components/WinGoView';
import { AviatorView } from './components/AviatorView';
import { MinesView } from './components/MinesView';
import { VortexView } from './components/VortexView';
import { ChickenRoadView } from './components/ChickenRoadView';
import { WalletView } from './components/WalletView';
import { PromotionView } from './components/PromotionView';
import { AccountView } from './components/AccountView';
import { VipView } from './components/VipView';
import { SupportView } from './components/SupportView';
import { AdminPortal } from './components/AdminPortal';
import { FirstDepositBonusModal } from './components/FirstDepositBonusModal';

const BONUS_DISMISS_KEY = 'ranwin_deposit_bonus_dismissed_date';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBonusDismissedToday(): boolean {
  try {
    return localStorage.getItem(BONUS_DISMISS_KEY) === getTodayKey();
  } catch {
    return false;
  }
}

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.startsWith('#/admin')
  );
}

export default function App() {
  if (isAdminPath()) {
    return <AdminPortal />;
  }

  return <PlayerApp />;
}

function PlayerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'wingo';
      if (params.get('invite')) return 'auth';
    }
    return 'lobby';
  });
  const [winGoInterval, setWinGoInterval] = useState<GameInterval>('30s');
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [prefillDepositAmount, setPrefillDepositAmount] = useState<number | null>(null);
  const [showBonusModal, setShowBonusModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('invite')) return false;
    }
    return !isBonusDismissedToday();
  });
  const [announcement, setAnnouncement] = useState(
    'Welcome to RANWIN! Deposit min ₹90 via official QR & claim Extra First Deposit Bonus up to ₹88.'
  );

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api
        .me()
        .then((res) => setUser(res.user))
        .catch(() => setStoredToken(null))
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }

    api
      .getWinGoState('30s', 1)
      .then((res) => {
        if (res.announcement) setAnnouncement(res.announcement);
      })
      .catch(() => {});
  }, []);

  // Refresh user EXP & VIP status whenever opening Account or VIP views
  useEffect(() => {
    if ((currentView === 'account' || currentView === 'vip') && getStoredToken()) {
      api
        .me()
        .then((res) => setUser(res.user))
        .catch(() => {});
    }
  }, [currentView]);

  const handleBalanceChange = useCallback((newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  }, []);

  async function handleLogout() {
    const token = getStoredToken();
    setStoredToken(null);
    setUser(null);
    if (
      currentView === 'wallet' ||
      currentView === 'promotion' ||
      currentView === 'account' ||
      currentView === 'vip' ||
      currentView === 'support'
    ) {
      setCurrentView('lobby');
    }
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  function handleSelectWinGoInterval(iv: GameInterval) {
    setWinGoInterval(iv);
    setCurrentView('wingo');
  }

  function handleOpenWallet(tab: 'deposit' | 'withdraw', amount?: number) {
    setWalletTab(tab);
    if (amount) {
      setPrefillDepositAmount(amount);
    }
    if (!user) {
      setCurrentView('auth');
    } else {
      setCurrentView('wallet');
    }
  }

  function handleCloseBonusModal(dontRemindToday: boolean) {
    if (dontRemindToday) {
      try {
        localStorage.setItem(BONUS_DISMISS_KEY, getTodayKey());
      } catch {
        // ignore storage errors
      }
    }
    setShowBonusModal(false);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#140B29]">
        <div className="text-sm font-semibold text-purple-200">Loading RANWIN...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#140B29] text-purple-50 flex flex-col">
      <TopNav
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenDeposit={() => handleOpenWallet('deposit')}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {currentView === 'auth' && (
          <AuthScreen
            onSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setCurrentView('lobby');
            }}
          />
        )}

        {currentView === 'lobby' && (
          <LobbyView
            user={user}
            announcement={announcement}
            onNavigate={setCurrentView}
            onSelectWinGoInterval={handleSelectWinGoInterval}
            onOpenDeposit={() => handleOpenWallet('deposit')}
            onOpenWithdraw={() => handleOpenWallet('withdraw')}
            onOpenBonusChart={() => setShowBonusModal(true)}
          />
        )}

        {currentView === 'wingo' && (
          <WinGoView
            user={user}
            interval={winGoInterval}
            onIntervalChange={setWinGoInterval}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
            onOpenDeposit={() => handleOpenWallet('deposit')}
            onOpenWithdraw={() => handleOpenWallet('withdraw')}
          />
        )}

        {currentView === 'aviator' && (
          <AviatorView
            user={user}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'mines' && (
          <MinesView
            user={user}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'vortex' && (
          <VortexView
            user={user}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'chicken' && (
          <ChickenRoadView
            user={user}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'promotion' && (
          <PromotionView
            user={user}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'wallet' && (
          <WalletView
            user={user}
            initialTab={walletTab}
            initialDepositAmount={prefillDepositAmount}
            onBalanceChange={handleBalanceChange}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'account' && (
          <AccountView
            user={user}
            onUserUpdated={setUser}
            onNavigate={setCurrentView}
            onOpenDeposit={() => handleOpenWallet('deposit')}
            onOpenWithdraw={() => handleOpenWallet('withdraw')}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'vip' && (
          <VipView
            user={user}
            onBack={() => setCurrentView('account')}
            onUserUpdated={setUser}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}

        {currentView === 'support' && (
          <SupportView
            user={user}
            onBack={() => setCurrentView('account')}
            onRequireAuth={() => setCurrentView('auth')}
          />
        )}
      </main>

      {currentView === 'lobby' && showBonusModal && (
        <FirstDepositBonusModal
          claimed={Boolean(user?.firstDepositBonusClaimed)}
          onClose={handleCloseBonusModal}
          onSelectDepositAmount={(amt) => {
            setShowBonusModal(false);
            handleOpenWallet('deposit', amt);
          }}
        />
      )}
    </div>
  );
}
