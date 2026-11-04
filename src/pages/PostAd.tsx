import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ImagePlus,
  MapPin,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
  Truck,
  Wand2,
  X,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { EmptyState, Sheet, Spinner, Stepper, Toggle } from '../components/ui';
import { AREAS, CATEGORIES, categoryById, CONDITIONS } from '../lib/data';
import { suggestPrice, suggestTitles, writeDescription } from '../lib/ai';
import { toast, useStore } from '../lib/store';
import type { Ad, CategoryId, Condition } from '../lib/types';
import { cn, compressImage, inr, uid, vibrate } from '../lib/utils';

const STEPS = ['Category', 'Details', 'Location', 'Review'];

export default function PostAd() {
  const navigate = useNavigate();
  const ads = useStore((s) => s.ads);
  const user = useStore((s) => s.user);
  const createAd = useStore((s) => s.createAd);
  const updateAd = useStore((s) => s.updateAd);
  const area = useStore((s) => s.area);

  // Editing an existing ad (e.g. finishing a draft) when the route has an id.
  const { id: editId } = useParams();
  const editing = useMemo(
    () => (editId ? ads.find((a) => a.id === editId && a.sellerId === 'me') : undefined),
    // Only resolve once — later store updates must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editId],
  );

  const [step, setStep] = useState(editing ? 1 : 0);
  const [category, setCategory] = useState<CategoryId | null>(editing?.category ?? null);
  const [catQuery, setCatQuery] = useState('');
  const [images, setImages] = useState<string[]>(editing?.images ?? []);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [price, setPrice] = useState(editing?.price ? String(editing.price) : '');
  const [condition, setCondition] = useState<Condition>(editing?.condition ?? 'good');
  const [attributes, setAttributes] = useState<Record<string, string>>(
    editing?.attributes ?? {},
  );
  const [negotiable, setNegotiable] = useState(editing?.negotiable ?? true);
  const [delivery, setDelivery] = useState(editing?.delivery ?? false);
  const [locality, setLocality] = useState(editing?.area ?? area);
  const [busy, setBusy] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  const [locSheet, setLocSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = categoryById(category ?? undefined);

  const insight = useMemo(
    () =>
      category && Number(price) >= 0
        ? suggestPrice({ title: title || meta?.name || '', category, condition, ads })
        : null,
    [category, title, condition, ads, meta?.name, price],
  );

  const filteredCats = CATEGORIES.filter((c) =>
    catQuery.trim()
      ? (c.name + c.keywords.join(' ') + c.plural).toLowerCase().includes(catQuery.toLowerCase())
      : true,
  );

  const canNext =
    step === 0
      ? !!category
      : step === 1
        ? title.trim().length >= 8 && Number(price) > 0
        : step === 2
          ? !!locality
          : true;

  const next = () => {
    vibrate(8);
    if (!canNext) {
      toast(
        step === 1
          ? title.trim().length < 8
            ? 'Add a title with at least 8 characters'
            : 'Enter an asking price'
          : 'Complete the required fields',
        'error',
      );
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = 6 - images.length;
      const list = Array.from(files).slice(0, Math.max(0, room));
      const compressed = await Promise.all(list.map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...compressed].slice(0, 6));
      toast(`${compressed.length} photo${compressed.length > 1 ? 's' : ''} added`, 'success');
    } catch {
      toast('Could not read that image', 'error');
    } finally {
      setBusy(false);
    }
  };

  const publish = (asDraft = false) => {
    if (!category) return;
    if (!asDraft && (title.trim().length < 8 || !(Number(price) > 0))) {
      toast('Add a title (8+ characters) and a price before publishing', 'error');
      setStep(1);
      return;
    }
    if (editing) {
      const wasDraft = editing.status === 'draft';
      updateAd(editing.id, {
        title: title.trim(),
        description:
          description.trim() ||
          `${title.trim()} in ${condition} condition. Contact me for more details.`,
        price: Number(price) || 0,
        category,
        condition,
        images,
        area: locality,
        negotiable,
        delivery,
        attributes,
        status: asDraft ? 'draft' : editing.status === 'sold' ? 'sold' : 'active',
        // A draft going live counts as freshly posted.
        createdAt: wasDraft && !asDraft ? Date.now() : editing.createdAt,
      });
      vibrate(20);
      if (asDraft) {
        toast('Draft updated', 'info');
        navigate('/myads');
      } else {
        toast(wasDraft ? 'Your ad is live 🎉' : 'Ad updated', 'success');
        navigate(`/ad/${editing.id}`);
      }
      return;
    }
    const id = uid('ad');
    const ad: Ad = {
      id,
      title: title.trim(),
      description:
        description.trim() ||
        `${title.trim()} in ${condition} condition. Contact me for more details.`,
      price: Number(price) || 0,
      category,
      condition,
      images,
      area: locality,
      city: 'Kolkata',
      distanceKm: Math.round(Math.random() * 60) / 10 + 0.4,
      sellerId: 'me',
      createdAt: Date.now(),
      views: 0,
      saves: 0,
      negotiable,
      delivery,
      status: asDraft ? 'draft' : 'active',
      attributes,
    };
    createAd(ad);
    vibrate(20);
    if (asDraft) {
      toast('Saved as draft — finish it anytime from My ads', 'info', {
        label: 'My ads',
        to: '/myads',
      });
      navigate('/myads');
      return;
    }
    toast('Your ad is live 🎉', 'success', { label: 'View ad', to: `/ad/${id}` });
    navigate(`/ad/${id}`);
  };

  if (editId && !editing) {
    return (
      <div className="mx-auto max-w-lg">
        <TopBar back="/myads" title="Edit ad" />
        <EmptyState
          icon={<X size={26} />}
          title="Ad not found"
          body="It may have been deleted, or it belongs to another seller."
          action="Back to My ads"
          onAction={() => navigate('/myads')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back={step === 0 ? '/' : editing && step === 1 ? '/myads' : undefined}
        title={editing ? `Edit ad · ${STEPS[step]}` : STEPS[step]}
        subtitle={`Step ${step + 1} of ${STEPS.length}`}
        right={<Stepper step={step + 1} total={STEPS.length} />}
      />

      <div className="px-4 pb-24 pt-4 lg:pb-8">
        {/* ------------------------------ Step 1: category ------------------------ */}
        {step === 0 && (
          <div className="animate-fade-in">
            <h2 className="text-[22px] font-extrabold tracking-tight">What are you listing?</h2>
            <p className="mt-1 text-[13px] text-muted">
              Pick a category — buyers browse by category, and it unlocks the right fields for you.
            </p>
            <input
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="Search categories…"
              className="input mt-4"
            />
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {filteredCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategory(c.id);
                    setAttributes({});
                    vibrate(6);
                    setStep(1);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[.98] hairline',
                    category === c.id && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
                  )}
                  style={category !== c.id ? { background: 'var(--surface)' } : undefined}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[19px]"
                    style={{ background: `${c.tint}16` }}
                  >
                    {c.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{c.plural}</span>
                    <span className="block truncate text-[10.5px] text-muted">
                      {c.keywords.slice(0, 2).join(', ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {!filteredCats.length && (
              <p className="mt-6 text-center text-[13px] text-muted">
                No category matches “{catQuery}”.
              </p>
            )}
          </div>
        )}

        {/* ------------------------------ Step 2: details ------------------------- */}
        {step === 1 && meta && (
          <div className="animate-fade-in space-y-5">
            {/* photos */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Photos</p>
                <span className="text-[11.5px] text-muted">{images.length}/6 · first is cover</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {images.map((src, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-xl border hairline"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Cover
                      </span>
                    )}
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, x) => x !== i))}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-950/70 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 6 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="grid aspect-square place-items-center rounded-xl border-2 border-dashed text-muted transition active:scale-95 hairline"
                  >
                    {busy ? (
                      <Spinner />
                    ) : (
                      <span className="flex flex-col items-center gap-1">
                        <ImagePlus size={20} />
                        <span className="text-[10.5px] font-semibold">Add photo</span>
                      </span>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => addPhotos(e.target.files)}
              />
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
                <Camera size={11} /> Sharp, well-lit photos sell up to 2× faster. Ads with photos
                get 7× more views.
              </p>
            </div>

            {/* title */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="label mb-0">Title</p>
                <span className="text-[11px] text-muted">{title.length}/70</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 70))}
                placeholder={`e.g. ${meta.name} · brand · year · condition`}
                className="input"
              />
              {suggestTitles(category!, attributes).filter((t) => t && t !== title).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestTitles(category!, attributes)
                    .filter((t) => t && t !== title)
                    .slice(0, 2)
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => setTitle(t.slice(0, 70))}
                        className="chip px-2.5 py-1.5 text-[11px]"
                      >
                        <Sparkles size={10} className="text-accent-500" /> {t.slice(0, 40)}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* category fields */}
            <div className="grid grid-cols-2 gap-2.5">
              {meta.fields.map((f) => (
                <div key={f.key} className={f.options && f.options.length > 4 ? 'col-span-2' : ''}>
                  <p className="label">{f.label}</p>
                  {f.options ? (
                    <select
                      value={attributes[f.key] ?? ''}
                      onChange={(e) => setAttributes((a) => ({ ...a, [f.key]: e.target.value }))}
                      className="input appearance-none py-2.5 text-[13.5px]"
                    >
                      <option value="">Select</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={attributes[f.key] ?? ''}
                      onChange={(e) => setAttributes((a) => ({ ...a, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      inputMode={f.numeric ? 'numeric' : 'text'}
                      className="input py-2.5 text-[13.5px]"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* condition */}
            <div>
              <p className="label">Condition</p>
              <div className="flex flex-wrap gap-1.5">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCondition(c.id)}
                    className={cn('chip', condition === c.id && 'chip-on')}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* price */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="label mb-0">Asking price</p>
                <button
                  onClick={() => setAiSheet(true)}
                  className="flex items-center gap-1 text-[11.5px] font-bold text-brand-600 dark:text-brand-400"
                >
                  <Wand2 size={12} /> AI price check
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
                  ₹
                </span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                  inputMode="numeric"
                  placeholder="0"
                  className="input pl-8 text-[17px] font-bold"
                />
              </div>
              {Number(price) > 0 && (
                <p className="mt-1 text-[11.5px] text-muted">{inr(Number(price))}</p>
              )}
              {insight && insight.mid > 0 && Number(price) > 0 && (
                <div
                  className={cn(
                    'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium',
                    Number(price) <= insight.high && Number(price) >= insight.low
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
                  )}
                >
                  <Sparkles size={13} />
                  {Number(price) <= insight.high && Number(price) >= insight.low
                    ? `Good price — similar ads sell for ${inr(insight.low)}–${inr(insight.high)}`
                    : `Market range is ${inr(insight.low)}–${inr(insight.high)}. Price within it to sell faster.`}
                </div>
              )}
              <label className="mt-3 flex items-center justify-between">
                <span className="text-[13px] font-medium">Price negotiable</span>
                <Toggle checked={negotiable} onChange={setNegotiable} label="Price negotiable" />
              </label>
            </div>

            {/* description */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="label mb-0">Description</p>
                <button
                  onClick={() => {
                    setDescription(
                      writeDescription({
                        category: category!,
                        title,
                        condition:
                          CONDITIONS.find((c) => c.id === condition)?.label.toLowerCase() ?? 'good',
                        area: locality,
                        price: Number(price),
                        attributes,
                      }),
                    );
                    toast('Draft written — give it your own touches', 'info');
                  }}
                  className="flex items-center gap-1 text-[11.5px] font-bold text-brand-600 dark:text-brand-400"
                >
                  <Wand2 size={12} /> Write with AI
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1200))}
                rows={5}
                placeholder="Mention condition, age, what's included, why you're selling…"
                className="input resize-none leading-relaxed"
              />
              <p className="mt-1 text-right text-[11px] text-muted">{description.length}/1200</p>
            </div>
          </div>
        )}

        {/* ------------------------------ Step 3: location ------------------------ */}
        {step === 2 && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-[22px] font-extrabold tracking-tight">Where is it located?</h2>
            <p className="text-[13px] text-muted">
              Buyers filter by neighbourhood, so be as accurate as you're comfortable being.
            </p>
            <button
              onClick={() => setLocSheet(true)}
              className="flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left hairline"
              style={{ background: 'var(--surface)' }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <MapPin size={17} />
              </span>
              <span className="flex-1">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted">
                  Area
                </span>
                <span className="block text-[14px] font-bold">{locality}, Kolkata</span>
              </span>
              <span className="text-[12px] font-bold text-brand-600">Change</span>
            </button>

            <div
              className="rounded-xl border p-3.5 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
                    <Truck size={15} className="text-brand-500" /> Offer delivery / pickup help
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                    Show buyers you can deliver within the city.
                  </p>
                </div>
                <Toggle checked={delivery} onChange={setDelivery} label="Offer delivery" />
              </div>
            </div>

            <div
              className="rounded-xl border p-3.5 hairline"
              style={{ background: 'var(--surface)' }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
                Contact
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] font-bold">
                {user?.name} <BadgeCheck size={14} className="text-brand-500" />
              </p>
              <p className="text-[12px] text-muted">{user?.phone} · verified</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Your number stays hidden until you choose to reveal it. Buyers reach you through
                Bazaar chat first.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------ Step 4: review -------------------------- */}
        {step === 3 && meta && (
          <div className="animate-fade-in space-y-4">
            <div>
              <h2 className="text-[22px] font-extrabold tracking-tight">Review your ad</h2>
              <p className="mt-1 text-[13px] text-muted">
                This is exactly how buyers will see it in search.
              </p>
            </div>

            <div
              className="overflow-hidden rounded-2xl border hairline"
              style={{ background: 'var(--surface)' }}
            >
              <div className="relative aspect-[16/10] bg-ink-100 dark:bg-white/5">
                {images[0] ? (
                  <img src={images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="grid h-full place-items-center"
                    style={{
                      background: `linear-gradient(140deg, ${meta.tint}25, ${meta.tint}05)`,
                    }}
                  >
                    <span className="text-5xl opacity-50">{meta.emoji}</span>
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-1 text-[10px] font-bold uppercase text-ink-800">
                  {meta.name}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[22px] font-extrabold tracking-tight">
                  {inr(Number(price) || 0)}
                </p>
                <p className="mt-0.5 text-[14px] font-semibold">{title || 'Untitled ad'}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {locality}, Kolkata · {CONDITIONS.find((c) => c.id === condition)?.label}
                </p>
                <p className="mt-3 line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">
                  {description || 'No description yet.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Category', value: meta.plural, ok: true },
                { label: 'Photos', value: `${images.length} added`, ok: images.length > 0 },
                { label: 'Title', value: title ? 'Looks good' : 'Missing', ok: !!title },
                { label: 'Price', value: price ? inr(Number(price)) : 'Missing', ok: !!price },
                {
                  label: 'Description',
                  value: description ? `${description.length} chars` : 'Optional',
                  ok: true,
                },
                { label: 'Location', value: `${locality}, Kolkata`, ok: true },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 hairline"
                >
                  <span className="text-[12.5px] text-muted">{r.label}</span>
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                    {r.value}
                    {r.ok ? (
                      <Check size={14} className="text-brand-500" />
                    ) : (
                      <span className="text-rose-500">!</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-brand-50 p-3 text-[11.5px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
              By publishing you agree to Bazaar's posting rules. Ads for prohibited items are
              removed and repeat offenders are banned.
            </div>

            <div className="flex gap-2">
              <button onClick={() => publish(true)} className="btn btn-outline flex-1">
                Save draft
              </button>
              <button onClick={() => publish(false)} className="btn btn-primary flex-[1.6]">
                <Rocket size={17} />{' '}
                {editing && editing.status !== 'draft' ? 'Save changes' : 'Publish ad'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* sticky next */}
      {step < 3 && step !== 0 && (
        <div
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-3xl border-t px-4 py-2.5 backdrop-blur-xl lg:bottom-0"
          style={{
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            borderColor: 'var(--line)',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="btn btn-outline px-4"
            >
              <ArrowLeft size={16} />
            </button>
            <button onClick={next} className="btn btn-primary flex-1">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* AI price sheet */}
      <Sheet open={aiSheet} onClose={() => setAiSheet(false)} title="AI price assistant">
        {insight && insight.mid > 0 ? (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                Suggested range
              </p>
              <p className="mt-1 text-[26px] font-extrabold tracking-tight">
                {inr(insight.low)} – {inr(insight.high)}
              </p>
              <p className="mt-1 text-[12px] text-white/75">
                Based on {insight.comparables.length} comparable ads · {insight.confidence}%
                confidence
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {insight.comparables.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 hairline"
                >
                  <span className="mr-3 min-w-0 truncate text-[12.5px]">{c.title}</span>
                  <span className="shrink-0 text-[12.5px] font-bold">{inr(c.price)}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setPrice(String(insight.mid));
                setAiSheet(false);
                toast(`Price set to ${inr(insight.mid)}`, 'success');
              }}
              className="btn btn-primary mt-4 w-full"
            >
              <Sparkles size={16} /> Use suggested {inr(insight.mid)}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Estimates are guidance only — condition and demand can shift the real number.
            </p>
          </>
        ) : (
          <p className="py-6 text-center text-[13px] text-muted">
            Add a title and category first, then we can compare against live listings.
          </p>
        )}
      </Sheet>

      {/* Location sheet */}
      <Sheet open={locSheet} onClose={() => setLocSheet(false)} title="Select area">
        <div className="grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setLocality(a);
                setLocSheet(false);
              }}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-3 text-left text-[13px] font-medium hairline',
                a === locality && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
              )}
            >
              {a}
              {a === locality && <Check size={15} className="text-brand-600" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
