import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  ChevronDown,
  Flame,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { AdCard, AdThumb } from '../components/AdCard';
import { IconButton } from '../components/TopBar';
import { Sheet, SectionHeader } from '../components/ui';
import { AREAS, CATEGORIES } from '../lib/data';
import { TRENDING_SEARCHES } from '../lib/seed';
import { useStore } from '../lib/store';
import { cn, inr, timeAgo, vibrate } from '../lib/utils';
import { Logo } from '../components/AppShell';

const PROMOS = [
  {
    id: 'sell',
    kicker: 'Sell in 60 seconds',
    title: 'Turn clutter into cash',
    body: 'Snap a photo, set a price, get buyers nearby.',
    cta: 'Post an ad',
    to: '/post',
    from: '#0AA98C',
    to2: '#056E64',
    icon: Zap,
  },
  {
    id: 'boost',
    kicker: 'Sell 3× faster',
    title: 'Boost your listing',
    body: 'Featured ads get up to 3× more views in your city.',
    cta: 'See how it works',
    to: '/myads',
    from: '#4F46E5',
    to2: '#7C3AED',
    icon: Sparkles,
  },
  {
    id: 'safepay',
    kicker: 'Bazaar Safe Pay',
    title: 'Pay only when you meet',
    body: 'Escrow-protected payments, released after inspection.',
    cta: 'Learn more',
    to: '/search',
    from: '#F59E0B',
    to2: '#EA580C',
    icon: ShieldCheck,
  },
];

export default function Home() {
  const navigate = useNavigate();
  const ads = useStore((s) => s.ads);
  const user = useStore((s) => s.user);
  const area = useStore((s) => s.area);
  const setArea = useStore((s) => s.setArea);
  const favorites = useStore((s) => s.favorites);
  const recentlyViewed = useStore((s) => s.recentlyViewed);
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;

  const [promo, setPromo] = useState(0);
  const [locOpen, setLocOpen] = useState(false);
  const [tab, setTab] = useState<'near' | 'fresh' | 'cheap' | 'verified'>('near');

  useEffect(() => {
    const t = window.setInterval(() => setPromo((p) => (p + 1) % PROMOS.length), 5200);
    return () => window.clearInterval(t);
  }, []);

  const active = useMemo(() => ads.filter((a) => a.status === 'active'), [ads]);

  const feed = useMemo(() => {
    const list = [...active];
    switch (tab) {
      case 'fresh':
        return list.sort((a, b) => b.createdAt - a.createdAt);
      case 'cheap':
        return list.filter((a) => a.price <= 35000).sort((a, b) => a.price - b.price);
      case 'verified':
        return list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      default:
        return list.sort((a, b) => a.distanceKm - b.distanceKm);
    }
  }, [active, tab]);

  const featured = active.filter((a) => a.featured).slice(0, 6);
  const recentAds = recentlyViewed
    .map((r) => active.find((a) => a.id === r.id))
    .filter(Boolean)
    .slice(0, 6) as typeof active;

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* ------------------------------- Mobile header ------------------------------ */}
      <header
        className="sticky top-0 z-40 border-b px-4 pb-2.5 pt-2.5 backdrop-blur-xl lg:hidden"
        style={{
          background: 'color-mix(in srgb, var(--surface) 86%, transparent)',
          borderColor: 'var(--line)',
        }}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                vibrate();
                setLocOpen(true);
              }}
              className="flex max-w-[150px] items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1.5 text-[12px] font-semibold dark:bg-white/5"
            >
              <MapPin size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />
              <span className="truncate">{area}</span>
              <ChevronDown size={13} className="shrink-0 text-muted" />
            </button>
            <IconButton icon={Bell} label="Notifications" to="/notifications" badge={unread} />
          </div>
        </div>

        <button
          onClick={() => navigate('/search')}
          className="mt-2.5 flex w-full items-center gap-2 rounded-xl border bg-ink-50/80 px-3.5 py-2.5 text-left text-[13.5px] text-muted hairline dark:bg-white/5"
        >
          <Search size={17} className="text-brand-600 dark:text-brand-400" />
          Search cars, phones, flats…
          <span className="ml-auto flex items-center gap-1 rounded-md bg-ink-900 px-2 py-1 text-[10.5px] font-bold text-white dark:bg-white dark:text-ink-900">
            <SlidersHorizontal size={10} /> Filters
          </span>
        </button>
      </header>

      {/* ------------------------------- Desktop hero ------------------------------ */}
      <section className="hidden px-6 pt-8 lg:block">
        <div
          className="relative overflow-hidden rounded-3xl p-10 text-white"
          style={{ background: 'linear-gradient(120deg,#07211E 0%,#075449 55%,#078772 100%)' }}
        >
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl" />
          <div className="absolute -bottom-24 right-40 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-widest text-brand-100 ring-1 ring-white/15">
              <Sparkles size={12} /> Kolkata's friendliest marketplace
            </span>
            <h1 className="mt-4 text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em]">
              Buy and sell
              <br />
              right in your neighbourhood.
            </h1>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-white/70">
              {active.length} live ads · {new Set(active.map((a) => a.area)).size} neighbourhoods ·
              verified sellers, zero listing fees.
            </p>
            <div className="mt-6 flex max-w-lg items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  placeholder="What are you looking for?"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      navigate(`/search?q=${encodeURIComponent(e.currentTarget.value)}`);
                  }}
                  className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-4 text-[14px] text-ink-900 outline-none ring-2 ring-transparent focus:ring-brand-300"
                />
              </div>
              <button
                onClick={() => navigate('/search')}
                className="h-12 rounded-xl bg-white px-5 text-[14px] font-bold text-brand-800 transition active:scale-95"
              >
                Browse
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {TRENDING_SEARCHES.slice(0, 5).map((t) => (
                <button
                  key={t}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(t)}`)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 lg:px-6">
        {/* --------------------------------- Promos --------------------------------- */}
        <section className="mt-3 lg:hidden">
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {PROMOS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  setPromo(i);
                  navigate(p.to);
                }}
                className="relative w-[86%] shrink-0 snap-center overflow-hidden rounded-2xl p-4 text-left text-white shadow-float"
                style={{ background: `linear-gradient(120deg, ${p.from}, ${p.to2})` }}
              >
                <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-white/70">
                  {p.kicker}
                </p>
                <h3 className="mt-1 text-[19px] font-extrabold leading-tight tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-1 max-w-[85%] text-[12px] leading-snug text-white/75">{p.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11.5px] font-bold backdrop-blur">
                  {p.cta} <ArrowRight size={12} />
                </span>
                <p.icon className="absolute bottom-4 right-4 h-10 w-10 text-white/25" />
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {PROMOS.map((p, i) => (
              <span
                key={p.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === promo ? 'w-5 bg-brand-500' : 'w-1.5 bg-ink-200 dark:bg-white/20',
                )}
              />
            ))}
          </div>
        </section>

        {/* -------------------------------- Categories ------------------------------ */}
        <section className="mt-5">
          <SectionHeader
            title="Browse categories"
            action="All"
            onAction={() => navigate('/search')}
          />
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-12 lg:gap-3">
            {CATEGORIES.slice(0, 8).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  vibrate(6);
                  navigate(`/search?cat=${c.id}`);
                }}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition hover:-translate-y-0.5 hover:shadow-card hairline"
                style={{ background: 'var(--surface)' }}
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl text-[20px] transition group-hover:scale-105"
                  style={{ background: `${c.tint}14` }}
                >
                  {c.emoji}
                </span>
                <span className="text-center text-[11px] font-semibold leading-tight">
                  {c.name}
                </span>
              </button>
            ))}
            <button
              onClick={() => navigate('/search')}
              className="hidden flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-2.5 hairline sm:flex"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-500 dark:bg-white/5 dark:text-ink-200">
                <ArrowRight size={18} />
              </span>
              <span className="text-[11px] font-semibold">More</span>
            </button>
          </div>
        </section>

        {/* -------------------------------- Featured -------------------------------- */}
        {featured.length > 0 && (
          <section className="mt-7">
            <SectionHeader
              title="Featured today"
              subtitle="Promoted by sellers near you"
              icon={<Sparkles size={16} className="text-accent-500" />}
              action="See all"
              onAction={() => navigate('/search')}
            />
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0">
              {featured.map((ad) => (
                <div key={ad.id} className="w-[62%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
                  <AdCard ad={ad} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------- Feed ---------------------------------- */}
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
                <Flame size={17} className="text-orange-500" /> Fresh recommendations
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                Picked for {user?.name?.split(' ')[0] ?? 'you'} in {area}
              </p>
            </div>
            <Link
              to="/search"
              className="hidden shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand-600 dark:text-brand-400 sm:flex"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {(
              [
                ['near', 'Near you', MapPin],
                ['fresh', 'Just posted', Clock],
                ['cheap', 'Under ₹35k', TrendingUp],
                ['verified', 'Top picks', BadgeCheck],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn('chip', tab === id && 'chip-on')}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {feed.slice(0, 12).map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>

          {feed.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-[14px] font-semibold">Nothing here yet</p>
              <p className="mt-1 text-[12.5px] text-muted">Try a different filter.</p>
            </div>
          )}
        </section>

        {/* ------------------------------ Recently viewed --------------------------- */}
        {recentAds.length > 0 && (
          <section className="mt-8">
            <SectionHeader title="Pick up where you left off" subtitle="Recently viewed" />
            <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
              {recentAds.map((ad) => (
                <Link
                  key={ad.id}
                  to={`/ad/${ad.id}`}
                  className="flex w-[230px] shrink-0 items-center gap-2.5 rounded-xl border p-2 hairline"
                  style={{ background: 'var(--surface)' }}
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5">
                    <AdThumb ad={ad} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">{inr(ad.price)}</p>
                    <p className="truncate text-[11.5px] text-muted">{ad.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------ Trust strip ------------------------------ */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Verified sellers',
              body: 'Phone-verified, rated by real buyers.',
            },
            {
              icon: MessageCircleIcon,
              title: 'Chat safely',
              body: 'Talk in-app — never share OTPs or UPI PINs.',
            },
            {
              icon: BadgeCheck,
              title: 'Zero listing fees',
              body: 'Post unlimited ads, pay only to boost.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-2xl border p-3.5 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon size={17} />
              </span>
              <div>
                <p className="text-[13px] font-bold">{title}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* --------------------------- Trending searches --------------------------- */}
        <section className="mt-8">
          <SectionHeader
            title="Trending in Kolkata"
            icon={<TrendingUp size={16} className="text-brand-500" />}
          />
          <div className="flex flex-wrap gap-2">
            {TRENDING_SEARCHES.map((t, i) => (
              <button
                key={t}
                onClick={() => navigate(`/search?q=${encodeURIComponent(t)}`)}
                className="chip"
              >
                <span className="text-[10px] font-bold text-brand-500">#{i + 1}</span> {t}
              </button>
            ))}
          </div>
        </section>

        {/* -------------------------------- Sell CTA ------------------------------- */}
        <section className="mt-8 overflow-hidden rounded-2xl border p-5 hairline lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              Free to list
            </p>
            <h3 className="mt-1 text-[20px] font-extrabold tracking-tight">
              Got something lying around?
            </h3>
            <p className="mt-1 max-w-md text-[13px] text-muted">
              Post an ad in under a minute.{' '}
              {favorites.length > 0
                ? `${favorites.length} saved ads are waiting in your favourites.`
                : 'Buyers near you are searching right now.'}
            </p>
          </div>
          <div className="mt-4 flex gap-2 lg:mt-0">
            <Link to="/post" className="btn btn-primary flex-1 lg:flex-none">
              <Zap size={16} /> Post an ad
            </Link>
            <Link to="/favorites" className="btn btn-outline flex-1 lg:flex-none">
              Saved ads
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] text-muted lg:hidden">
          {active.length} live ads · Updated {timeAgo(Math.max(...active.map((a) => a.createdAt)))}
        </p>
      </div>

      {/* ------------------------------- Location sheet ---------------------------- */}
      <Sheet open={locOpen} onClose={() => setLocOpen(false)} title="Choose your area">
        <p className="mb-4 text-[13px] text-muted">
          We show ads closest to you first. You can change this anytime.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setArea(a);
                setLocOpen(false);
              }}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-3 text-left text-[13px] font-medium hairline',
                a === area &&
                  'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10',
              )}
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-brand-500" /> {a}
              </span>
              {a === area && <BadgeCheck size={15} className="text-brand-600" />}
            </button>
          ))}
        </div>
        <button onClick={() => setLocOpen(false)} className="btn btn-primary mt-4 w-full">
          Use {area}, Kolkata
        </button>
      </Sheet>
    </div>
  );
}

// Small inline icon (keeps import list tidy).
function MessageCircleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
