"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { categories, conditions } from "@/lib/config";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { categoryIcon, IconArrow, IconCheck, IconChevronLeft, IconChevronRight, IconClose, IconUpload } from "@/components/icons";

export type WizardData = {
  id?: string;
  title: string;
  category: string;
  condition: string;
  description: string;
  flaws: string;
  provenance: string;
  authenticity: string;
  shippingNotes: string;
  images: string[];
  startAmount: string;
  reserveEnabled: boolean;
  reserveAmount: string;
  shippingCost: string;
  startsInHours: number;
  durationHours: number;
};

const LIBRARY = [
  "watch-1", "watch-2", "watch-3", "watch-4",
  "camera-1", "camera-2", "camera-3",
  "card-1", "card-2",
  "sneaker-1", "sneaker-2",
  "gaming-1", "gaming-2",
  "design-1", "design-2",
  "vinyl-1", "radio-1", "art-1", "art-2",
].map((n) => `/images/lots/${n}.jpg`);

const durationOptions = [
  { value: 72, key: "3 days" },
  { value: 120, key: "5 days" },
  { value: 168, key: "7 days" },
];

const startOptions = [
  { value: 24, key: "tomorrow" },
  { value: 48, key: "in 2 days" },
  { value: 96, key: "in 4 days" },
];

export function ListingWizard({
  initial,
  sellerStatus,
}: {
  initial: WizardData;
  sellerStatus: string;
}) {
  const { dict } = useI18n();
  const s = dict.seller;
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<WizardData>(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const set = (patch: Partial<WizardData>) =>
    setData((d) => ({ ...d, ...patch }));

  const steps = useMemo(
    () => [
      { key: "stepStart", label: s.stepStart },
      { key: "stepCategory", label: s.stepCategory },
      { key: "stepPhotos", label: s.stepPhotos },
      { key: "stepDetails", label: s.stepDetails },
      { key: "stepCondition", label: s.stepCondition },
      { key: "stepProvenance", label: s.stepProvenance },
      { key: "stepPrice", label: s.stepPrice },
      { key: "stepReserve", label: s.stepReserve },
      { key: "stepShipping", label: s.stepShipping },
      { key: "stepPreview", label: s.stepPreview },
    ],
    [s],
  );

  function addPhoto(src: string) {
    if (!src || data.images.includes(src)) return;
    set({ images: [...data.images, src].slice(0, 8) });
  }
  function movePhoto(i: number, dir: -1 | 1) {
    const next = [...data.images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ images: next });
  }

  function validateStep(): string | null {
    if (step === 1 && !data.category) return s.errors.PHOTOS_REQUIRED;
    if (step === 2 && data.images.length === 0) return s.errors.PHOTOS_REQUIRED;
    if (step === 3) {
      if (data.title.trim().length < 6) return s.errors.TITLE_REQUIRED;
      if (data.description.trim().length < 40) return s.errors.DESCRIPTION_REQUIRED;
    }
    if (step === 6) {
      const n = Number(data.startAmount.replace(/[^\d]/g, ""));
      if (!n || n < 10_000) return s.errors.PRICE_REQUIRED;
    }
    return null;
  }

  async function persist(action: "save" | "submit"): Promise<boolean> {
    if (action === "submit") {
      const v = validateFull();
      if (v) {
        setError(v);
        return false;
      }
      if (sellerStatus !== "verified") {
        setError(s.errors.VERIFICATION_REQUIRED);
        return false;
      }
    }
    setBusy(action);
    setError(null);
    try {
      let id = data.id;
      if (!id) {
        const created = await fetch("/api/seller/listings", { method: "POST" }).then((r) => r.json());
        if (!created?.id) throw new Error();
        id = created.id;
        setData((p) => ({ ...p, id: created.id as string }));
      }
      const payload = {
        action,
        title: data.title,
        category: data.category,
        condition: data.condition,
        description: data.description,
        flaws: data.flaws,
        provenance: data.provenance,
        authenticity: data.authenticity,
        shippingNotes: data.shippingNotes,
        images: data.images,
        startAmount: data.startAmount,
        reserveEnabled: data.reserveEnabled,
        reserveAmount: data.reserveAmount,
        shippingCost: data.shippingCost || "0",
        startsInHours: data.startsInHours,
        durationHours: data.durationHours,
      };
      const res = await fetch(`/api/seller/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(s.errors[json.code as keyof typeof s.errors] ?? json.error);
        return false;
      }
      if (action === "save") toast(s.draftSaved, "success");
      return true;
    } catch {
      setError(s.errors.PRICE_REQUIRED);
      return false;
    } finally {
      setBusy(null);
    }
  }

  function validateFull(): string | null {
    if (data.title.trim().length < 6) return s.errors.TITLE_REQUIRED;
    if (data.description.trim().length < 40) return s.errors.DESCRIPTION_REQUIRED;
    if (!data.images.length) return s.errors.PHOTOS_REQUIRED;
    const n = Number(data.startAmount.replace(/[^\d]/g, ""));
    if (!n || n < 10_000) return s.errors.PRICE_REQUIRED;
    return null;
  }

  async function next() {
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    if (step === steps.length - 2) await persist("save");
    setStep((i) => Math.min(i + 1, steps.length - 1));
  }

  async function submit() {
    const ok = await persist("submit");
    if (ok) {
      setDone(true);
      toast(s.submitted, "success");
      setTimeout(() => router.push("/sell"), 900);
    }
  }

  if (done) {
    return (
      <div className="surface success-burst flex flex-col items-center gap-4 p-12 text-center">
        <span className="toast-check grid h-14 w-14 place-items-center rounded-full bg-success text-white">
          <IconCheck size={26} />
        </span>
        <h2 className="font-serif text-2xl">{s.submitted}</h2>
      </div>
    );
  }

  const CatIcon = categoryIcon[data.category as keyof typeof categoryIcon] ?? IconUpload;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Stepper */}
      <nav aria-label="Listing steps" className="hidden lg:block">
        <ol className="sticky top-24 space-y-1">
          {steps.map((st, i) => (
            <li key={st.key}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === step
                    ? "bg-ink font-semibold text-canvas"
                    : i < step
                      ? "text-success hover:bg-soft"
                      : "text-muted-ink hover:bg-soft"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${
                    i === step
                      ? "bg-canvas text-ink"
                      : i < step
                        ? "bg-success-soft text-success"
                        : "bg-soft text-muted"
                  }`}
                >
                  {i < step ? <IconCheck size={13} /> : i + 1}
                </span>
                {st.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div>
        {/* Mobile step indicator */}
        <div className="mb-5 lg:hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-ink">
            <span>{steps[step].label}</span>
            <span>
              {step + 1} / {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-bronze transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="surface p-5 sm:p-7">
          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-oxblood/25 bg-oxblood-soft px-3.5 py-2.5 text-sm font-medium text-oxblood">
              {error}
            </p>
          )}

          {/* 0 Start */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl">List a considered object</h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-ink">
                Take it step by step — category, honest photographs, the story,
                condition and flaws, provenance, pricing and shipping. Everything
                saves as a draft until you submit for review.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: "01", t: "Photograph honestly", b: "Even light, every angle, flaws included." },
                  { n: "02", t: "Name the flaws", b: "Defects described, not hidden." },
                  { n: "03", t: "Ship the same object", b: "After the hammer, exactly as pictured." },
                ].map((c) => (
                  <div key={c.n} className="surface-soft p-4">
                    <span className="medallion medallion-outline text-xs">{c.n}</span>
                    <p className="mt-3 text-sm font-semibold">{c.t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{c.b}</p>
                  </div>
                ))}
              </div>
              {sellerStatus !== "verified" && (
                <div className="rounded-xl border border-amber/30 bg-amber-soft p-4 text-xs text-amber">
                  {sellerStatus === "pending" ? s.pendingBody : s.verificationCtaBody}{" "}
                  <Link href="/sell/verification" className="font-bold underline underline-offset-2">
                    {s.startVerification} →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 1 Category */}
          {step === 1 && (
            <div>
              <h2 className="font-serif text-2xl">{s.stepCategory}</h2>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {categories.map((c) => {
                  const Icon = categoryIcon[c.slug];
                  const active = data.category === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => set({ category: c.slug })}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-xs font-semibold transition-all ${
                        active
                          ? "border-ink bg-ink text-canvas"
                          : "border-line bg-canvas hover:border-bronze-soft"
                      }`}
                    >
                      <Icon size={20} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2 Photos */}
          {step === 2 && (
            <div>
              <h2 className="font-serif text-2xl">{s.stepPhotos}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-ink">{s.photosBody}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input flex-1"
                  placeholder={s.photoUrlPlaceholder}
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
                <button type="button" className="btn btn-outline shrink-0" onClick={() => { addPhoto(photoUrl); setPhotoUrl(""); }}>
                  <IconUpload size={15} /> {s.addUrl}
                </button>
              </div>

              {data.images.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.images.map((img, i) => (
                    <div key={img + i} className="group relative overflow-hidden rounded-lg border border-line">
                      <Image src={img} alt="" width={240} height={240} className="aspect-square w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-2 top-2 badge badge-upcoming">Cover</span>
                      )}
                      <div className="absolute right-2 top-2 flex gap-1">
                        <button type="button" onClick={() => movePhoto(i, -1)} className="icon-btn h-8 w-8 rounded-full bg-canvas/90" aria-label="Move left">
                          <IconChevronLeft size={14} />
                        </button>
                        <button type="button" onClick={() => movePhoto(i, 1)} className="icon-btn h-8 w-8 rounded-full bg-canvas/90" aria-label="Move right">
                          <IconChevronRight size={14} />
                        </button>
                        <button type="button" onClick={() => set({ images: data.images.filter((x) => x !== img) })} className="icon-btn h-8 w-8 rounded-full bg-canvas/90 hover:text-oxblood" aria-label="Remove">
                          <IconClose size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">{s.uploadHint}</p>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {LIBRARY.filter((u) => !data.images.includes(u)).slice(0, 12).map((u) => (
                  <button key={u} type="button" onClick={() => addPhoto(u)} className="relative aspect-square overflow-hidden rounded-md border border-line opacity-80 transition hover:opacity-100">
                    <Image src={u} alt="" width={96} height={96} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3 Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-serif text-2xl">{s.stepDetails}</h2>
              <div>
                <label className="field-label">{s.fTitle}</label>
                <input className="input" value={data.title} onChange={(e) => set({ title: e.target.value })} placeholder={s.fTitlePlaceholder} />
              </div>
              <div>
                <label className="field-label">{s.fDescription}</label>
                <textarea className="input min-h-[9rem] resize-y py-2.5" value={data.description} onChange={(e) => set({ description: e.target.value })} placeholder={s.fDescriptionPlaceholder} />
                <p className="mt-1 text-right text-[0.68rem] text-muted">{data.description.length} chars</p>
              </div>
            </div>
          )}

          {/* 4 Condition */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl">{s.stepCondition}</h2>
              <div>
                <label className="field-label">{s.fCondition}</label>
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((c) => (
                    <button key={c} type="button" onClick={() => set({ condition: c })} className={`chip ${data.condition === c ? "is-active" : ""}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">{s.fFlaws}</label>
                <textarea className="input min-h-[8rem] resize-y py-2.5" value={data.flaws} onChange={(e) => set({ flaws: e.target.value })} placeholder={s.fFlawsPlaceholder} />
              </div>
            </div>
          )}

          {/* 5 Provenance */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl">{s.stepProvenance}</h2>
              <div>
                <label className="field-label">{s.fProvenance}</label>
                <textarea className="input min-h-[6rem] resize-y py-2.5" value={data.provenance} onChange={(e) => set({ provenance: e.target.value })} placeholder={s.fProvenancePlaceholder} />
              </div>
              <div>
                <label className="field-label">{s.fAuthenticity}</label>
                <textarea className="input min-h-[7rem] resize-y py-2.5" value={data.authenticity} onChange={(e) => set({ authenticity: e.target.value })} placeholder={s.fAuthenticityPlaceholder} />
              </div>
            </div>
          )}

          {/* 6 Price */}
          {step === 6 && (
            <div className="max-w-md space-y-5">
              <h2 className="font-serif text-2xl">{s.stepPrice}</h2>
              <div>
                <label className="field-label">{s.fStart}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">Rp</span>
                  <input
                    className="input pl-10 font-mono"
                    inputMode="numeric"
                    value={data.startAmount}
                    onChange={(e) => set({ startAmount: e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") })}
                    placeholder="100.000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7 Reserve */}
          {step === 7 && (
            <div className="max-w-md space-y-5">
              <h2 className="font-serif text-2xl">{s.stepReserve}</h2>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-cream p-4">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--color-bronze-deep)]"
                  checked={data.reserveEnabled}
                  onChange={(e) => set({ reserveEnabled: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold">{s.fReserve}</span>
                  <span className="block text-xs text-muted">{s.fReserveHint}</span>
                </span>
              </label>
              {data.reserveEnabled && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">Rp</span>
                  <input
                    className="input pl-10 font-mono"
                    inputMode="numeric"
                    value={data.reserveAmount}
                    onChange={(e) => set({ reserveAmount: e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") })}
                    placeholder="1.000.000"
                  />
                </div>
              )}
            </div>
          )}

          {/* 8 Shipping + schedule */}
          {step === 8 && (
            <div className="max-w-lg space-y-5">
              <h2 className="font-serif text-2xl">{s.stepShipping}</h2>
              <div>
                <label className="field-label">{s.fShippingCost}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">Rp</span>
                  <input className="input pl-10 font-mono" inputMode="numeric" value={data.shippingCost} onChange={(e) => set({ shippingCost: e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") })} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="field-label">{s.fShippingNotes}</label>
                <textarea className="input min-h-[5rem] resize-y py-2.5" value={data.shippingNotes} onChange={(e) => set({ shippingNotes: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">{s.fSchedule}</label>
                  <div className="select-wrap">
                    <select className="input appearance-none pr-9" value={data.startsInHours} onChange={(e) => set({ startsInHours: Number(e.target.value) })}>
                      {startOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.value}h</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="field-label">{s.fDuration}</label>
                  <div className="select-wrap">
                    <select className="input appearance-none pr-9" value={data.durationHours} onChange={(e) => set({ durationHours: Number(e.target.value) })}>
                      {durationOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.key}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9 Preview */}
          {step === 9 && (
            <div>
              <h2 className="font-serif text-2xl">{s.stepPreview}</h2>
              <p className="mt-1 text-sm text-muted-ink">{s.previewBody}</p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div className="overflow-hidden rounded-card border border-line">
                  {data.images[0] ? (
                    <Image src={data.images[0]} alt="" width={600} height={600} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center bg-soft text-muted">No photo</div>
                  )}
                  {data.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto p-2">
                      {data.images.slice(1).map((img) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={img} src={img} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="eyebrow is-clean">{categories.find((c) => c.slug === data.category)?.label} · {data.condition}</p>
                  <h3 className="mt-2 font-serif text-2xl">{data.title || "Untitled listing"}</h3>
                  <dl className="mt-4 space-y-2 text-sm">
                    <PreviewRow k={s.fStart} v={`Rp ${Number(data.startAmount.replace(/[^\d]/g, "") || 0).toLocaleString("en-ID")}`} />
                    <PreviewRow k={s.fReserve} v={data.reserveEnabled ? `Rp ${Number(data.reserveAmount.replace(/[^\d]/g, "") || 0).toLocaleString("en-ID")}` : s.noReserve} />
                    <PreviewRow k={s.fShippingCost} v={`Rp ${Number(data.shippingCost.replace(/[^\d]/g, "") || 0).toLocaleString("en-ID")}`} />
                  </dl>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-ink">{data.description}</p>
                  {data.flaws && (
                    <p className="mt-3 rounded-lg bg-soft p-3 text-xs leading-relaxed">
                      <strong>{s.fFlaws}:</strong> {data.flaws}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-amber/30 bg-amber-soft p-4 text-xs leading-relaxed text-amber">
                {s.submitBody}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => persist("save")}
              disabled={busy !== null}
            >
              {busy === "save" ? <span className="spinner" style={{ width: 15, height: 15 }} /> : null}
              {s.saveDraft}
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button type="button" className="btn btn-outline" onClick={() => setStep((i) => i - 1)}>
                  {s.back}
                </button>
              )}
              {step < steps.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={next}>
                  {s.next} <IconArrow size={15} className="arrow" />
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy !== null}>
                  {busy === "submit" ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <IconCheck size={16} />}
                  {s.submitReview}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono font-semibold">{v}</dd>
    </div>
  );
}
