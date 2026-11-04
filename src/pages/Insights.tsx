import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  Heart,
  Lightbulb,
  MessageCircle,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdThumb } from '../components/AdCard';
import { EmptyState } from '../components/ui';
import { useStore } from '../lib/store';
import {
  chatsForAd,
  sellerOverview,
  sellerTips,
  seriesTotal,
  sparkPath,
  trend,
  viewSeries,
} from '../lib/insights';
import { cn, inr, timeAgo } from '../lib/utils';

const RANGES = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
] as const;

export default function Insights() {
  const ads = useStore((s) => s.ads);
  const chats = useStore((s) => s.chats);
  const navigate = useNavigate();
  const [days, setDays] = useState<7 | 30>(7);

  const mine = useMemo(
    () => ads.filter((a) => a.sellerId === 'me').sort((a, b) => b.views - a.views),
    [ads],
  );
  const overview = useMemo(() => sellerOverview(ads, chats, days), [ads, chats, days]);
  const tips = useMemo(() => sellerTips(ads, chats), [ads, chats]);

  if (!mine.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <TopBar back="/myads" title="Seller insights" />
        <EmptyState
          icon={<BarChart3 size={26} />}
          title="No data yet"
          body="Post an ad and this dashboard fills up with views, saves, chats and conversion — plus tips on what to fix."
          action="Post an ad"
          onAction={() => navigate('/post')}
        />
      </div>
    );
  }

  const W = 320;
  const H = 96;
  const path = sparkPath(overview.series, W, H, 6);
  const peak = Math.max(...overview.series);
  const funnel = [
    { label: 'Views', value: seriesTotal(overview.series), icon: Eye, tone: 'bg-brand-500' },
    {
      label: 'Saves',
      value: Math.max(1, Math.round(overview.saves * 0.8)),
      icon: Heart,
      tone: 'bg-sky-500',
    },
    {
      label: 'Chats',
      value: Math.max(0, overview.chats),
      icon: MessageCircle,
      tone: 'bg-violet-500',
    },
    { label: 'Deals', value: overview.sold, icon: Zap, tone: 'bg-accent-500' },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back="/myads"
        title="Seller insights"
        subtitle={`${overview.live} live ad${overview.live === 1 ? '' : 's'} · updated just now`}
        right={
          <div className="flex rounded-full border p-0.5 hairline">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setDays(r.id)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors',
                  days === r.id
                    ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                    : 'text-muted',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-4 pt-4">
        {/* Hero chart */}
        <section
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: 'linear-gradient(135deg,#07211E,#075449 65%,#078772)' }}
        >
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-300/20 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-white/60">
                Views · last {days} days
              </p>
              <p className="mt-1 text-[30px] font-extrabold leading-none tracking-tight">
                {seriesTotal(overview.series).toLocaleString('en-IN')}
              </p>
              <span
                className={cn(
                  'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold',
                  overview.trendPct >= 0
                    ? 'bg-brand-400/20 text-brand-100'
                    : 'bg-rose-400/20 text-rose-100',
                )}
              >
                {overview.trendPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(overview.trendPct)}% vs previous period
              </span>
            </div>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-[10.5px] font-semibold backdrop-blur">
              {overview.uniqueViewers.toLocaleString('en-IN')} unique buyers
            </span>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="relative mt-3 h-24 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#52D9BE" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#52D9BE" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={path.area} fill="url(#areaFill)" />
            <path
              d={path.line}
              fill="none"
              stroke="#8FEAD6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="relative mt-1 flex justify-between text-[9.5px] font-medium text-white/45">
            <span>{days === 7 ? '7 days ago' : '30 days ago'}</span>
            <span>Today · peak {peak}/day</span>
          </div>
        </section>

        {/* Stat tiles */}
        <section className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: Heart, label: 'Saves', value: overview.saves, hint: 'buyers watching' },
            { icon: MessageCircle, label: 'Chats', value: overview.chats, hint: 'conversations' },
            {
              icon: MousePointerClick,
              label: 'Save rate',
              value: `${overview.conversion}%`,
              hint: 'of views',
            },
          ].map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="rounded-xl border p-3 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <Icon size={14} className="text-brand-600 dark:text-brand-400" />
              <p className="mt-1.5 text-[18px] font-extrabold leading-none">{value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-0.5 text-[9.5px] text-muted">{hint}</p>
            </div>
          ))}
        </section>

        {/* Funnel */}
        <section
          className="mt-3 rounded-2xl border p-4 hairline"
          style={{ background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
              <TrendingUp size={15} className="text-brand-600 dark:text-brand-400" /> Buyer funnel
            </h2>
            <span className="text-[10.5px] text-muted">{overview.series.length} day window</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {funnel.map((f, i) => {
              const prev = i === 0 ? null : funnel[i - 1].value;
              const rate = prev ? Math.round((f.value / Math.max(1, prev)) * 100) : null;
              return (
                <div key={f.label}>
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <f.icon size={12} className="text-muted" /> {f.label}
                    </span>
                    <span className="font-bold">
                      {f.value.toLocaleString('en-IN')}
                      {rate !== null && (
                        <span className="ml-1 font-normal text-muted">· {rate}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all', f.tone)}
                      style={{ width: `${Math.max(3, (f.value / funnelMax) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
            Sellers with a 10%+ save rate typically close a deal within 6 days. Improve yours with
            sharper photos and a competitive price.
          </p>
        </section>

        {/* Per-ad performance */}
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold">
            <BarChart3 size={15} className="text-brand-600 dark:text-brand-400" /> Ad performance
          </h2>
          <div
            className="divide-hair overflow-hidden rounded-2xl border hairline"
            style={{ background: 'var(--surface)' }}
          >
            {mine.slice(0, 6).map((ad) => {
              const series = viewSeries(ad, days);
              const p = sparkPath(series, 64, 22, 2);
              const adChats = chatsForAd(ad.id, chats);
              return (
                <Link
                  key={ad.id}
                  to={`/ad/${ad.id}`}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5">
                    <AdThumb ad={ad} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">
                      {ad.title || 'Untitled ad'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
                      <span className="flex items-center gap-0.5">
                        <Eye size={9} /> {ad.views}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart size={9} /> {ad.saves}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageCircle size={9} /> {adChats}
                      </span>
                      <span>· {inr(ad.price)}</span>
                      <span>· {timeAgo(ad.createdAt)}</span>
                    </p>
                  </div>
                  <svg viewBox="0 0 64 22" className="h-6 w-16 shrink-0">
                    <path
                      d={p.line}
                      fill="none"
                      stroke="#0AA98C"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className={cn(
                      'shrink-0 text-[10.5px] font-bold',
                      trend(series) >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-rose-500',
                    )}
                  >
                    {trend(series) >= 0 ? '+' : ''}
                    {trend(series)}%
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Tips */}
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold">
            <Lightbulb size={15} className="text-accent-500" /> What to do next
          </h2>
          <div className="space-y-2">
            {tips.map((t) => (
              <Link
                key={t.title}
                to={t.to ?? '/myads'}
                className="flex items-start gap-3 rounded-xl border p-3 transition hover:shadow-card hairline"
                style={{ background: 'var(--surface)' }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-600 dark:text-accent-400">
                  <Sparkles size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold">{t.title}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                    {t.body}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="py-6 text-center text-[10.5px] leading-relaxed text-muted">
          Analytics are simulated from real activity in this demo.
          <br />
          In production these numbers come from your events pipeline.
        </p>
      </div>
    </div>
  );
}
