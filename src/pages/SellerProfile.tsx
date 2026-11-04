import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  MessageCircle,
  MapPin,
  Star,
  ThumbsUp,
  Clock,
  PenLine,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdCard } from '../components/AdCard';
import { Avatar, EmptyState, Sheet } from '../components/ui';
import { toast, useStore } from '../lib/store';
import { useSeller } from '../lib/hooks';
import { cn, timeAgo } from '../lib/utils';

export default function SellerProfile() {
  const { id } = useParams();
  const seller = useSeller(id ?? 'u1');
  const ads = useStore((s) => s.ads);
  const startChat = useStore((s) => s.startChat);
  const navigate = useNavigate();

  const listings = ads.filter((a) => a.sellerId === seller.id && a.status === 'active');
  const user = useStore((s) => s.user);
  const allReviews = useStore((s) => s.reviews);
  const addReview = useStore((s) => s.addReview);
  const reviews = useMemo(
    () =>
      allReviews.filter((r) => r.sellerId === seller.id).sort((a, b) => b.createdAt - a.createdAt),
    [allReviews, seller.id],
  );
  const avg = reviews.length
    ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
    : seller.rating;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [showAll, setShowAll] = useState(false);

  const message = () => {
    if (!listings[0]) {
      navigate('/search');
      return;
    }
    navigate(`/chats/${startChat(listings[0].id)}`);
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <TopBar back title="Seller profile" />

      <div className="px-4 pt-4 lg:px-6">
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: 'linear-gradient(130deg,#1F2937,#0F3D3A 70%,#067A66)' }}
        >
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <Avatar name={seller.name} color={seller.avatarColor} size={60} ring />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[18px] font-extrabold">
                {seller.name}
                {seller.verified && <BadgeCheck size={17} className="text-brand-200" />}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/70">
                <span className="flex items-center gap-1">
                  <Star size={11} className="fill-accent-400 text-accent-400" /> {avg} ·{' '}
                  {reviews.length || seller.reviews} reviews
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays size={11} /> since {seller.joined}
                </span>
              </p>
            </div>
          </div>
          {seller.bio && (
            <p className="relative mt-3 text-[12px] leading-relaxed text-white/75">{seller.bio}</p>
          )}
          <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-2 backdrop-blur">
            {[
              [listings.length, 'Live ads'],
              [`${seller.responseRate}%`, 'Response'],
              [seller.responseTime.replace('within ', ''), 'Reply time'],
            ].map(([v, l]) => (
              <div key={String(l)} className="text-center">
                <p className="text-[14px] font-extrabold leading-none">{v}</p>
                <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-white/60">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button onClick={message} className="btn btn-primary sm:col-span-1">
            <MessageCircle size={16} /> Message seller
          </button>
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11.5px] text-muted hairline sm:col-span-2">
            <ThumbsUp size={14} className="text-brand-500" />
            Phones verified · responds {seller.responseTime} · member since {seller.joined}
          </div>
        </div>

        <h2 className="mb-2 mt-6 text-[15px] font-bold">Listings by {seller.name.split(' ')[0]}</h2>
        {listings.length === 0 ? (
          <EmptyState
            icon={<MapPin size={24} />}
            title="No live ads"
            body="This seller has no active listings right now."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {listings.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}

        {/* ------------------------------- reviews ------------------------------ */}
        <section className="mt-5">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
                <Star size={15} className="fill-accent-500 text-accent-500" /> Buyer reviews
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {reviews.length} review{reviews.length === 1 ? '' : 's'} · {avg} average
              </p>
            </div>
            {user && user.id !== seller.id && (
              <button
                onClick={() => setReviewOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-[11.5px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
              >
                <PenLine size={12} /> Write a review
              </button>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center hairline">
              <p className="text-[12.5px] font-semibold">No reviews yet</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Be the first to share how this deal went.
              </p>
            </div>
          ) : (
            <div
              className="divide-hair overflow-hidden rounded-2xl border hairline"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-center gap-4 border-b p-3.5 hairline">
                <div className="text-center">
                  <p className="text-[26px] font-extrabold leading-none">{avg}</p>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={10}
                        className={cn(
                          n <= Math.round(avg)
                            ? 'fill-accent-500 text-accent-500'
                            : 'text-ink-200 dark:text-white/20',
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-0.5 text-[9.5px] text-muted">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
                    const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="w-2 text-[9.5px] text-muted">{star}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-accent-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-3 text-right text-[9.5px] text-muted">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {(showAll ? reviews : reviews.slice(0, 3)).map((r) => (
                <div key={r.id} className="p-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.authorName} color="#64748B" size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold">{r.authorName}</p>
                      <p className="flex items-center gap-1 text-[10px] text-muted">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={8}
                            className={cn(
                              n <= r.rating
                                ? 'fill-accent-500 text-accent-500'
                                : 'text-ink-200 dark:text-white/20',
                            )}
                          />
                        ))}
                        <span className="ml-1">{timeAgo(r.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">{r.text}</p>
                </div>
              ))}
              {reviews.length > 3 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full border-t py-2.5 text-[11.5px] font-bold text-brand-600 hairline dark:text-brand-400"
                >
                  {showAll ? 'Show fewer' : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </div>
          )}
        </section>

        <div
          className="mb-6 mt-5 rounded-2xl border p-4 hairline"
          style={{ background: 'var(--surface)' }}
        >
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            <Clock size={14} className="text-brand-500" /> Response behaviour
          </p>
          <div className="mt-2 space-y-2">
            {[
              ['Replies to chats', `${seller.responseRate}%`],
              ['Median reply time', seller.responseTime],
              ['Deals completed', `${Math.max(3, Math.round(seller.reviews * 1.6))}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[12px]">
                <span className="text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Sheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Review ${seller.name.split(' ')[0]}`}
      >
        <p className="text-[12.5px] leading-relaxed text-muted">
          Share how the deal went. Reviews keep the marketplace honest for everyone.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="transition active:scale-90"
            >
              <Star
                size={30}
                className={cn(
                  n <= rating
                    ? 'fill-accent-500 text-accent-500'
                    : 'text-ink-200 dark:text-white/20',
                )}
              />
            </button>
          ))}
        </div>
        <p className="mt-1 text-center text-[11.5px] font-semibold text-muted">
          {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
        </p>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value.slice(0, 400))}
          rows={4}
          placeholder="What went well? Was the item as described?"
          className="input mt-3 resize-none text-[13.5px] leading-relaxed"
        />
        <button
          disabled={reviewText.trim().length < 8}
          onClick={() => {
            if (!user) return;
            addReview({
              sellerId: seller.id,
              authorId: user.id,
              authorName: user.name,
              rating,
              text: reviewText.trim(),
            });
            setReviewOpen(false);
            setReviewText('');
            setRating(5);
            toast('Thanks — your review is live', 'success');
          }}
          className="btn btn-primary mt-3 w-full"
        >
          Post review
        </button>
        <p className="mt-2 text-center text-[10.5px] text-muted">
          Reviews are public and cannot be edited after posting in this demo.
        </p>
      </Sheet>
    </div>
  );
}
