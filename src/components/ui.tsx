import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn, initials } from '../lib/utils';

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({
  name,
  color = '#0AA98C',
  size = 40,
  ring = false,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white',
        ring && 'ring-2 ring-white/80 dark:ring-ink-900',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(140deg, ${color}, ${shade(color, -22)})`,
        boxShadow: `0 4px 12px -4px ${color}88`,
      }}
    >
      {initials(name)}
    </div>
  );
}

function shade(hex: string, percent: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/* ---------------------------------- Badge --------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'amber' | 'red' | 'blue' | 'dark';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-700 dark:bg-white/10 dark:text-ink-100',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    amber: 'bg-accent-500/15 text-accent-600 dark:text-accent-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    dark: 'bg-ink-900 text-white dark:bg-white dark:text-ink-900',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- Sheet --------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  full?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const scroller = document.getElementById('app-scroll');
    const prev = scroller?.style.overflow ?? '';
    if (scroller) scroller.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (scroller) scroller.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className={cn(
              'absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-t shadow-float',
              full ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-ink-200 dark:bg-white/20" />
              <h3 className="text-[17px] font-bold tracking-tight">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 text-ink-600 active:scale-95 dark:bg-white/10 dark:text-ink-200"
              >
                <X size={17} />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && (
              <div
                className="safe-bottom border-t px-5 py-3"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ SectionHeader ----------------------------- */

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand-600 dark:text-brand-400"
        >
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/* -------------------------------- EmptyState ------------------------------ */

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        {icon}
      </div>
      <h3 className="text-[16px] font-bold">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted">{body}</p>}
      {action && (
        <button onClick={onAction} className="btn btn-primary mt-5 px-5">
          {action}
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Spinner --------------------------------- */

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('animate-spin', className)} size={18} />
);

/* --------------------------------- Toggle --------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-ink-200 dark:bg-white/20',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/* --------------------------------- Stepper -------------------------------- */

export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < step ? 'w-8 bg-brand-500' : 'w-4 bg-ink-200 dark:bg-white/15',
          )}
        />
      ))}
    </div>
  );
}
