import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Camera, MapPin, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

const SLIDES = [
  {
    id: 'nearby',
    kicker: 'Local by design',
    title: 'Everything worth buying is nearby',
    body: 'Cars, phones, furniture, flats and more — from people in your own neighbourhood. Inspect before you pay, skip the courier.',
    accent: 'from-[#0AA98C] to-[#056E5E]',
    icon: MapPin,
    art: 'cards',
  },
  {
    id: 'chat',
    kicker: 'Safe conversations',
    title: 'Chat, offer, agree — in one place',
    body: 'Ask questions, send an offer and settle on a price without sharing your number. Every conversation stays on record.',
    accent: 'from-[#4F46E5] to-[#7C3AED]',
    icon: MessageCircle,
    art: 'chat',
  },
  {
    id: 'sell',
    kicker: 'Free to list',
    title: 'Sell in about 60 seconds',
    body: 'Snap a few photos, let the price assistant suggest a range, and publish. Boosting is optional — posting always costs nothing.',
    accent: 'from-[#F59E0B] to-[#EA580C]',
    icon: Camera,
    art: 'sell',
  },
];

export function Onboarding() {
  const onboarded = useStore((s) => s.onboarded);
  const complete = useStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  if (onboarded) return null;
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = (go?: string) => {
    complete();
    if (go) navigate(go);
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-ink-950 text-white">
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-90 transition-all duration-500',
          slide.accent,
        )}
      />
      <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -right-20 bottom-24 h-64 w-64 rounded-full bg-black/20 blur-3xl" />

      <div className="relative flex items-center justify-between px-5 pt-5">
        <span className="text-[17px] font-extrabold tracking-tight">
          bazaar<span className="text-white/60">.</span>
        </span>
        <button
          onClick={() => finish()}
          className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold backdrop-blur"
        >
          Skip
        </button>
      </div>

      <div className="relative flex flex-1 flex-col justify-end px-5 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
          >
            <Art variant={slide.art} />
            <p className="mt-6 text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/60">
              {slide.kicker}
            </p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[1.08] tracking-tight">
              {slide.title}
            </h1>
            <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/75">
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/35',
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-xl bg-white/10 px-4 py-3 text-[13px] font-semibold backdrop-blur"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish('/login') : setIndex((i) => i + 1))}
              className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-[13.5px] font-bold text-ink-900 shadow-float"
            >
              {last ? 'Get started' : 'Next'} <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/15 pt-3 text-[10.5px] text-white/55">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} /> Verified sellers
          </span>
          <span className="flex items-center gap-1">
            <Sparkles size={12} /> AI price check
          </span>
          <span className="flex items-center gap-1">
            <Camera size={12} /> Free listings
          </span>
        </div>
      </div>
    </div>
  );
}

function Art({ variant }: { variant: string }) {
  if (variant === 'cards') {
    return (
      <div className="relative h-32">
        {[
          { title: 'iPhone 13 · 128 GB', price: '₹34,500', area: 'Ballygunge', rot: '-6deg', x: 0 },
          { title: 'Honda City VX', price: '₹7,85,000', area: 'Salt Lake', rot: '3deg', x: 40 },
        ].map((c) => (
          <div
            key={c.title}
            className="absolute w-[210px] rounded-2xl bg-white/95 p-3 text-ink-900 shadow-float backdrop-blur"
            style={{ transform: `rotate(${c.rot})`, left: c.x, top: c.x ? 26 : 0 }}
          >
            <div className="h-12 w-full rounded-lg bg-gradient-to-br from-ink-100 to-ink-200" />
            <p className="mt-2 text-[13px] font-extrabold">{c.price}</p>
            <p className="truncate text-[11px] font-medium text-ink-500">{c.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-400">
              <MapPin size={9} /> {c.area} · 2 km
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chat') {
    return (
      <div className="space-y-2">
        <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-ink-900 shadow">
          Hi! Is the iPhone still available?
        </div>
        <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white/15 px-3.5 py-2.5 text-[12.5px] font-medium backdrop-blur">
          Yes — battery 89%, box and charger included.
        </div>
        <div className="ml-auto flex max-w-[62%] items-center gap-2 rounded-2xl rounded-br-md bg-ink-900/80 px-3.5 py-2.5 text-[12.5px] font-semibold shadow">
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider">
            Offer
          </span>
          ₹32,000
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-white/60">
          AI price check
        </span>
        <Sparkles size={14} className="text-accent-300" />
      </div>
      <p className="mt-1 text-[22px] font-extrabold tracking-tight">₹29,500 – ₹34,000</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-2/3 rounded-full bg-white" />
      </div>
      <div className="mt-3 flex gap-2">
        {['Battery 89%', 'Boxed', 'Kolkata'].map((t) => (
          <span key={t} className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
