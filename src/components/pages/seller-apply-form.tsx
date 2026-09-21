'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Feedback, mutate } from '@/components/ui';

export function SellerApplyForm() {
  const router = useRouter();
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  return (
    <form
      className="form"
      aria-busy={busy}
      onSubmit={event => {
        event.preventDefault();
        void (async () => {
          setBusy(true);
          setMessage('');
          setFailed(false);
          try {
            await mutate('/api/seller', { shopName: shopName.trim(), city: city.trim(), province: province.trim() });
            router.push('/selling');
            router.refresh();
          } catch (error) {
            setMessage((error as Error).message);
            setFailed(true);
            setBusy(false);
          }
        })();
      }}
    >
      <p className="notice">Verification is a server decision. This only opens a seller desk.</p>
      <div className="field">
        <label className="field-label" htmlFor="shop-name">Shop name</label>
        <input className="input" id="shop-name" name="shopName" maxLength={80} required minLength={2} autoComplete="organization" value={shopName} onChange={event => setShopName(event.target.value)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="shop-city">City</label>
        <input className="input" id="shop-city" name="city" maxLength={80} required minLength={2} autoComplete="address-level2" value={city} onChange={event => setCity(event.target.value)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="shop-province">Province</label>
        <input className="input" id="shop-province" name="province" maxLength={80} required minLength={2} autoComplete="address-level1" value={province} onChange={event => setProvince(event.target.value)} />
      </div>
      <button className="button" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Working…' : 'Open a seller desk'}</button>
      <Feedback message={message} error={failed} />
    </form>
  );
}
