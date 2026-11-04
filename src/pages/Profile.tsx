import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  HelpCircle,
  Heart,
  Info,
  LogOut,
  MapPin,
  Moon,
  Package,
  RotateCcw,
  Search,
  Shield,
  Smartphone,
  Sun,
  MessageCircle,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Avatar, Sheet, Toggle } from '../components/ui';
import { AREAS, sellerById } from '../lib/data';
import { toast, useStore } from '../lib/store';
import { cn } from '../lib/utils';

export default function Profile() {
  const user = useStore((s) => s.user);
  const ads = useStore((s) => s.ads);
  const favorites = useStore((s) => s.favorites);
  const chats = useStore((s) => s.chats);
  const savedSearches = useStore((s) => s.savedSearches);
  const notifications = useStore((s) => s.notifications);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const area = useStore((s) => s.area);
  const setArea = useStore((s) => s.setArea);
  const logout = useStore((s) => s.logout);
  const resetDemo = useStore((s) => s.resetDemo);
  const blocked = useStore((s) => s.blockedSellers);
  const unblockSeller = useStore((s) => s.unblockSeller);
  const navigate = useNavigate();

  const [locOpen, setLocOpen] = useState(false);
  const [pushOn, setPushOn] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  const togglePush = async (next: boolean) => {
    if (typeof Notification === 'undefined') {
      toast('This browser does not support notifications', 'info');
      return;
    }
    if (!next) {
      setPushOn(false);
      toast('Alerts muted — you can re-enable anytime', 'info');
      return;
    }
    if (Notification.permission === 'denied') {
      toast('Notifications are blocked in your browser settings', 'error');
      return;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setPushOn(granted);
    toast(
      granted ? 'Alerts on — we will ping you about new replies' : 'Permission was not granted',
      granted ? 'success' : 'info',
    );
  };
  const [resetOpen, setResetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const mine = ads.filter((a) => a.sellerId === 'me');
  const views = mine.reduce((n, a) => n + a.views, 0);
  const unread = notifications.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back="/"
        title="Account"
        right={
          <Link
            to="/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full active:bg-ink-100 dark:active:bg-white/10"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[color:var(--surface)]" />
            )}
          </Link>
        }
      />

      {/* Header card */}
      <div className="px-4 pt-4">
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: 'linear-gradient(130deg,#07211E,#075449 60%,#078772)' }}
        >
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <Avatar name={user.name} color={user.avatarColor} size={56} ring />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[17px] font-extrabold">
                {user.name} <BadgeCheck size={16} className="text-brand-200" />
              </p>
              <p className="text-[12px] text-white/70">{user.phone}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/60">
                <MapPin size={11} /> {area}, Kolkata
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[11px] font-bold backdrop-blur">
              <Star size={11} className="fill-accent-400 text-accent-400" /> New
            </span>
          </div>
          <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-2.5 backdrop-blur">
            {[
              ['Ads', mine.length],
              ['Views', views],
              ['Saved', favorites.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="text-center">
                <p className="text-[17px] font-extrabold leading-none">{value as number}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wallet / trust promo */}
        <div
          className="mt-3 flex items-center gap-3 rounded-2xl border p-3.5 hairline"
          style={{ background: 'var(--surface)' }}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-400">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Get verified, sell faster</p>
            <p className="text-[11.5px] leading-snug text-muted">
              Verified sellers get up to 40% more replies. Confirm your ID in 2 minutes.
            </p>
          </div>
          <button
            onClick={() => toast('ID verification is simulated in this demo', 'info')}
            className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-[11.5px] font-bold text-white dark:bg-white dark:text-ink-900"
          >
            Verify
          </button>
        </div>

        {/* Activity */}
        <Section title="Activity">
          <Row to="/myads" icon={Package} label="My ads" hint={`${mine.length} posted`} />
          <Row to="/insights" icon={TrendingUp} label="Seller insights" hint="Views & funnel" />
          {user.role === 'admin' && (
            <Row to="/admin" icon={Shield} label="Moderation" hint="Reports & bans" />
          )}
          <Row to="/favorites" icon={Heart} label="Saved ads" hint={`${favorites.length} saved`} />
          <Row
            to="/saved"
            icon={Search}
            label="Saved searches"
            hint={`${savedSearches.length} alerts`}
          />
          <Row
            to="/chats"
            icon={MessageCircle}
            label="Chats"
            hint={`${chats.length} conversations`}
          />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200">
              {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Dark mode</p>
              <p className="text-[11px] text-muted">Easier on the eyes at night</p>
            </div>
            <Toggle checked={theme === 'dark'} onChange={toggleTheme} label="Dark mode" />
          </div>
          <button
            onClick={() => setLocOpen(true)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200">
              <MapPin size={15} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Your area</p>
              <p className="text-[11px] text-muted">{area}, Kolkata</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>
          <button
            onClick={() => {
              toast('To install: open the browser menu → “Add to Home screen”', 'info');
            }}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200">
              <Smartphone size={15} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Install Bazaar app</p>
              <p className="text-[11px] text-muted">Add to home screen · works offline</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>
        </Section>

        {/* Support */}
        <Section title="Safety & support">
          <Row
            icon={Shield}
            label="Safety centre"
            hint="How to trade safely"
            onClick={() => setHelpOpen(true)}
          />
          <Row icon={HelpCircle} label="Help centre" onClick={() => setHelpOpen(true)} />
          <Row icon={Info} label="About Bazaar" hint="v1.0.0" onClick={() => setHelpOpen(true)} />
        </Section>

        {blocked.length > 0 && (
          <Section title="Blocked sellers">
            {blocked.map((id) => {
              const b = sellerById(id);
              return (
                <div key={id} className="flex items-center gap-3 px-3.5 py-3">
                  <Avatar name={b.name} color={b.avatarColor} size={32} />
                  <span className="flex-1 text-[13.5px] font-semibold">{b.name}</span>
                  <button
                    onClick={() => {
                      unblockSeller(id);
                      toast(`${b.name.split(' ')[0]} unblocked`, 'info');
                    }}
                    className="rounded-lg bg-ink-100 px-3 py-1.5 text-[11.5px] font-bold dark:bg-white/10"
                  >
                    Unblock
                  </button>
                </div>
              );
            })}
          </Section>
        )}

        {/* Account */}
        <Section title="Account">
          <button
            onClick={() => setResetOpen(true)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200">
              <RotateCcw size={15} />
            </span>
            <span className="flex-1 text-[13.5px] font-semibold">Reset demo data</span>
            <ChevronRight size={16} className="text-muted" />
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-rose-600"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 dark:bg-rose-500/15">
              <LogOut size={15} />
            </span>
            <span className="flex-1 text-[13.5px] font-semibold">Sign out</span>
          </button>
        </Section>

        <p className="py-6 text-center text-[11px] text-muted">
          Bazaar v1.0.0 · Built with React, TypeScript & Tailwind
          <br />
          Made for buyers and sellers in Kolkata
        </p>
      </div>

      <Sheet open={locOpen} onClose={() => setLocOpen(false)} title="Your area">
        <div className="grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setArea(a);
                setLocOpen(false);
                toast(`Showing ads near ${a}`, 'success');
              }}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-3 text-left text-[13px] font-medium hairline',
                a === area && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
              )}
            >
              {a} {a === area && <BadgeCheck size={15} className="text-brand-600" />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Safety centre">
        <div className="space-y-3 text-[12.5px] leading-relaxed text-muted">
          <p className="font-bold text-[color:var(--text)]">Buying safely</p>
          <p>Always inspect the item before paying. Meet in a busy public place during daylight.</p>
          <p className="font-bold text-[color:var(--text)]">Avoid scams</p>
          <p>
            Never pay an advance, never share OTPs or UPI PINs, and never accept “delivery agent”
            stories. Bazaar staff will never ask for money.
          </p>
          <p className="font-bold text-[color:var(--text)]">Report a problem</p>
          <p>
            Use the Report link on any ad or chat our trust team. We review every report within 24h.
          </p>
        </div>
        <Link
          to="/search"
          onClick={() => setHelpOpen(false)}
          className="btn btn-primary mt-4 w-full"
        >
          Back to browsing
        </Link>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?">
        <p className="text-[13px] text-muted">
          This restores the sample listings, chats and searches, and removes any ads you posted in
          this demo. Your account stays signed in.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setResetOpen(false)} className="btn btn-outline flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              resetDemo();
              setResetOpen(false);
              toast('Demo data restored', 'success');
            }}
            className="btn btn-primary flex-1"
          >
            Reset
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted">
        {title}
      </p>
      <div
        className="divide-hair overflow-hidden rounded-2xl border hairline"
        style={{ background: 'var(--surface)' }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  to,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200">
        <Icon size={15} />
      </span>
      <span className="flex-1 text-[13.5px] font-semibold">{label}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
      <ChevronRight size={16} className="text-muted" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-3.5 py-3 text-left';
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
