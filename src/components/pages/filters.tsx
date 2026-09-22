'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CONDITIONS, SORTS } from './helpers';

export type FilterValues = {
  q?: string;
  category?: string;
  condition?: string;
  status?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
};

export function Filters({ values, action = '/auctions', lockStatus }: { values: FilterValues; action?: string; lockStatus?: string }) {
  const router = useRouter();
  const hasAdvanced = Boolean(values.category || values.condition || values.minPrice || values.maxPrice);
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);
  const activeCount = [
    values.q,
    values.category && values.category !== 'all' ? values.category : '',
    values.condition && values.condition !== 'all' ? values.condition : '',
    !lockStatus && values.status && values.status !== 'all' ? values.status : '',
    values.minPrice,
    values.maxPrice,
  ].filter(Boolean).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, raw] of data.entries()) {
      let value = String(raw).trim();
      if (key === 'minPrice' || key === 'maxPrice') value = value.replace(/\D/g, '');
      if (value && value !== 'all') params.set(key, value);
    }
    if (lockStatus) params.set('status', lockStatus);
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action);
  }

  return (
    <form className="filters filter-panel" method="get" action={action} onSubmit={submit} aria-labelledby="filter-panel-title">
      <header className="filter-panel-header">
        <div>
          <p className="eyebrow">Catalogue tools</p>
          <h2 id="filter-panel-title">Refine this view</h2>
        </div>
        <p className="filter-active-summary" role="status" aria-live="polite">
          {activeCount === 0 ? 'No filters active' : `${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} active`}
        </p>
      </header>
      <div className="filter-group">
        <label className="field-label" htmlFor="q">Search</label>
        <input className="input" id="q" name="q" defaultValue={values.q ?? ''} placeholder="An object, a maker, a story" />
      </div>
      {!lockStatus && (
        <div className="filter-group">
          <label className="field-label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={values.status ?? 'all'}>
            <option value="all">Live and upcoming</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="sold">Sold</option>
          </select>
        </div>
      )}
      <button className="filter-toggle button button-outline" type="button" aria-expanded={showAdvanced} aria-controls="advanced-filters" onClick={() => setShowAdvanced(value => !value)}>
        {showAdvanced ? 'Fewer filters' : `More filters${hasAdvanced ? ' · active' : ''}`}
      </button>
      <div className={`filter-advanced ${showAdvanced ? 'is-open' : ''}`} id="advanced-filters">
        <div className="filter-group">
          <label className="field-label" htmlFor="category">Category</label>
          <select className="input" id="category" name="category" defaultValue={values.category ?? 'all'}>
            <option value="all">All categories</option>
            {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="condition">Condition</label>
          <select className="input" id="condition" name="condition" defaultValue={values.condition ?? 'all'}>
            <option value="all">Any condition</option>
            {CONDITIONS.map(condition => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="minPrice">Min price (IDR)</label>
          <input className="input" id="minPrice" name="minPrice" inputMode="numeric" defaultValue={values.minPrice ?? ''} placeholder="1000000" />
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="maxPrice">Max price (IDR)</label>
          <input className="input" id="maxPrice" name="maxPrice" inputMode="numeric" defaultValue={values.maxPrice ?? ''} placeholder="25000000" />
        </div>
      </div>
      <div className="filter-group">
        <label className="field-label" htmlFor="sort">Sort</label>
        <select className="input" id="sort" name="sort" defaultValue={values.sort ?? 'ending-soon'}>
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <button className="button" type="submit">Apply filters</button>
      <Link className="button button-outline" href={action}>Clear</Link>
    </form>
  );
}
