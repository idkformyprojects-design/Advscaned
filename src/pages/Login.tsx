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
import { api, apiEnabled, ApiError, setToken, type RemoteMe } from '../lib/api';
import { completeSignIn } from '../lib/sync';
import { backend, loadFirebase } from '../lib/backend';
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
  const [devCode, setDevCode] = useState<string | null>(null);
  const [session, setSession] = useState<{ token: string; user: RemoteMe } | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const google = backend === 'firebase';
  // Holds the redirect while a brand-new Google account picks its name and area.
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (user && !hold) navigate(from, { replace: true });
  }, [user, hold, from, navigate]);

  const googleSignIn = async () => {
    setError('');
    setBusy(true);
    setHold(true);
    try {
      const fb = await loadFirebase();
      const res = await fb.signInWithGoogle();
      if (res?.isNew) {
        setName(fb.currentUserName());
        setStep('name');
        return;
      }
      setHold(false);
    } catch (e) {
      setHold(false);
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/network-request-failed'
          ? "Can't reach Google right now — check your connection"
          : code === 'auth/user-disabled'
            ? 'This account has been suspended. Contact support if you think this is a mistake.'
            : "Google sign-in didn't work — please try again",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'otp') return;
    setSeconds(24);
    const t = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  const errorText = (e: unknown) =>
    e instanceof ApiError ? e.message : 'Something went wrong — please try again';

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a 10-digit mobile number');
      return;
    }
    setError('');
    setBusy(true);
    if (apiEnabled) {
      try {
        const res = await api.requestOtp(phone);
        setDevCode(res.devCode ?? null);
        setOtp(['', '', '', '']);
        setStep('otp');
        vibrate(10);
        window.setTimeout(() => refs.current[0]?.focus(), 120);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    window.setTimeout(() => {
      setBusy(false);
      setStep('otp');
      vibrate(10);
      window.setTimeout(() => refs.current[0]?.focus(), 120);
    }, 700);
  };

  const verify = async (code = otp.join('')) => {
    if (code.length !== 4) {
      setError('Enter the 4-digit code');
      return;
    }
    if (busy) return;
    setError('');
    setBusy(true);
    if (apiEnabled) {
      try {
        const res = await api.verifyOtp(phone, code);
        if (!res.isNew && res.user.name) {
          // Returning user — straight in.
          await completeSignIn(res.token, res.user);
          vibrate(16);
          navigate(from, { replace: true });
          return;
        }
        setSession(res);
        setName(res.user.name);
        setStep('name');
      } catch (e) {
        setError(errorText(e));
        setOtp(['', '', '', '']);
        window.setTimeout(() => refs.current[0]?.focus(), 60);
      } finally {
        setBusy(false);
      }
      return;
    }
    window.setTimeout(() => {
      setBusy(false);
      setStep('name');
    }, 600);
  };

  const finish = async () => {
    const finalName = name.trim() || 'Bazaar User';
    if (google) {
      setBusy(true);
      try {
        await (await loadFirebase()).saveProfile(finalName, area);
        vibrate(16);
        setHold(false);
        navigate(from, { replace: true });
      } catch {
        setError("Couldn't save your profile — please try again");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (apiEnabled && session) {
      setBusy(true);
      try {
        setToken(session.token);
        const { user: me } = await api.updateMe({ name: finalName, area });
        await completeSignIn(session.token, me);
        vibrate(16);
        navigate(from, { replace: true });
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
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
          {step === 'phone' && google && (
            <div className="animate-fade-in">
              <button
                onClick={googleSignIn}
                disabled={busy}
                className="btn w-full justify-center gap-2.5 border bg-white py-3.5 text-[14.5px] font-semibold text-slate-800 hairline dark:bg-white/95"
              >
                <GoogleMark />
                {busy ? 'Opening Google…' : 'Continue with Google'}
              </button>
              {error && <p className="mt-2 text-[12px] font-medium text-rose-600">{error}</p>}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                We only use your Google name and email to create your account. Your email is never
                shown to other users.
              </p>
            </div>
          )}

          {step === 'phone' && !google && (
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
                {apiEnabled ? (
                  "We'll text you a 4-digit code to confirm it's you."
                ) : (
                  <>
                    Demo mode — no SMS is sent. Use any 10-digit number and code <b>1234</b>.
                  </>
                )}
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
              {devCode && (
                <p className="mt-2 text-[11.5px] text-muted">
                  Test server — your code is <b>{devCode}</b>
                </p>
              )}
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
                  onClick={() => {
                    setSeconds(24);
                    if (apiEnabled) void sendOtp();
                  }}
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
              {error && <p className="mt-1.5 text-[12px] font-medium text-rose-600">{error}</p>}
              <button
                onClick={finish}
                disabled={busy}
                className="btn btn-primary mt-4 w-full py-3.5"
              >
                {busy ? 'Setting up…' : 'Start buying & selling'} <ArrowRight size={17} />
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

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
