"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { IconArrow, IconCheck, IconShield, IconTruck } from "@/components/icons";

type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  isDefault: boolean;
};
type Order = {
  id: string;
  number: string;
  lotTitle: string;
  lotImage: string;
  lotSlug: string;
  hammerAmount: number;
  buyerFeeAmount: number;
  sellerFeeAmount: number;
  shippingCost: number;
  amountDue: number;
  shippingOption: string;
  shippingAddress: any;
  status: string;
  paymentExpiresAt: string | null;
};

const blankAddress = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
};

export function CheckoutForm({
  order,
  gateway,
  shippingQuote,
  lotSlug,
}: {
  order: Order;
  gateway: "midtrans" | "manual";
  shippingQuote: number;
  lotSlug: string;
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankAddress);
  const [shippingOption, setShippingOption] = useState(order.shippingOption || "standard");
  const [method, setMethod] = useState(gateway === "midtrans" ? "midtrans" : "bank_transfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<any | null>(null);

  const options = useMemo(() => {
    const std = shippingQuote;
    return [
      { id: "standard", label: "Courier — standard (JNE REG / J&T / SiCepat)", cost: std, eta: "2–4 working days" },
      { id: "express", label: "Courier — express (JNE YES / Sameday)", cost: Math.round(std * 1.7), eta: "Next-day, major cities" },
      { id: "pickup", label: "In-person collection", cost: 0, eta: "Arrange with seller" },
    ];
  }, [shippingQuote]);

  const selected = options.find((o) => o.id === shippingOption)!;
  const total = order.hammerAmount + selected.cost + order.buyerFeeAmount;

  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((d) => {
        setAddresses(d.items ?? []);
        const def = (d.items ?? []).find((a: Address) => a.isDefault) ?? (d.items ?? [])[0];
        if (def) setAddressId(def.id);
        else setShowForm(true);
      });
  }, []);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, label: "Home" }),
    });
    const d = await res.json();
    if (res.ok) {
      setShowForm(false);
      setForm(blankAddress);
      const r = await fetch("/api/addresses").then((x) => x.json());
      setAddresses(r.items ?? []);
      setAddressId(d.id);
    } else setError(d.error ?? "Could not save address");
  }

  async function pay() {
    setError(null);
    if (shippingOption !== "pickup" && !addressId && !form.recipientName) {
      setError("Choose or add a delivery address.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        shippingOption,
        addressId: shippingOption === "pickup" ? null : addressId,
        address: shippingOption === "pickup" ? null : !addressId ? form : null,
        method: gateway === "midtrans" ? "snap" : method,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(d.error ?? "Checkout failed");
      return;
    }
    if (d.redirectUrl) {
      window.location.href = d.redirectUrl;
      return;
    }
    if (d.instructions) {
      setInstructions(d.instructions);
      setBusy(false);
      return;
    }
    router.push("/account?tab=orders");
  }

  async function simulatePaid() {
    setBusy(true);
    const res = await fetch("/api/payments/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: order.number, method }),
    });
    const d = await res.json();
    if (res.ok) router.push("/account?tab=orders");
    else {
      setError(d.error ?? "Verification failed");
      setBusy(false);
    }
  }

  if (instructions) {
    return (
      <div className="mx-auto mt-8 max-w-lg">
        <div className="surface p-7">
          <span className="medallion">
            <IconTruck size={16} />
          </span>
          <h2 className="mt-4 font-serif text-2xl">Complete your transfer</h2>
          {instructions.kind === "va" ? (
            <div className="mt-5 space-y-3 rounded-xl border border-line bg-cream p-4 text-sm">
              <Row k="Bank" v={instructions.bank} />
              <Row k="Virtual account" v={instructions.va} mono />
              <Row k="Amount due" v={formatRupiah(instructions.amount)} mono />
              <Row
                k="Pay before"
                v={new Date(instructions.expiresAt).toLocaleString()}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3 rounded-xl border border-line bg-cream p-4 text-sm">
              <Row k="QRIS" v="Scan in your banking / e-wallet app" />
              <Row k="Amount" v={formatRupiah(instructions.amount)} mono />
              <div className="mt-2 grid h-36 place-items-center rounded-lg border-2 border-dashed border-line bg-canvas font-mono text-[0.6rem] text-muted">
                {String(instructions.qrisString).slice(0, 48)}…
              </div>
            </div>
          )}
          <p className="mt-4 rounded-lg bg-info-soft/60 p-3 text-xs leading-relaxed text-info">
            In this preview without live gateway credentials, use the button
            below to simulate the verified bank settlement webhook. With
            Midtrans configured, settlement is confirmed server-to-server and
            this button is disabled.
          </p>
          <div className="mt-5 flex gap-2">
            <button onClick={simulatePaid} disabled={busy} className="btn btn-primary flex-1">
              {busy ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <><IconCheck size={15} /> I&apos;ve paid</>}
            </button>
            <button onClick={() => setInstructions(null)} className="btn btn-outline">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* Address */}
        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <span className="medallion text-xs">1</span> Delivery address
          </h2>
          {shippingOption !== "pickup" && (
            <>
              {addresses.length > 0 && !showForm && (
                <div className="mt-4 space-y-2">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${
                        addressId === a.id
                          ? "border-ink bg-cream"
                          : "border-line hover:border-bronze-soft"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 accent-[var(--color-bronze-deep)]"
                        checked={addressId === a.id}
                        onChange={() => setAddressId(a.id)}
                      />
                      <span>
                        <span className="block font-semibold">
                          {a.recipientName} · {a.phone}
                        </span>
                        <span className="block text-muted-ink">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.province}{" "}
                          {a.postalCode}
                        </span>
                      </span>
                    </label>
                  ))}
                  <button onClick={() => setShowForm(true)} className="btn btn-ghost mt-2 px-2 text-sm">
                    + Add another address
                  </button>
                </div>
              )}
              {showForm && (
                <form onSubmit={saveAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input required className="input" placeholder="Recipient name" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
                  <input required className="input" placeholder="Phone (+62)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <input required className="input sm:col-span-2" placeholder="Street address" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
                  <input className="input" placeholder="Building / unit (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
                  <input className="input" placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                  <input required className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <input required className="input" placeholder="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                  <div className="flex gap-2 sm:col-span-2">
                    <button className="btn btn-primary" type="submit">Save address</button>
                    {addresses.length > 0 && (
                      <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
          {shippingOption === "pickup" && (
            <p className="mt-3 rounded-lg bg-cream p-3 text-sm text-muted-ink">
              You&apos;ll arrange collection directly with the seller after
              payment. No shipping address is required.
            </p>
          )}
        </section>

        {/* Shipping */}
        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <span className="medallion text-xs">2</span> Shipping
          </h2>
          <div className="mt-4 space-y-2">
            {options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                  shippingOption === o.id ? "border-ink bg-cream" : "border-line hover:border-bronze-soft"
                }`}
              >
                <input
                  type="radio"
                  name="shipping"
                  className="accent-[var(--color-bronze-deep)]"
                  checked={shippingOption === o.id}
                  onChange={() => setShippingOption(o.id)}
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted">{o.eta}</span>
                </span>
                <span className="font-mono text-sm font-semibold">
                  {o.cost === 0 ? "Free" : formatRupiah(o.cost)}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Payment */}
        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <span className="medallion text-xs">3</span> Payment method
          </h2>
          {gateway === "midtrans" ? (
            <p className="mt-3 text-sm text-muted-ink">
              Pay securely with QRIS, bank virtual account, GoPay/OVO/Dana, or
              card through Midtrans. Settlement is verified by a signed
              webhook.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {[
                { id: "bank_transfer", label: "Bank transfer / Virtual account" },
                { id: "qris", label: "QRIS" },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${
                    method === m.id ? "border-ink bg-cream" : "border-line"
                  }`}
                >
                  <input type="radio" name="method" className="accent-[var(--color-bronze-deep)]" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-info-soft/60 p-3 text-xs leading-relaxed text-info">
            <IconShield size={14} className="mt-0.5 shrink-0" />
            AUCTA is not escrow. The payment provider settles to the seller per
            its payout schedule; AUCTA records the immutable order snapshot,
            verifies settlement server-side and mediates disputes.
          </p>
        </section>

        {error && (
          <p role="alert" className="rounded-lg border border-oxblood/25 bg-oxblood-soft px-4 py-3 text-sm font-medium text-oxblood">
            {error}
          </p>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface p-6">
          <div className="flex gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-soft">
              <Image src={order.lotImage} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <Link href={`/auctions/${lotSlug}`} className="line-clamp-2 text-sm font-semibold hover:text-bronze-deep">
              {order.lotTitle}
            </Link>
          </div>
          <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
            <Sum k="Hammer price" v={formatRupiah(order.hammerAmount)} />
            <Sum k="Buyer fee" v={order.buyerFeeAmount ? formatRupiah(order.buyerFeeAmount) : "Free"} />
            <Sum k={selected.label.split(" (")[0]} v={selected.cost ? formatRupiah(selected.cost) : "Free"} />
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Total due</span>
            <span className="font-serif text-2xl">{formatRupiah(total)}</span>
          </div>
          <button onClick={pay} disabled={busy} className="btn btn-primary btn-lg btn-block mt-5">
            {busy ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <>
                {gateway === "midtrans" ? "Pay securely" : `Pay ${formatRupiah(total)}`}
                <IconArrow size={16} className="arrow" />
              </>
            )}
          </button>
          <p className="mt-3 text-center text-[0.66rem] text-faint">
            Order {order.number}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className={`font-semibold ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}
function Sum({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono font-semibold">{v}</dd>
    </div>
  );
}
