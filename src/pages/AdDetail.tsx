import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Eye,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  TrendingDown,
  X,
  Clock,
  Zap,
  Info,
} from 'lucide-react';
import { AdCard, AdThumb, FavoriteButton, priceDrop } from '../components/AdCard';
import { Avatar, Badge, EmptyState, Sheet } from '../components/ui';
import { categoryById, conditionLabel } from '../lib/data';
import { useAdDistance, useSeller } from '../lib/hooks';
import { suggestPrice } from '../lib/ai';
import { toast, useStore } from '../lib/store';
import { cn, inr, priceLabel, shareOrCopy, timeAgo, vibrate } from '../lib/utils';

export default function AdDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ads = useStore((s) => s.ads);
  const user = useStore((s) => s.user);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const incrementViews = useStore((s) => s.incrementViews);
  const markViewed = useStore((s) => s.markViewed);
  const startChat = useStore((s) => s.startChat);
  const sendMessage = useStore((s) => s.sendMessage);
  const chats = useStore((s) => s.chats);
  const reportAd = useStore((s) => s.report);

  const ad = ads.find((a) => a.id === id);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState<null | 'call' | 'offer' | 'report' | 'share' | 'safe'>(null);
  const [offer, setOffer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ad) return;
    markViewed(ad.id);
    incrementViews(ad.id);
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const seller = useSeller(ad?.sellerId ?? 'u1');
  const distance = useAdDistance();

  const insight = useMemo(() => {
    if (!ad) return null;
    return suggestPrice({ title: ad.title, category: ad.category, condition: ad.condition, ads });
  }, [ad, ads]);

  const similar = useMemo(
    () =>
      ad
        ? ads
            .filter((a) => a.id !== ad.id && a.category === ad.category && a.status === 'active')
            .slice(0, 8)
        : [],
    [ad, ads],
  );

  if (!ad || !seller) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={<Info size={26} />}
          title="This ad is no longer available"
          body="It may have been sold or removed by the seller. Here are fresh ads instead."
          action="Browse similar ads"
          onAction={() => navigate('/search')}
        />
        <div className="grid grid-cols-2 gap-3 px-4">
          {ads.slice(0, 4).map((a) => (
            <AdCard key={a.id} ad={a} />
          ))}
        </div>
      </div>
    );
  }

  const cat = categoryById(ad.category);
  const isFav = favorites.includes(ad.id);
  const myChat = chats.find((c) => c.adId === ad.id);
  const unread = myChat?.messages.filter((m) => m.senderId !== 'me' && !m.read).length ?? 0;

  const requireAuth = (fn: () => void) => {
    if (!user) {
      toast('Sign in to contact sellers', 'info');
      navigate('/login', { state: { from: `/ad/${ad.id}` } });
      return;
    }
    fn();
  };

  const openChat = () =>
    requireAuth(() => {
      const chatId = startChat(ad.id);
      navigate(`/chats/${chatId}`);
    });

  const submitOffer = () => {
    const amount = Number(offer.replace(/[^\d]/g, ''));
    if (!amount) return;
    requireAuth(() => {
      const chatId = startChat(ad.id);
      sendMessage(
        chatId,
        `Hi, would you accept ₹${amount.toLocaleString('en-IN')} for this?`,
        'offer',
      );
      setSheet(null);
      setOffer('');
      navigate(`/chats/${chatId}`);
    });
  };

  const priceDiff =
    insight && insight.mid > 0 ? Math.round(((ad.price - insight.mid) / insight.mid) * 100) : 0;
  const drop = priceDrop(ad);

  return (
    <div className="mx-auto max-w-[1280px] pb-[76px] lg:pb-6">
      {/* Overlay top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 mx-auto flex max-w-[1280px] items-start justify-between p-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink-800 shadow-sm backdrop-blur active:scale-90 dark:bg-ink-900/80 dark:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={async () => {
              const r = await shareOrCopy({
                title: ad.title,
                text: `${ad.title} — ${inr(ad.price)} on Bazaar`,
                url: window.location.href,
              });
              toast(
                r === 'copied'
                  ? 'Link copied to clipboard'
                  : r === 'shared'
                    ? 'Shared'
                    : 'Could not share',
                r === 'failed' ? 'error' : 'success',
              );
            }}
            aria-label="Share"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink-800 shadow-sm backdrop-blur active:scale-90 dark:bg-ink-900/80 dark:text-white"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={() => {
              vibrate(10);
              requireAuth(() => {
                const on = toggleFavorite(ad.id);
                toast(on ? 'Saved to favourites' : 'Removed from favourites', 'success', {
                  label: 'View',
                  to: '/favorites',
                });
              });
            }}
            aria-label="Save"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink-800 shadow-sm backdrop-blur active:scale-90 dark:bg-ink-900/80 dark:text-white"
          >
            <Heart size={18} className={cn(isFav && 'fill-rose-500 text-rose-500')} />
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:px-6 lg:pt-6">
        {/* ------------------------------- Gallery ------------------------------- */}
        <div>
          <div className="relative lg:overflow-hidden lg:rounded-2xl">
            <div
              ref={galleryRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                setIdx(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto lg:aspect-[16/11]"
            >
              {(ad.images.length ? ad.images : [null]).map((src, i) => (
                <button
                  key={i}
                  onClick={() => src && setLightbox(i)}
                  aria-label={`View photo ${i + 1}`}
                  className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-ink-100 text-left lg:h-full dark:bg-white/5"
                >
                  {src ? (
                    <img
                      src={src}
                      alt={`${ad.title} ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="grid h-full w-full place-items-center"
                      style={{
                        background: `linear-gradient(140deg, ${cat?.tint}25, ${cat?.tint}05)`,
                      }}
                    >
                      <span className="text-6xl opacity-50">{cat?.emoji}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {ad.images.length > 1 && (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {ad.images.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50',
                      )}
                    />
                  ))}
                </div>
                <span className="absolute bottom-3 right-3 rounded-md bg-ink-950/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  {idx + 1}/{ad.images.length}
                </span>
              </>
            )}
            {ad.featured && (
              <span className="absolute left-3 top-16 inline-flex items-center gap-1 rounded-md bg-accent-500 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-900 shadow lg:top-3">
                <Sparkles size={11} /> Featured
              </span>
            )}
          </div>

          {/* ------------------------------ Main info ----------------------------- */}
          <div className="px-4 pt-4 lg:px-0 lg:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">
                    {priceLabel(ad)}
                  </h1>
                  {ad.negotiable && ad.category !== 'jobs' && (
                    <span className="rounded-md bg-brand-50 px-1.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      Negotiable
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-[16px] font-semibold leading-snug text-ink-700 dark:text-ink-100">
                  {ad.title}
                </h2>
                {drop && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <TrendingDown size={12} />
                    Price reduced {inr(drop.from - ad.price)} ({drop.pct}%) · was {inr(drop.from)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {ad.area}, {ad.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {timeAgo(ad.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {ad.views.toLocaleString('en-IN')} views
                  </span>
                  <button
                    onClick={() => setSheet('report')}
                    className="flex items-center gap-1 font-medium text-ink-400 hover:text-rose-500"
                  >
                    <Flag size={11} /> Report
                  </button>
                </div>
              </div>
            </div>

            {/* quick facts */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{conditionLabel(ad.condition)}</Badge>
              {cat && (
                <Badge tone="brand">
                  {cat.emoji} {cat.name}
                </Badge>
              )}
              {ad.delivery && (
                <Badge tone="blue">
                  <Truck size={11} /> Delivery
                </Badge>
              )}
              {ad.status === 'sold' && <Badge tone="red">Sold</Badge>}
              {Object.entries(ad.attributes)
                .slice(0, 3)
                .map(([k, v]) => (
                  <Badge key={k} tone="neutral">
                    {cat?.fields.find((f) => f.key === k)?.label ?? k}: {v}
                  </Badge>
                ))}
            </div>

            {ad.sellerId === 'me' && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed p-2.5 hairline">
                <Badge tone="brand">Your ad</Badge>
                <span className="text-[11.5px] text-muted">
                  This is how buyers see your listing.
                </span>
                <Link
                  to="/myads"
                  className="ml-auto text-[11.5px] font-bold text-brand-600 dark:text-brand-400"
                >
                  Manage →
                </Link>
              </div>
            )}

            {/* --------------------------- Price insight -------------------------- */}
            {insight && insight.mid > 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-200/70 bg-brand-50/70 p-3 dark:border-brand-500/25 dark:bg-brand-500/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                  <TrendingDown size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-brand-900 dark:text-brand-200">
                    {Math.abs(priceDiff) < 5
                      ? 'Priced in line with similar ads'
                      : priceDiff < 0
                        ? `${Math.abs(priceDiff)}% below similar ads`
                        : `${priceDiff}% above similar ads`}
                  </p>
                  <p className="text-[11.5px] leading-snug text-brand-800/80 dark:text-brand-300/80">
                    Typical range {inr(insight.low)} – {inr(insight.high)} · {insight.confidence}%
                    confidence
                  </p>
                </div>
                <button
                  onClick={() => setSheet('safe')}
                  className="shrink-0 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-bold text-brand-800 dark:bg-white/10 dark:text-brand-200"
                >
                  Why?
                </button>
              </div>
            )}

            {/* ---------------------------- Description --------------------------- */}
            <section className="mt-5">
              <h3 className="mb-1.5 text-[14px] font-bold">Description</h3>
              <p
                className={cn(
                  'whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600 dark:text-ink-200',
                  !expanded && 'line-clamp-4',
                )}
              >
                {ad.description}
              </p>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 text-[12.5px] font-bold text-brand-600 dark:text-brand-400"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            </section>

            {/* ---------------------------- Specifications ------------------------ */}
            {Object.keys(ad.attributes).length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-[14px] font-bold">Details</h3>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {Object.entries(ad.attributes).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-xl border px-3 py-2.5 hairline"
                      style={{ background: 'var(--surface)' }}
                    >
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
                        {cat?.fields.find((f) => f.key === k)?.label ?? k}
                      </p>
                      <p className="mt-0.5 text-[13.5px] font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ------------------------------- Location --------------------------- */}
            <section className="mt-5">
              <h3 className="mb-2 text-[14px] font-bold">Location</h3>
              <Link
                to={`/search?q=${encodeURIComponent(ad.area)}`}
                className="relative block overflow-hidden rounded-2xl border hairline"
              >
                <div
                  className="relative h-32"
                  style={{
                    background:
                      'linear-gradient(0deg, rgba(10,169,140,.07), rgba(10,169,140,.07)), repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 44px), var(--surface-2)',
                  }}
                >
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                    <span className="grid h-10 w-10 place-items-center rounded-full rounded-bl-none bg-brand-600 text-white shadow-float">
                      <MapPin size={18} />
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/40 to-transparent p-3 text-white">
                    <span className="text-[12.5px] font-semibold">
                      {ad.area}, {ad.city} · {distance(ad)} km away
                    </span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </Link>
            </section>

            {/* ------------------------------ Seller card ------------------------- */}
            <section className="mt-5 lg:hidden">
              <h3 className="mb-2 text-[14px] font-bold">Seller</h3>
              <SellerCard seller={seller} />
            </section>

            {/* ------------------------------ Safety tips ------------------------- */}
            <section
              className="mt-5 rounded-2xl border p-3.5 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-600 dark:text-brand-400" />
                <p className="text-[13px] font-bold">Stay safe while you trade</p>
              </div>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
                <li>• Meet at a public place and inspect the item in person.</li>
                <li>• Never pay an advance before seeing what you're buying.</li>
                <li>• Never share OTPs, UPI PINs or bank details.</li>
                <li>• Use Bazaar chats so conversations stay on record.</li>
              </ul>
            </section>

            {/* ------------------------------ Similar ads ------------------------- */}
            {similar.length > 0 && (
              <section className="mt-7 lg:mt-8">
                <h3 className="mb-3 text-[15px] font-bold tracking-tight">Similar ads nearby</h3>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
                  {similar.map((a) => (
                    <div key={a.id} className="w-[62%] shrink-0 sm:w-[40%] lg:w-auto">
                      <AdCard ad={a} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ------------------------------ Desktop rail ------------------------------ */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-3">
            <div className="card p-4">
              <SellerCard seller={seller} />
              <div className="mt-3 grid gap-2">
                <button onClick={openChat} className="btn btn-primary w-full">
                  <MessageCircle size={17} /> Chat with seller
                  {unread > 0 && (
                    <span className="rounded-full bg-white/25 px-1.5 text-[11px]">{unread}</span>
                  )}
                </button>
                <button onClick={() => setSheet('call')} className="btn btn-outline w-full">
                  <Phone size={16} /> Show phone number
                </button>
                <button onClick={() => setSheet('offer')} className="btn btn-soft w-full">
                  <Zap size={16} /> Make an offer
                </button>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-[12.5px] font-bold">Safety first</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                Pay only after inspection. Bazaar never asks for OTPs, deposits or gift cards.
              </p>
              <button
                onClick={() => setSheet('safe')}
                className="mt-2 text-[11.5px] font-bold text-brand-600"
              >
                Read safe trading guide →
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* --------------------------- Sticky mobile bar --------------------------- */}
      <div
        className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-md border-t px-3 py-2.5 backdrop-blur-xl lg:hidden"
        style={{
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          borderColor: 'var(--line)',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex gap-2">
          <button onClick={() => setSheet('call')} className="btn btn-outline flex-1 py-3">
            <Phone size={16} /> Call
          </button>
          <button onClick={() => setSheet('offer')} className="btn btn-outline flex-1 py-3">
            <Zap size={16} /> Offer
          </button>
          <button onClick={openChat} className="btn btn-primary flex-[1.4] py-3">
            <MessageCircle size={16} /> Chat
          </button>
        </div>
      </div>

      {/* ------------------------------- Lightbox ------------------------------- */}
      {lightbox !== null && ad.images[lightbox] && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-ink-950/95 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-[13px] font-semibold">
              {lightbox + 1} / {ad.images.length}
            </span>
            <button
              onClick={() => setLightbox(null)}
              aria-label="Close photo"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15"
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="no-scrollbar flex flex-1 snap-x snap-mandatory items-center overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              setLightbox(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {ad.images.map((src, i) => (
              <div
                key={i}
                className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2"
              >
                <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
              </div>
            ))}
          </div>
          <p className="p-4 text-center text-[11.5px] text-white/50">Swipe for more photos</p>
        </div>
      )}

      {/* -------------------------------- Sheets -------------------------------- */}
      <Sheet open={sheet === 'call'} onClose={() => setSheet(null)} title="Contact seller">
        <div className="flex flex-col items-center pb-2">
          <Avatar name={seller.name} color={seller.avatarColor} size={64} />
          <p className="mt-2 text-[15px] font-bold">{seller.name}</p>
          <p className="text-[12px] text-muted">
            Usually replies {seller.responseTime} · {seller.responseRate}% response rate
          </p>
          <div className="mt-4 w-full rounded-xl border p-3 text-center hairline">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Phone</p>
            <p className="mt-1 text-[18px] font-extrabold tracking-wider">
              {revealed ? seller.phone : '+91 98••• ••••2'}
            </p>
          </div>
          <a
            href={`tel:${seller.phone.replace(/\s/g, '')}`}
            onClick={(e) => {
              if (!revealed) {
                e.preventDefault();
                setRevealed(true);
                toast('Number revealed — call after 9am for best response', 'info');
              }
            }}
            className="btn btn-primary mt-3 w-full"
          >
            <Phone size={17} /> {revealed ? 'Call now' : 'Reveal number'}
          </a>
          <button onClick={openChat} className="btn btn-outline mt-2 w-full">
            <MessageCircle size={16} /> Message instead
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
            By calling you agree not to spam. Bazaar masks numbers to protect sellers.
          </p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'offer'} onClose={() => setSheet(null)} title="Make an offer">
        <p className="text-[13px] text-muted">
          Asking price is{' '}
          <span className="font-bold text-[color:var(--text)]">{inr(ad.price)}</span>. Sellers
          respond better to offers close to the asking price.
        </p>
        <div className="mt-4">
          <label className="label">Your offer</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
              ₹
            </span>
            <input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              inputMode="numeric"
              placeholder={String(Math.round(ad.price * 0.92))}
              className="input pl-8 text-[16px] font-semibold"
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {[0.95, 0.9, 0.85, 0.8].map((m) => (
              <button
                key={m}
                onClick={() => setOffer(String(Math.round(ad.price * m)))}
                className="chip px-3 py-1.5 text-[11.5px]"
              >
                {inr(Math.round(ad.price * m))}
              </button>
            ))}
          </div>
        </div>
        <button onClick={submitOffer} disabled={!offer} className="btn btn-primary mt-4 w-full">
          Send offer
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          The seller can accept, counter or decline — all inside chat.
        </p>
      </Sheet>

      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="Report this ad">
        <div className="space-y-1.5">
          {[
            'Item already sold',
            'Wrong category',
            'Suspected scam',
            'Prohibited item',
            'Duplicate ad',
          ].map((r) => (
            <button
              key={r}
              onClick={() => {
                reportAd('ad', ad.id, r);
                setSheet(null);
                toast('Thanks — our trust team will review this ad', 'success');
              }}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline"
            >
              {r} <ChevronRight size={15} className="text-muted" />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'safe'} onClose={() => setSheet(null)} title="How we price-check">
        <p className="text-[13px] leading-relaxed text-muted">
          Our price insights compare this ad against {insight?.comparables.length ?? 0}+ similar
          live listings in Kolkata, adjusting for condition, age and demand. It is a guide, not a
          valuation — always inspect the item before paying.
        </p>
        <div className="mt-3 space-y-2">
          {insight?.comparables.map((c) => (
            <Link
              key={c.id}
              to={`/ad/${c.id}`}
              onClick={() => setSheet(null)}
              className="flex items-center gap-2.5 rounded-xl border p-2 hairline"
            >
              <div className="h-11 w-11 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5">
                <AdThumb ad={c} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">{c.title}</p>
                <p className="text-[11.5px] text-muted">
                  {inr(c.price)} · {c.area}
                </p>
              </div>
              <ChevronRight size={14} className="text-muted" />
            </Link>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-brand-50 p-3 text-[11.5px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
          Tip: listings priced within 5% of the market median sell 2.4× faster on Bazaar.
        </div>
      </Sheet>
    </div>
  );
}

function SellerCard({ seller }: { seller: ReturnType<typeof useSeller> }) {
  return (
    <Link
      to={`/seller/${seller.id}`}
      className="flex items-center gap-3 rounded-2xl border p-3 transition hover:shadow-card hairline"
      style={{ background: 'var(--surface)' }}
    >
      <Avatar name={seller.name} color={seller.avatarColor} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[14px] font-bold">{seller.name}</p>
          {seller.verified && <BadgeCheck size={15} className="shrink-0 text-brand-500" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span className="flex items-center gap-0.5 font-semibold text-ink-700 dark:text-ink-100">
            <Star size={11} className="fill-accent-500 text-accent-500" /> {seller.rating}
          </span>
          <span>({seller.reviews} reviews)</span>
          <span className="flex items-center gap-0.5">
            <CalendarDays size={10} /> since {seller.joined}
          </span>
        </div>
        <p className="mt-0.5 text-[10.5px] text-muted">Replies {seller.responseTime}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </Link>
  );
}
