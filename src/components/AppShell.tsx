import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  Download,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Moon,
  Plus,
  Search,
  ShoppingBag,
  Sun,
  X,
  AlertTriangle,
  WifiOff,
} from 'lucide-react';
import { useStore, useUI } from '../lib/store';
import { cn, vibrate } from '../lib/utils';
import { BottomNav } from './BottomNav';
import { IconButton } from './TopBar';
import { Onboarding } from './Onboarding';
import { Avatar } from './ui';

/* --------------------------------- Brand ---------------------------------- */

export function Logo({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2">
      <span
        className="grid h-9 w-9 place-items-center rounded-[11px] text-white shadow-glow"
        style={{ background: 'linear-gradient(140deg,#0AA98C,#067A66)' }}
      >
        <ShoppingBag size={19} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-[19px] font-extrabold tracking-[-0.03em]">
          bazaar<span className="text-brand-500">.</span>
        </span>
      )}
    </Link>
  );
}

/* ------------------------------ Desktop header ----------------------------- */

function DesktopHeader() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const area = useStore((s) => s.area);
  const user = useStore((s) => s.user);
  const notifications = useStore((s) => s.notifications);
  const chats = useStore((s) => s.chats);
  const unreadN = notifications.filter((n) => !n.read).length;
  const unreadC = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.senderId !== 'me' && !m.read).length,
    0,
  );

  return (
    <header
      className="sticky top-0 z-50 hidden border-b backdrop-blur-xl lg:block"
      style={{
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
        borderColor: 'var(--line)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-6">
        <Logo />
        <button className="ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium hover:bg-ink-50 dark:hover:bg-white/5">
          <MapPin size={15} className="text-brand-600 dark:text-brand-400" />
          <span className="max-w-[110px] truncate">{area}</span>
          <span className="text-muted">· Kolkata</span>
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="relative mx-auto w-full max-w-lg"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cars, phones, flats, jobs…"
            className="input h-10 rounded-full py-0 pl-10 pr-4 text-[13.5px]"
          />
        </form>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors',
                isActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-ink-600 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-white/5',
              )
            }
          >
            Browse
          </NavLink>
          <NavLink
            to="/chats"
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors',
                isActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-ink-600 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-white/5',
              )
            }
          >
            <MessageCircle size={16} /> Chats
            {unreadC > 0 && (
              <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white">
                {unreadC}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/myads"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors',
                isActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-ink-600 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-white/5',
              )
            }
          >
            My ads
          </NavLink>
        </nav>

        <button
          onClick={() => {
            vibrate();
            toggleTheme();
          }}
          aria-label="Toggle theme"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-white/5"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <IconButton icon={Bell} label="Notifications" to="/notifications" badge={unreadN} />
        <Link
          to="/post"
          className="ml-1 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white shadow-glow transition active:scale-95"
          style={{ background: 'linear-gradient(140deg,#0AA98C,#067A66)' }}
        >
          <Plus size={17} strokeWidth={2.8} /> Sell
        </Link>
        <Link to={user ? '/profile' : '/login'} aria-label="Account">
          <Avatar name={user?.name ?? 'Guest'} color={user?.avatarColor ?? '#64748B'} size={34} />
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------ Offline banner ---------------------------- */

function ConnectionBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      useUI.getState().toast('Back online — syncing your ads', 'success');
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[132px] z-[80] flex justify-center px-4 lg:bottom-6">
      <div className="flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-float dark:bg-ink-700">
        <WifiOff size={13} /> You're offline — saved ads are still available
      </div>
    </div>
  );
}

/* --------------------------------- Toaster -------------------------------- */

function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-2.5 rounded-xl bg-ink-900 px-3.5 py-3 text-white shadow-float dark:bg-white dark:text-ink-900"
        >
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full',
              t.kind === 'success' && 'bg-brand-500/25 text-brand-200 dark:text-brand-700',
              t.kind === 'error' && 'bg-rose-500/25 text-rose-200 dark:text-rose-600',
              t.kind === 'info' && 'bg-blue-500/25 text-blue-200 dark:text-blue-600',
            )}
          >
            {t.kind === 'success' ? (
              <Check size={14} strokeWidth={3} />
            ) : t.kind === 'error' ? (
              <AlertTriangle size={13} />
            ) : (
              <Info size={13} />
            )}
          </span>
          <p className="flex-1 text-[13px] font-medium leading-snug">{t.message}</p>
          {t.action && (
            <button
              onClick={() => {
                if (t.action?.to) navigate(t.action.to);
                dismiss(t.id);
              }}
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-bold text-brand-300 dark:text-brand-700"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Install banner ---------------------------- */

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BipEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BipEvent;
  });
}

function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const dismissHint = useStore((s) => s.installedHintDismissed);
  const dismiss = useStore((s) => s.dismissInstalledHint);
  const location = useLocation();

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (isStandalone || dismissHint) return;
    const t = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(t);
  }, [dismissHint]);

  if (!visible || location.pathname === '/login' || location.pathname.startsWith('/post'))
    return null;

  return (
    <div className="fixed inset-x-3 bottom-[86px] z-[60] mx-auto max-w-md animate-slide-up lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border bg-ink-900 p-3 text-white shadow-float dark:bg-ink-800">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: 'linear-gradient(140deg,#0AA98C,#067A66)' }}
        >
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">Install Bazaar</p>
          <p className="truncate text-[11.5px] text-white/65">
            Add to home screen — works offline, no store needed.
          </p>
        </div>
        <button
          onClick={async () => {
            if (deferredPrompt) {
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              deferredPrompt = null;
            }
            setVisible(false);
            dismiss();
          }}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-ink-900"
        >
          Install
        </button>
        <button
          aria-label="Dismiss"
          onClick={() => {
            setVisible(false);
            dismiss();
          }}
          className="shrink-0 opacity-50"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Shell ---------------------------------- */

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    const el = document.getElementById('app-scroll');
    if (el) el.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppShell() {
  return (
    <div className="flex h-full flex-col">
      <div id="app-scroll" className="relative flex-1 overflow-y-auto overscroll-y-contain">
        <DesktopHeader />
        <ScrollReset />
        <main className="pb-nav lg:pb-10">
          <Outlet />
        </main>
        <DesktopFooter />
      </div>
      <Onboarding />
      <BottomNav />
      <ConnectionBanner />
      <Toaster />
      <InstallBanner />
    </div>
  );
}

function DesktopFooter() {
  return (
    <footer className="mt-10 hidden border-t px-6 py-8 hairline lg:block">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 text-[12.5px] text-muted">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="ml-2">Buy. Sell. Nearby.</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link to="/search" className="hover:text-brand-600">
            Browse
          </Link>
          <Link to="/saved" className="flex items-center gap-1 hover:text-brand-600">
            <Heart size={13} /> Saved
          </Link>
          <Link to="/post" className="hover:text-brand-600">
            Post an ad
          </Link>
          <Link to="/profile" className="hover:text-brand-600">
            Account
          </Link>
          <span>© {new Date().getFullYear()} Bazaar Marketplace</span>
        </div>
      </div>
    </footer>
  );
}
