import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  BarChart3,
  ChevronRight,
  Eye,
  Heart,
  PackageOpen,
  PenLine,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdThumb } from '../components/AdCard';
import { Badge, EmptyState, Sheet } from '../components/ui';
import { toast, useStore } from '../lib/store';
import { payForBoost } from '../lib/sync';
import { cn, inr, timeAgo } from '../lib/utils';
import type { AdStatus } from '../lib/types';

const STATUS_BADGE: Record<
  AdStatus,
  { label: string; tone: 'brand' | 'red' | 'neutral' | 'amber' }
> = {
  active: { label: 'Live', tone: 'brand' },
  sold: { label: 'Sold', tone: 'red' },
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Under review', tone: 'amber' },
  removed: { label: 'Removed', tone: 'red' },
};

const daysLeft = (until: number) => {
  const d = Math.ceil((until - Date.now()) / 86_400_000);
  return d <= 1 ? 'ends today' : `${d} days left`;
};

const TABS: { id: AdStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Live' },
  { id: 'sold', label: 'Sold' },
  { id: 'draft', label: 'Drafts' },
];

export default function MyAds() {
  const ads = useStore((s) => s.ads);
  const user = useStore((s) => s.user);
  const updateAd = useStore((s) => s.updateAd);
  const deleteAd = useStore((s) => s.deleteAd);
  const boostAd = useStore((s) => s.boostAd);
  const dropPrice = useStore((s) => s.dropPrice);
  const navigate = useNavigate();
  const serverConfig = useStore((s) => s.serverConfig);
  const paid = !!serverConfig?.payments;
  const boostPrice = serverConfig ? serverConfig.boostPricePaise / 100 : 149;
  const boostDays = serverConfig?.boostDays ?? 7;
  const [paying, setPaying] = useState(false);
  const [tab, setTab] = useState<AdStatus | 'all'>('all');
  const [boostTarget, setBoostTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [priceTarget, setPriceTarget] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState('');

  const mine = useMemo(() => ads.filter((a) => a.sellerId === 'me'), [ads]);
  const priceAd = mine.find((a) => a.id === priceTarget) ?? null;
  const filtered = tab === 'all' ? mine : mine.filter((a) => a.status === tab);

  const stats = useMemo(
    () => ({
      views: mine.reduce((n, a) => n + a.views, 0),
      saves: mine.reduce((n, a) => n + a.saves, 0),
      live: mine.filter((a) => a.status === 'active').length,
    }),
    [mine],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back="/profile"
        title="My ads"
        subtitle={`${stats.live} live · ${stats.views} total views`}
        right={
          <>
            <Link
              to="/insights"
              aria-label="Seller insights"
              className="grid h-9 w-9 place-items-center rounded-full active:bg-ink-100 dark:active:bg-white/10"
            >
              <BarChart3 size={19} />
            </Link>
            <Link to="/post" className="btn btn-primary px-3 py-2 text-[12.5px]">
              <Plus size={15} /> Post
            </Link>
          </>
        }
      />

      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Eye, label: 'Views', value: stats.views.toLocaleString('en-IN') },
            { icon: Heart, label: 'Saves', value: stats.saves },
            { icon: BarChart3, label: 'Live ads', value: stats.live },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border p-3 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <Icon size={15} className="text-brand-600 dark:text-brand-400" />
              <p className="mt-1.5 text-[18px] font-extrabold leading-none">{value}</p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn('chip', tab === t.id && 'chip-on')}
            >
              {t.label}
              <span className="text-[10px] opacity-60">
                {t.id === 'all' ? mine.length : mine.filter((a) => a.status === t.id).length}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={26} />}
            title={mine.length ? 'Nothing here' : 'You have not posted anything yet'}
            body={
              mine.length
                ? 'Ads you mark as sold or save as drafts will appear here.'
                : 'Turn unused things into cash — it takes less than a minute to post your first ad.'
            }
            action={mine.length ? undefined : 'Post an ad'}
            onAction={() => navigate('/post')}
          />
        ) : (
          <div className="mt-3 space-y-2.5 pb-4">
            {filtered.map((ad) => (
              <div
                key={ad.id}
                className="rounded-2xl border p-3 hairline"
                style={{ background: 'var(--surface)' }}
              >
                <div className="flex gap-3">
                  <Link
                    to={`/ad/${ad.id}`}
                    className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-ink-100 dark:bg-white/5"
                  >
                    <AdThumb ad={ad} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-extrabold">{inr(ad.price)}</p>
                        <p className="truncate text-[12.5px] font-medium">{ad.title}</p>
                      </div>
                      <Badge tone={STATUS_BADGE[ad.status].tone}>
                        {STATUS_BADGE[ad.status].label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted">
                      <span className="flex items-center gap-1">
                        <Eye size={10} /> {ad.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={10} /> {ad.saves}
                      </span>
                      <span>{timeAgo(ad.createdAt)}</span>
                      {ad.boosted && (
                        <span className="flex items-center gap-1 font-semibold text-accent-600">
                          <Zap size={10} /> Boosted
                          {ad.boostedUntil ? ` · ${daysLeft(ad.boostedUntil)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {ad.status === 'pending' || ad.status === 'removed' ? (
                  <div className="mt-2.5 flex items-center gap-2 border-t pt-2.5 hairline">
                    <ShieldAlert
                      size={15}
                      className={
                        ad.status === 'pending'
                          ? 'shrink-0 text-accent-600'
                          : 'shrink-0 text-rose-500'
                      }
                    />
                    <p className="flex-1 text-[11.5px] leading-snug text-muted">
                      {ad.status === 'pending'
                        ? 'Hidden while our team reviews reports about it — usually within 24 hours.'
                        : "Taken down for breaking Bazaar's posting rules. It can't be edited or relisted."}
                    </p>
                    {ad.status === 'removed' && (
                      <button
                        onClick={() => setConfirmDelete(ad.id)}
                        aria-label="Delete ad"
                        className="grid h-8 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : ad.status === 'draft' ? (
                  <div className="mt-2.5 flex gap-1.5 border-t pt-2.5 hairline">
                    <Link
                      to={`/post/${ad.id}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-100 py-2 text-[11.5px] font-bold dark:bg-white/10"
                    >
                      <PenLine size={12} /> Edit draft
                    </Link>
                    <button
                      onClick={() => {
                        if (ad.title.trim().length < 8 || !(ad.price > 0)) {
                          toast('Finish the title and price first', 'error');
                          navigate(`/post/${ad.id}`);
                          return;
                        }
                        updateAd(ad.id, { status: 'active', createdAt: Date.now() });
                        toast('Your ad is live 🎉', 'success', {
                          label: 'View',
                          to: `/ad/${ad.id}`,
                        });
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-[11.5px] font-bold text-white"
                    >
                      <Rocket size={12} /> Publish
                    </button>
                    <button
                      onClick={() => setConfirmDelete(ad.id)}
                      aria-label="Delete ad"
                      className="grid w-9 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 flex gap-1.5 border-t pt-2.5 hairline">
                    <Link
                      to={`/post/${ad.id}`}
                      aria-label="Edit ad"
                      className="grid w-9 place-items-center rounded-lg bg-ink-100 dark:bg-white/10"
                    >
                      <PenLine size={13} />
                    </Link>
                    <button
                      onClick={() => setBoostTarget(ad.id)}
                      disabled={ad.boosted}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-500/12 py-2 text-[11.5px] font-bold text-accent-600 disabled:opacity-40 dark:text-accent-400"
                    >
                      <Sparkles size={12} /> {ad.boosted ? 'Boosted' : 'Boost'}
                    </button>
                    <button
                      onClick={() => {
                        updateAd(ad.id, { status: ad.status === 'sold' ? 'active' : 'sold' });
                        toast(
                          ad.status === 'sold' ? 'Ad is live again' : 'Marked as sold 🎉',
                          'success',
                        );
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-100 py-2 text-[11.5px] font-bold dark:bg-white/10"
                    >
                      {ad.status === 'sold' ? 'Relist' : 'Mark sold'}
                    </button>
                    <button
                      onClick={() => {
                        setNewPrice(String(Math.round((ad.price * 0.92) / 500) * 500));
                        setPriceTarget(ad.id);
                      }}
                      disabled={ad.status === 'sold'}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-100 py-2 text-[11.5px] font-bold disabled:opacity-40 dark:bg-white/10"
                    >
                      <ArrowDownRight size={12} /> Lower price
                    </button>
                    <button
                      onClick={() => setConfirmDelete(ad.id)}
                      aria-label="Delete ad"
                      className="grid w-9 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {mine.length > 0 && (
          <Link
            to="/insights"
            className="mt-1 flex items-center gap-3 rounded-2xl border p-3.5 hairline"
            style={{ background: 'var(--surface)' }}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <BarChart3 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">See your seller insights</span>
              <span className="block text-[11.5px] text-muted">
                Views trend, buyer funnel and what to fix next
              </span>
            </span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        )}

        {mine.length > 0 && (
          <div className="mb-4 mt-2.5 rounded-2xl border border-dashed p-4 hairline">
            <p className="flex items-center gap-1.5 text-[13px] font-bold">
              <Sparkles size={14} className="text-accent-500" /> Sell 3× faster with a boost
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Boosted ads appear at the top of nearby searches and in the “Featured today” rail for{' '}
              {boostDays} days.{' '}
              {paid
                ? `${inr(boostPrice)} via UPI, card or netbanking.`
                : 'Demo only — no real payment is taken.'}
            </p>
          </div>
        )}
      </div>

      <Sheet open={!!boostTarget} onClose={() => setBoostTarget(null)} title="Boost this ad">
        <div className="rounded-2xl bg-gradient-to-br from-accent-500 to-orange-600 p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            {boostDays}-day boost
          </p>
          <p className="mt-1 text-[26px] font-extrabold">{inr(boostPrice)}</p>
          <p className="text-[12px] text-white/80">Featured placement + 3× more views</p>
        </div>
        <ul className="mt-3 space-y-2 text-[12.5px] text-muted">
          <li>• Top of category and search results in your city</li>
          <li>• “Featured” badge that builds buyer trust</li>
          <li>• Weekly performance report in notifications</li>
        </ul>
        <button
          disabled={paying}
          onClick={async () => {
            if (!boostTarget) return;
            if (!paid) {
              boostAd(boostTarget);
              toast(`Boost activated for ${boostDays} days 🚀`, 'success', {
                label: 'View',
                to: '/myads',
              });
              setBoostTarget(null);
              return;
            }
            setPaying(true);
            try {
              const result = await payForBoost(boostTarget);
              if (result === 'paid') {
                toast(`Payment received — boosted for ${boostDays} days 🚀`, 'success');
                setBoostTarget(null);
              }
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Payment failed', 'error');
            } finally {
              setPaying(false);
            }
          }}
          className="btn btn-primary mt-4 w-full"
        >
          <Zap size={16} />{' '}
          {paying
            ? 'Opening secure checkout…'
            : paid
              ? `Pay ${inr(boostPrice)} & boost`
              : 'Activate boost'}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          {paid
            ? 'Secure payment by Razorpay · UPI, cards, netbanking, wallets.'
            : 'Demo checkout · no card required, nothing is charged.'}
        </p>
      </Sheet>

      <Sheet open={!!priceTarget} onClose={() => setPriceTarget(null)} title="Lower the price">
        {priceAd && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">
              Buyers watching{' '}
              <b className="text-[color:var(--text)]">{priceAd.title.slice(0, 40)}</b> get notified
              when the price drops. Ads with a recent price cut sell ~40% faster.
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl border p-3 hairline">
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-muted">Current price</p>
                <p className="text-[18px] font-extrabold">{inr(priceAd.price)}</p>
              </div>
              <ArrowDownRight size={18} className="text-brand-500" />
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-wider text-muted">New price</p>
                <p className="text-[18px] font-extrabold text-brand-600 dark:text-brand-400">
                  {inr(Number(newPrice) || 0)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0.95, 0.9, 0.85, 0.8].map((m) => (
                <button
                  key={m}
                  onClick={() => setNewPrice(String(Math.round((priceAd.price * m) / 500) * 500))}
                  className={cn(
                    'chip flex-1 justify-center px-2 py-2 text-[11.5px]',
                    Number(newPrice) === Math.round((priceAd.price * m) / 500) * 500 && 'chip-on',
                  )}
                >
                  -{Math.round((1 - m) * 100)}%
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">
                ₹
              </span>
              <input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, '').slice(0, 9))}
                inputMode="numeric"
                className="input pl-8 text-[16px] font-bold"
                aria-label="New price"
              />
            </div>
            <button
              disabled={!newPrice || Number(newPrice) >= priceAd.price || Number(newPrice) <= 0}
              onClick={() => {
                dropPrice(priceAd.id, Number(newPrice));
                toast(`Price lowered to ${inr(Number(newPrice))}`, 'success', {
                  label: 'View',
                  to: `/ad/${priceAd.id}`,
                });
                setPriceTarget(null);
              }}
              className="btn btn-primary mt-3 w-full"
            >
              Update price
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this ad?">
        <p className="text-[13px] text-muted">
          This removes the ad, its views and any boosts. Buyers with open chats will still see your
          messages, but the ad link will stop working.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmDelete(null)} className="btn btn-outline flex-1">
            Keep ad
          </button>
          <button
            onClick={() => {
              if (confirmDelete) deleteAd(confirmDelete);
              setConfirmDelete(null);
              toast('Ad deleted', 'info');
            }}
            className="btn flex-1 bg-rose-600 text-white"
          >
            Delete
          </button>
        </div>
      </Sheet>
    </div>
  );
}
