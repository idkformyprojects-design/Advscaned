import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { AREAS } from '../lib/data';
import { cn, vibrate } from '../lib/utils';
import { Logo } from '../components/AppShell';
import { TopBar } from '../components/TopBar';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useStore((s) => s.login);
  const user = useStore((s) => s.user);
  const area = useStore((s) => s.area);
  const setArea = useStore((s) => s.setArea);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [seconds, setSeconds] = useState(24);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    if (step !== 'otp') return;
    setSeconds(24);
    const t = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a 10-digit mobile number');
      return;
    }
    setError('');
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStep('otp');
      vibrate(10);
      window.setTimeout(() => refs.current[0]?.focus(), 120);
    }, 700);
  };

  const verify = (code = otp.join('')) => {
    if (code.length !== 4) {
      setError('Enter the 4-digit code');
      return;
    }
    setError('');
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStep('name');
    }, 600);
  };

  const finish = () => {
    const finalName = name.trim() || 'Bazaar User';
    login(finalName, `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, area);
    vibrate(16);
    navigate(from, { replace: true });
  };

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 3) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) verify(next.join(''));
  };

  return (
    <div className="flex min-h-full flex-col">
      <TopBar back="/" transparent />
      <div className="mx-auto w-full max-w-md px-5 pb-8">
        {/* Hero */}
        <div
          className="relative mt-1 overflow-hidden rounded-3xl px-5 py-6 text-white"
          style={{ background: 'linear-gradient(140deg,#07211E,#075449 55%,#079B80)' }}
        >
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand-300/25 blur-2xl" />
          <div className="absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl" />
          <div className="relative">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles size={20} />
            </span>
            <h1 className="mt-3 text-[25px] font-extrabold leading-tight tracking-tight">
              {step === 'name' ? 'One last thing' : 'Buy better.\nSell faster.'}
            </h1>
            <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-white/70">
              {step === 'phone' &&
                'Join 12,000+ people trading second-hand in Kolkata. Free to post, free to browse.'}
              {step === 'otp' &&
                `We sent a 4-digit code to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
              {step === 'name' && 'Tell us your name so buyers know who they are dealing with.'}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {step === 'phone' && (
            <div className="animate-fade-in">
              <label className="label">Mobile number</label>
              <div className="flex items-center gap-2">
                <span className="grid h-[50px] place-items-center rounded-xl border px-3 text-[14px] font-semibold hairline">
                  🇮🇳 +91
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                  inputMode="numeric"
                  autoFocus
                  placeholder="98300 12345"
                  className="input flex-1 py-3.5 text-[16px] tracking-wide"
                />
              </div>
              {error && <p className="mt-1.5 text-[12px] font-medium text-rose-600">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={busy}
                className="btn btn-primary mt-4 w-full py-3.5"
              >
                {busy ? 'Sending…' : 'Continue'} <ArrowRight size={17} />
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                Demo mode — no SMS is sent. Use any 10-digit number and code <b>1234</b>.
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="animate-fade-in">
              <label className="label">Enter the 4-digit code</label>
              <div className="flex justify-between gap-2.5">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (refs.current[i] = el)}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                    }}
                    inputMode="numeric"
                    className="input h-16 w-full text-center text-[24px] font-bold"
                  />
                ))}
              </div>
              {error && <p className="mt-1.5 text-[12px] font-medium text-rose-600">{error}</p>}
              <button
                onClick={() => verify()}
                disabled={busy}
                className="btn btn-primary mt-4 w-full py-3.5"
              >
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="mt-3 flex items-center justify-between text-[12px]">
                <button
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-1 font-semibold text-muted"
                >
                  <ChevronLeft size={14} /> Change number
                </button>
                <button
                  disabled={seconds > 0}
                  onClick={() => setSeconds(24)}
                  className="font-semibold text-brand-600 disabled:text-muted"
                >
                  {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
                </button>
              </div>
              <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
                Never share this code with anyone — Bazaar will never call to ask for it.
              </p>
            </div>
          )}

          {step === 'name' && (
            <div className="animate-fade-in">
              <label className="label">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                autoFocus
                placeholder="e.g. Arjun Sen"
                className="input py-3.5 text-[15px]"
              />
              <label className="label mt-4">Your area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="input appearance-none py-3.5 text-[14px]"
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}, Kolkata
                  </option>
                ))}
              </select>
              <button onClick={finish} className="btn btn-primary mt-4 w-full py-3.5">
                Start buying & selling <ArrowRight size={17} />
              </button>
              <p className="mt-3 text-center text-[11px] text-muted">
                By continuing you agree to our Terms of Use and Privacy Policy.
              </p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { icon: ShieldCheck, label: 'Verified users' },
              { icon: MessageSquare, label: 'In-app chat' },
              { icon: Zap, label: 'Instant posting' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl border py-3 hairline"
              >
                <Icon size={17} className="text-brand-600 dark:text-brand-400" />
                <span className="text-center text-[10px] font-semibold leading-tight text-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full py-2 text-center text-[12.5px] font-semibold text-muted"
          >
            Continue browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
}
