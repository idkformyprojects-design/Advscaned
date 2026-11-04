import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Ban,
  BadgeCheck,
  ChevronRight,
  Flag,
  ImagePlus,
  Info,
  MoreVertical,
  Send,
  ShieldAlert,
  Tag,
  Zap,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdThumb } from '../components/AdCard';
import { Avatar, EmptyState, Sheet } from '../components/ui';
import { toast, useStore } from '../lib/store';
import { useSeller } from '../lib/hooks';
import { quickReplies } from '../lib/ai';
import { cn, clockTime, inr, vibrate } from '../lib/utils';

export default function ChatThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const chat = useStore((s) => s.chats.find((c) => c.id === id));
  const ads = useStore((s) => s.ads);
  const sendMessage = useStore((s) => s.sendMessage);
  const markChatRead = useStore((s) => s.markChatRead);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offer, setOffer] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const blockSeller = useStore((s) => s.blockSeller);
  const unblockSeller = useStore((s) => s.unblockSeller);
  const report = useStore((s) => s.report);
  const blocked = useStore((s) => (chat ? s.blockedSellers.includes(chat.sellerId) : false));
  const endRef = useRef<HTMLDivElement>(null);

  const seller = useSeller(chat?.sellerId ?? 'u1');
  const ad = ads.find((a) => a.id === chat?.adId);

  useEffect(() => {
    if (chat) markChatRead(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, chat?.messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat?.messages.length, typing]);

  if (!chat) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={<Info size={26} />}
          title="Conversation not found"
          body="This chat may have been removed."
          action="Back to chats"
          onAction={() => navigate('/chats')}
        />
      </div>
    );
  }

  const send = (value?: string) => {
    const msg = (value ?? text).trim();
    if (!msg) return;
    sendMessage(chat.id, msg);
    setText('');
    vibrate(8);
    setTyping(true);
    window.setTimeout(() => setTyping(false), 2600);
  };

  const sendOffer = () => {
    const amt = Number(offer.replace(/\D/g, ''));
    if (!amt) return;
    sendMessage(
      chat.id,
      `I'd like to offer ₹${amt.toLocaleString('en-IN')} — is that workable?`,
      'offer',
    );
    setOfferOpen(false);
    setOffer('');
    setTyping(true);
    window.setTimeout(() => setTyping(false), 2600);
  };

  let lastDay = '';

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] top-0 z-30 mx-auto flex max-w-3xl flex-col bg-[color:var(--canvas)] lg:bottom-0 lg:top-16">
      <TopBar
        back="/chats"
        title={
          <span className="flex items-center gap-1.5">
            {seller.name}
            {seller.verified && <BadgeCheck size={14} className="text-brand-500" />}
          </span>
        }
        subtitle={typing ? 'typing…' : `Replies ${seller.responseTime}`}
        right={
          <button
            onClick={() => setMenu(true)}
            aria-label="Chat options"
            className="grid h-9 w-9 place-items-center rounded-full active:bg-ink-100 dark:active:bg-white/10"
          >
            <MoreVertical size={18} />
          </button>
        }
      />

      {/* ad context */}
      {ad && (
        <Link
          to={`/ad/${ad.id}`}
          className="flex items-center gap-2.5 border-b px-4 py-2.5 transition hover:bg-ink-50 dark:hover:bg-white/5"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="h-10 w-10 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5">
            <AdThumb ad={ad} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">{ad.title}</p>
            <p className="text-[11.5px] text-muted">
              {inr(ad.price)} · {ad.area}
            </p>
          </div>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      )}

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <div className="mx-auto mb-3 flex max-w-sm items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[11px] leading-snug text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
          <ShieldAlert size={14} className="shrink-0" />
          Never pay in advance. Inspect the item and meet in a public place.
        </div>

        {chat.messages.map((m) => {
          const mine = m.senderId === 'me';
          const day = new Date(m.createdAt).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <p className="my-3 text-center text-[10.5px] font-semibold uppercase tracking-widest text-muted">
                  {new Date(m.createdAt).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              )}
              <div className={cn('flex items-end gap-1.5', mine ? 'justify-end' : 'justify-start')}>
                {!mine && <Avatar name={seller.name} color={seller.avatarColor} size={24} />}
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug shadow-sm',
                    mine
                      ? 'rounded-br-md bg-brand-600 text-white'
                      : 'rounded-bl-md border text-[color:var(--text)] hairline',
                  )}
                  style={!mine ? { background: 'var(--surface)' } : undefined}
                >
                  {m.kind === 'offer' && (
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <Tag size={11} /> Offer
                    </span>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p
                    className={cn(
                      'mt-1 text-right text-[10px]',
                      mine ? 'text-white/60' : 'text-muted',
                    )}
                  >
                    {clockTime(m.createdAt)}
                    {mine && m.read && ' ✓'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex items-end gap-1.5">
            <Avatar name={seller.name} color={seller.avatarColor} size={24} />
            <div
              className="flex items-center gap-1 rounded-2xl rounded-bl-md border px-3.5 py-3 hairline"
              style={{ background: 'var(--surface)' }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* quick replies + composer */}
      {blocked ? (
        <div
          className="border-t px-4 py-3 text-center text-[12.5px] text-muted"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          You blocked this seller.{' '}
          <button
            onClick={() => unblockSeller(chat.sellerId)}
            className="font-bold text-brand-600 dark:text-brand-400"
          >
            Unblock
          </button>
        </div>
      ) : (
      <div
        className="border-t px-3 pb-2 pt-2 backdrop-blur-xl"
        style={{
          borderColor: 'var(--line)',
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {quickReplies(ad?.title ?? 'this item').map((r) => (
            <button key={r} onClick={() => send(r)} className="chip px-3 py-1.5 text-[11.5px]">
              {r}
            </button>
          ))}
          <button
            onClick={() => setOfferOpen(true)}
            className="chip px-3 py-1.5 text-[11.5px] font-semibold text-brand-700 dark:text-brand-300"
          >
            <Zap size={11} /> Make offer
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="More"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200"
          >
            <ImagePlus size={18} />
          </button>
          <div className="flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              className="input rounded-full py-2.5 text-[14px]"
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition active:scale-90 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </form>
      </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Chat options">
        <div className="space-y-1.5">
          {ad && (
            <Link
              to={`/ad/${ad.id}`}
              onClick={() => setMenu(false)}
              className="flex items-center justify-between rounded-xl border px-3.5 py-3 text-[13.5px] font-medium hairline"
            >
              View ad <ChevronRight size={15} className="text-muted" />
            </Link>
          )}
          <Link
            to={`/seller/${chat.sellerId}`}
            onClick={() => setMenu(false)}
            className="flex items-center justify-between rounded-xl border px-3.5 py-3 text-[13.5px] font-medium hairline"
          >
            View seller profile <ChevronRight size={15} className="text-muted" />
          </Link>
          <button
            onClick={() => {
              setMenu(false);
              setOfferOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline"
          >
            Send an offer <Tag size={15} className="text-brand-500" />
          </button>
          <button
            onClick={() => {
              setMenu(false);
              setReportOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline"
          >
            Report seller <Flag size={15} className="text-muted" />
          </button>
          {blocked ? (
            <button
              onClick={() => {
                setMenu(false);
                unblockSeller(chat.sellerId);
                toast(`${seller.name.split(' ')[0]} unblocked`, 'info');
              }}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline"
            >
              Unblock seller <Ban size={15} className="text-muted" />
            </button>
          ) : (
            <button
              onClick={() => {
                setMenu(false);
                setBlockOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium text-rose-600 hairline"
            >
              Block seller <Ban size={15} />
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report seller">
        <p className="mb-3 text-[12.5px] text-muted">
          Reports are private — {seller.name.split(' ')[0]} won't be told who reported them.
        </p>
        <div className="space-y-1.5">
          {[
            'Asked for advance payment',
            'Asked for OTP or UPI PIN',
            'Fake or misleading item',
            'Abusive or harassing messages',
            'Spam',
          ].map((reason) => (
            <button
              key={reason}
              onClick={() => {
                report('seller', chat.sellerId, reason);
                setReportOpen(false);
                toast('Thanks — our trust team will review this within 24h', 'success');
                setBlockOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline"
            >
              {reason} <ChevronRight size={15} className="text-muted" />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={blockOpen && !blocked}
        onClose={() => setBlockOpen(false)}
        title={`Block ${seller.name.split(' ')[0]}?`}
      >
        <p className="text-[13px] leading-relaxed text-muted">
          You won't receive messages from this seller and their ads will be hidden from your
          searches. You can unblock them anytime from Account.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setBlockOpen(false)} className="btn btn-outline flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              blockSeller(chat.sellerId);
              setBlockOpen(false);
              toast(`${seller.name.split(' ')[0]} blocked`, 'info');
              navigate('/chats');
            }}
            className="btn flex-1 bg-rose-600 text-white"
          >
            Block
          </button>
        </div>
      </Sheet>

      <Sheet open={offerOpen} onClose={() => setOfferOpen(false)} title="Send an offer">
        <p className="text-[13px] text-muted">
          {ad ? `Asking price ${inr(ad.price)}.` : ''} Offers within 10% get the best responses.
        </p>
        <div className="relative mt-3">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            ₹
          </span>
          <input
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            inputMode="numeric"
            className="input pl-8 text-[16px] font-bold"
            placeholder={ad ? String(Math.round(ad.price * 0.92)) : '0'}
          />
        </div>
        <button onClick={sendOffer} className="btn btn-primary mt-3 w-full">
          Send offer
        </button>
      </Sheet>
    </div>
  );
}
