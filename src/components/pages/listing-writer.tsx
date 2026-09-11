'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuctionStatus, Condition } from '@/lib/domain';
import { parseIDR } from '@/lib/auction';
import { Feedback, mutate } from '@/components/ui';
import { CATEGORIES, CONDITIONS, statusLabel } from './helpers';

const DURATIONS = [24, 48, 72, 168] as const;
const SAMPLE_IMAGES = [
  { src: '/images/watch.png', label: 'Watch' },
  { src: '/images/chronograph.png', label: 'Chronograph' },
  { src: '/images/camera.png', label: 'Camera' },
  { src: '/images/medium-format.png', label: 'Medium format' },
  { src: '/images/cards.png', label: 'Cards' },
  { src: '/images/sneakers.png', label: 'Sneakers' },
  { src: '/images/design.png', label: 'Design' },
  { src: '/images/gaming.png', label: 'Gaming' },
] as const;

type FormState = {
  title: string;
  category_slug: string;
  brand: string;
  description: string;
  condition: Condition;
  flaws: string;
  provenance: string;
  images: string[];
  starting_price: string;
  reserve_price: string;
  increment_override: string;
  shipping_price: string;
  starts_local: string;
  duration: string;
};

function row(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultStart(): Date {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
}

function durationFrom(startsAt: string, endsAt: string): string {
  const hours = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 3_600_000);
  return (DURATIONS as readonly number[]).includes(hours) ? String(hours) : '72';
}

function parsePrice(value: string): number | null {
  try {
    const amount = parseIDR(value);
    return amount > 0 ? amount : null;
  } catch {
    return null;
  }
}

function parseShipping(value: string): number {
  if (!value.trim()) return 0;
  try {
    return parseIDR(value);
  } catch {
    return 0;
  }
}

function asCondition(value: unknown): Condition {
  const text = str(value, 'Good');
  const mapped: Record<string, Condition> = {
    NEW: 'New', LIKE_NEW: 'Like New', EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', FOR_PARTS: 'For Parts',
  };
  const condition = mapped[text] || text;
  return (CONDITIONS as readonly string[]).includes(condition) ? condition as Condition : 'Good';
}

function asImages(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return list.filter((item): item is string => typeof item === 'string' && (/^\/images\//.test(item) || /^\/api\/uploads\//.test(item) || /^https:\/\//.test(item)));
}

function asAttributes(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(row(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function asEditor(value: unknown, listingId: string) {
  const root = row(value);
  const data = ('listing_id' in root || 'title' in root || 'state' in root || 'listing' in root) ? root : row(root.data);
  const listing = row(data.listing);
  const auction = row(data.auction);
  const startsAt = str(data.starts_at || data.startsAt || auction.starts_at || auction.startsAt, defaultStart().toISOString());
  const endsAt = str(data.ends_at || data.endsAt || auction.ends_at || auction.endsAt, new Date(Date.parse(startsAt) + 72 * 3_600_000).toISOString());
  const state = str(data.state || data.status || auction.state || auction.status, 'DRAFT') as AuctionStatus;
  return {
    listing_id: str(data.listing_id || data.listingId || listing.listing_id || listing.id || data.id, listingId),
    auction_id: str(data.auction_id || data.auctionId || auction.id),
    slug: str(data.slug || listing.slug || auction.slug),
    state,
    title: str(data.title || listing.title),
    category_slug: str(data.category_slug || data.categorySlug || listing.category_slug || listing.categorySlug || row(listing.category).slug),
    brand: str(data.brand || listing.brand),
    description: str(data.description || listing.description),
    condition: asCondition(data.condition || listing.condition),
    flaws: str(data.flaws || listing.flaws),
    provenance: str(data.provenance || listing.provenance),
    attributes: asAttributes(data.attributes || listing.attributes),
    images: asImages(data.images || listing.images || listing.image_urls),
    starting_price: num(data.starting_price ?? data.startingPrice ?? auction.starting_price),
    reserve_price: num(data.reserve_price ?? data.reservePrice ?? auction.reserve_price),
    increment_override: num(data.increment_override ?? data.incrementOverride ?? auction.increment_override),
    starts_at: startsAt,
    ends_at: endsAt,
    shipping_price: num(data.shipping_price ?? data.shippingPrice ?? auction.shipping_price) ?? 0,
    sample: data.sample === true || listing.sample === true || auction.sample === true,
  };
}

function formFrom(editor: ReturnType<typeof asEditor>): FormState {
  return {
    title: editor.title,
    category_slug: editor.category_slug,
    brand: editor.brand,
    description: editor.description,
    condition: editor.condition,
    flaws: editor.flaws,
    provenance: editor.provenance,
    images: editor.images,
    starting_price: editor.starting_price != null ? String(editor.starting_price) : '',
    reserve_price: editor.reserve_price != null ? String(editor.reserve_price) : '',
    increment_override: editor.increment_override != null ? String(editor.increment_override) : '',
    shipping_price: editor.shipping_price ? String(editor.shipping_price) : '0',
    starts_local: toDatetimeLocal(editor.starts_at),
    duration: durationFrom(editor.starts_at, editor.ends_at),
  };
}

function payloadFrom(form: FormState, attributes: Record<string, string>): Record<string, unknown> {
  const starts = fromDatetimeLocal(form.starts_local);
  const duration = Number(form.duration) || 72;
  const starting = parsePrice(form.starting_price);
  const reserve = form.reserve_price.trim() === '' ? null : parsePrice(form.reserve_price);
  const increment = form.increment_override.trim() === '' ? null : parsePrice(form.increment_override);
  const payload: Record<string, unknown> = {
    title: form.title,
    category_slug: form.category_slug,
    brand: form.brand,
    description: form.description,
    condition: form.condition,
    flaws: form.flaws,
    provenance: form.provenance,
    attributes,
    images: form.images,
    reserve_price: reserve,
    increment_override: increment,
    shipping_price: parseShipping(form.shipping_price),
  };
  if (starting != null) payload.starting_price = starting;
  if (starts) {
    payload.starts_at = starts;
    payload.ends_at = new Date(Date.parse(starts) + duration * 3_600_000).toISOString();
  }
  return payload;
}

function isComplete(form: FormState): boolean {
  const starts = fromDatetimeLocal(form.starts_local);
  const duration = Number(form.duration);
  if (!starts || !(DURATIONS as readonly number[]).includes(duration)) return false;
  return form.title.trim().length >= 5
    && form.description.trim().length >= 20
    && form.images.length >= 1
    && Boolean(form.category_slug)
    && parsePrice(form.starting_price) != null
    && Date.parse(starts) + duration * 3_600_000 > Date.parse(starts);
}

function createdListingId(data: unknown): string | null {
  const root = row(data);
  const nested = row(root.listing);
  const id = root.listing_id || root.listingId || nested.id || root.id;
  return typeof id === 'string' && id ? id : null;
}

export function NewListingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  return (
    <div>
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setMessage('');
            setFailed(false);
            try {
              const id = createdListingId(await mutate('/api/listings', {}));
              if (!id) throw new Error('The listing could not be created.');
              router.push(`/selling/${id}`);
            } catch (error) {
              setMessage((error as Error).message);
              setFailed(true);
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? 'Working…' : 'New listing'}
      </button>
      <Feedback message={message} error={failed} />
    </div>
  );
}

export function ListingWriter({ listingId, initial }: { listingId: string; initial?: unknown }) {
  const router = useRouter();
  const parsed = asEditor(initial, listingId);
  const seeded = Boolean(parsed.auction_id || parsed.slug || parsed.title);
  const attributesRef = useRef(parsed.attributes);
  const dirty = useRef(false);
  const lastSaved = useRef(JSON.stringify(payloadFrom(formFrom(parsed), parsed.attributes)));
  const [form, setForm] = useState<FormState>(() => formFrom(parsed));
  const [state, setState] = useState<AuctionStatus>(parsed.state);
  const [categories, setCategories] = useState<{ id: string; slug: string; name: string }[]>(() => CATEGORIES.map(([slug, name]) => ({ id: slug, slug, name })));
  const [ready, setReady] = useState(seeded);
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitFailed, setSubmitFailed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frozen = state !== 'DRAFT' && state !== 'REJECTED';

  const applyForm = useCallback((editor: ReturnType<typeof asEditor>) => {
    attributesRef.current = editor.attributes;
    const next = formFrom(editor);
    setForm(next);
    setState(editor.state);
    lastSaved.current = JSON.stringify(payloadFrom(next, editor.attributes));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/taxonomy', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const list = payload?.data?.categories ?? payload?.categories ?? (Array.isArray(payload?.data) ? payload.data : null);
        if (!cancelled && Array.isArray(list) && list.length) {
          setCategories(list.map((item: { id?: string; slug?: string; name?: string }) => ({
            id: String(item.id || item.slug || ''),
            slug: String(item.slug || ''),
            name: String(item.name || item.slug || ''),
          })).filter(item => item.slug));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 8000);
    void (async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        const next = asEditor(payload.data ?? payload, listingId);
        if (!cancelled && !dirty.current) applyForm(next);
      } catch {
        /* Keep the local draft if the editor read is unavailable. */
      } finally {
        window.clearTimeout(abortTimer);
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(abortTimer); };
  }, [applyForm, listingId, seeded]);

  const saveNow = useCallback(async (current: FormState, listingState: AuctionStatus) => {
    if (listingState !== 'DRAFT' && listingState !== 'REJECTED') return;
    const payload = payloadFrom(current, attributesRef.current);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;
    setSaveMessage('Saving…');
    setSaveFailed(false);
    const next = await mutate<Record<string, unknown>>(`/api/listings/${listingId}`, payload, 'PATCH');
    lastSaved.current = serialized;
    const nextState = str(row(next).state || row(row(next).listing).state);
    if (nextState) setState(nextState as AuctionStatus);
    setSaveMessage('Saved');
    setSaveFailed(false);
  }, [listingId]);

  useEffect(() => {
    if (!ready || frozen) return;
    saveTimer.current = setTimeout(() => { void saveNow(form, state).catch(error => { setSaveMessage((error as Error).message); setSaveFailed(true); }); }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [form, frozen, ready, saveNow, state]);

  function patch(update: Partial<FormState>) {
    dirty.current = true;
    setForm(current => ({ ...current, ...update }));
  }

  function toggleImage(src: string) {
    if (frozen) return;
    dirty.current = true;
    setForm(current => ({
      ...current,
      images: current.images.includes(src) ? current.images.filter(item => item !== src) : [...current.images, src],
    }));
  }

  async function submit() {
    setBusy(true);
    setSubmitMessage('');
    setSubmitFailed(false);
    try {
      clearTimeout(saveTimer.current);
      await saveNow(form, state);
      const next = await mutate<Record<string, unknown>>(`/api/listings/${listingId}/submit`, {});
      const nextState = str(row(next).state || row(row(next).listing).state, 'PENDING_REVIEW') as AuctionStatus;
      setState(nextState);
      setSubmitMessage('Submitted for review.');
      router.refresh();
    } catch (error) {
      setSubmitMessage((error as Error).message);
      setSubmitFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const complete = isComplete(form);
  const pending = state === 'PENDING_REVIEW';
  const rejected = state === 'REJECTED';

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Listing writer</p>
        <h1 className="page-title">{form.title.trim() || 'New listing'}</h1>
        <p className="badge">{statusLabel(state)}</p>
        <p><Link href="/selling">Back to your lots</Link></p>
      </header>
      {pending && (
        <p className="notice" role="status">This lot is awaiting moderation. It is not live and is not in the catalogue.</p>
      )}
      {rejected && (
        <p className="notice" role="status">This lot was not approved. Edit it and submit again for review. It is not live and is not in the catalogue.</p>
      )}
      {frozen && !pending && (
        <p className="notice" role="status">This lot can no longer be edited from the writer.</p>
      )}
      <form
        className="form listing-writer"
        data-ready={ready ? 'true' : 'false'}
        onSubmit={event => { event.preventDefault(); if (!frozen && complete) void submit(); }}
      >
        <p className="muted">Sample photographs are fictional development imagery. AUCTA reviews every lot; submitting asks for moderation and does not publish the object.</p>
        <div className="field">
          <span className="field-label" id="listing-images-label">Images</span>
          <div className="image-picker" role="group" aria-labelledby="listing-images-label">
            {SAMPLE_IMAGES.map(image => (
              <button
                key={image.src}
                type="button"
                className="image-choice"
                aria-pressed={form.images.includes(image.src)}
                aria-label={`Use ${image.src}`}
                disabled={frozen}
                onClick={() => toggleImage(image.src)}
              >
                <span className="image-choice-frame">
                  <Image src={image.src} alt="" fill sizes="40vw" />
                </span>
                <span>{image.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-category">Category</label>
          <select className="input" id="listing-category" value={form.category_slug} disabled={frozen} onChange={event => patch({ category_slug: event.target.value })}>
            <option value="">Select a category</option>
            {categories.map(category => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-title">Title</label>
          <input className="input" id="listing-title" maxLength={140} autoComplete="off" value={form.title} disabled={frozen} onChange={event => patch({ title: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-description">Description</label>
          <textarea className="input" id="listing-description" maxLength={10000} value={form.description} disabled={frozen} onChange={event => patch({ description: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-condition">Condition</label>
          <select className="input" id="listing-condition" value={form.condition} disabled={frozen} onChange={event => patch({ condition: event.target.value as Condition })}>
            {CONDITIONS.map(condition => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-flaws">Flaws</label>
          <textarea className="input" id="listing-flaws" maxLength={5000} value={form.flaws} disabled={frozen} onChange={event => patch({ flaws: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-provenance">Provenance</label>
          <textarea className="input" id="listing-provenance" maxLength={5000} value={form.provenance} disabled={frozen} onChange={event => patch({ provenance: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listing-brand">Brand</label>
          <input className="input" id="listing-brand" maxLength={100} autoComplete="off" value={form.brand} disabled={frozen} onChange={event => patch({ brand: event.target.value })} />
        </div>
        <div className="split">
          <div className="field">
            <label className="field-label" htmlFor="listing-starting-price">Starting price (IDR)</label>
            <input className="input" id="listing-starting-price" inputMode="numeric" autoComplete="off" value={form.starting_price} disabled={frozen} onChange={event => patch({ starting_price: event.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="listing-reserve-price">Reserve price (IDR)</label>
            <input className="input" id="listing-reserve-price" inputMode="numeric" autoComplete="off" value={form.reserve_price} disabled={frozen} onChange={event => patch({ reserve_price: event.target.value })} />
          </div>
        </div>
        <div className="split">
          <div className="field">
            <label className="field-label" htmlFor="listing-increment">Increment override (IDR)</label>
            <input className="input" id="listing-increment" inputMode="numeric" autoComplete="off" value={form.increment_override} disabled={frozen} onChange={event => patch({ increment_override: event.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="listing-shipping">Shipping (IDR)</label>
            <input className="input" id="listing-shipping" inputMode="numeric" autoComplete="off" value={form.shipping_price} disabled={frozen} onChange={event => patch({ shipping_price: event.target.value })} />
          </div>
        </div>
        <div className="split">
          <div className="field">
            <label className="field-label" htmlFor="listing-start">Start</label>
            <input className="input" id="listing-start" type="datetime-local" value={form.starts_local} disabled={frozen} onChange={event => patch({ starts_local: event.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="listing-duration">Duration</label>
            <select className="input" id="listing-duration" value={form.duration} disabled={frozen} onChange={event => patch({ duration: event.target.value })}>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>
        <div className="writer-toolbar">
          {!frozen && (
            <button className="button" type="submit" disabled={busy || !complete}>{busy ? 'Working…' : 'Submit for review'}</button>
          )}
          <Feedback message={saveMessage} error={saveFailed} />
        </div>
        <Feedback message={submitMessage} error={submitFailed} />
      </form>
    </>
  );
}
