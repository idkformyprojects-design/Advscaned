import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdThumb } from '../components/AdCard';
import { Avatar, EmptyState } from '../components/ui';
import { useStore } from '../lib/store';
import { useSeller } from '../lib/hooks';
import { cn, dayLabel } from '../lib/utils';

export default function Chats() {
  const chats = useStore((s) => s.chats);
  const ads = useStore((s) => s.ads);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    return chats
      .map((c) => {
        const ad = ads.find((a) => a.id === c.adId);
        const last = c.messages[c.messages.length - 1];
        const unread = c.messages.filter((m) => m.senderId !== 'me' && !m.read).length;
        return { chat: c, ad, last, unread };
      })
      .filter((r) => {
        if (!q.trim()) return true;
        const sellerName = r.ad ? '' : '';
        return (
          (r.ad?.title ?? '').toLowerCase().includes(q.toLowerCase()) ||
          (r.last?.text ?? '').toLowerCase().includes(q.toLowerCase()) ||
          sellerName
        );
      })
      .sort((a, b) => b.chat.lastMessageAt - a.chat.lastMessageAt);
  }, [chats, ads, q]);

  const totalUnread = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.senderId !== 'me' && !m.read).length,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        title="Chats"
        subtitle={
          totalUnread
            ? `${totalUnread} unread message${totalUnread > 1 ? 's' : ''}`
            : 'All caught up'
        }
      />

      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            className="input py-2.5 pl-10 text-[13.5px]"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[11.5px] leading-snug text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
          <ShieldCheck size={15} className="shrink-0" />
          Keep payments and conversations on Bazaar. Never share OTPs or pay in advance.
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={26} />}
          title="No conversations yet"
          body="When you message a seller about an ad, the conversation shows up here."
          action="Browse ads"
          onAction={() => window.location.assign('/search')}
        />
      ) : (
        <div className="mt-2 divide-hair">
          {rows.map(({ chat, ad, last, unread }) => (
            <ChatRow
              key={chat.id}
              chatId={chat.id}
              adId={chat.adId}
              sellerId={chat.sellerId}
              unread={unread}
              lastText={last?.text ?? 'Say hello 👋'}
              lastAt={chat.lastMessageAt}
              sold={ad?.status === 'sold'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatRow({
  chatId,
  adId,
  sellerId,
  unread,
  lastText,
  lastAt,
  sold,
}: {
  chatId: string;
  adId: string;
  sellerId: string;
  unread: number;
  lastText: string;
  lastAt: number;
  sold?: boolean;
}) {
  const seller = useSeller(sellerId);
  const ad = useStore((s) => s.ads.find((a) => a.id === adId));
  return (
    <Link
      to={`/chats/${chatId}`}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50/60 dark:hover:bg-white/5"
    >
      <div className="relative">
        <Avatar name={seller.name} color={seller.avatarColor} size={44} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
            {unread}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('truncate text-[14px]', unread ? 'font-bold' : 'font-semibold')}>
            {seller.name}
          </p>
          <span className="shrink-0 text-[10.5px] text-muted">{dayLabel(lastAt)}</span>
        </div>
        <p
          className={cn(
            'mt-0.5 truncate text-[12.5px]',
            unread ? 'font-medium text-[color:var(--text)]' : 'text-muted',
          )}
        >
          {lastText}
        </p>
        {ad && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-6 w-6 overflow-hidden rounded bg-ink-100 dark:bg-white/5">
              <AdThumb ad={ad} />
            </div>
            <span className="truncate text-[10.5px] text-muted">
              {ad.title} {sold && '· Sold'}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
