"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { useToast } from "@/components/Toast";
import {
  IconClose,
  IconShield,
  IconTruck,
} from "@/components/icons";

export type OrderRow = {
  id: string;
  number: string;
  status: string;
  hammerAmount: number;
  shippingCost: number;
  amountDue: number;
  trackingNumber: string | null;
  carrier: string | null;
  carrierStatus: string;
  shipmentProof: string | null;
  shippingLabel: string | null;
  shippingAddress: unknown;
  paymentExpiresAt: string | null;
  paymentDueAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  refundedAt: string | null;
  statusReason: string | null;
  title: string;
  slug: string;
  image: string;
  role: "buyer" | "seller";
};

const statusCls: Record<string, string> = {
  awaiting_payment: "badge-upcoming",
  paid: "badge-success",
  preparing: "badge-upcoming",
  shipped: "badge-live",
  delivered: "badge-live",
  completed: "badge-success",
  payment_failed: "badge-live",
  disputed: "badge-upcoming",
  cancelled: "badge-sold",
  refunded: "badge-sold",
};

export function OrdersPanel({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [shipFor, setShipFor] = useState<OrderRow | null>(null);

  async function act(order: OrderRow, action: string, extra?: Record<string, string>) {
    setBusy(order.id + action);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast("Order updated", "success");
      router.refresh();
    } else toast(data?.error ?? "Action failed", "error");
  }

  const buys = orders.filter((o) => o.role === "buyer");
  const sales = orders.filter((o) => o.role === "seller");

  return (
    <div className="space-y-10">
      <Group
        title="Your purchases"
        orders={buys}
        kind="buyer"
        busy={busy}
        onAct={act}
        onShip={(o) => setShipFor(o)}
      />
      <Group
        title="Sold by you"
        orders={sales}
        kind="seller"
        busy={busy}
        onAct={act}
        onShip={(o) => setShipFor(o)}
      />
      {orders.length === 0 && (
        <div className="surface p-10 text-center text-sm text-muted-ink">
          No orders yet. Won lots and completed sales appear here with
          checkout, dispatch tracking and delivery confirmation.
        </div>
      )}
      {shipFor && (
        <ShipDialog
          order={shipFor}
          busy={busy?.startsWith(shipFor.id)}
          onClose={() => setShipFor(null)}
          onSubmit={(payload) => {
            setShipFor(null);
            act(shipFor, "ship", payload);
          }}
        />
      )}
    </div>
  );
}

function Group({
  title,
  orders,
  kind,
  busy,
  onAct,
  onShip,
}: {
  title: string;
  orders: OrderRow[];
  kind: "buyer" | "seller";
  busy: string | null;
  onAct: (o: OrderRow, a: string, e?: Record<string, string>) => void;
  onShip: (o: OrderRow) => void;
}) {
  if (!orders.length) return null;
  return (
    <section>
      <h2 className="mb-4 font-serif text-xl">{title}</h2>
      <div className="surface overflow-hidden">
        {orders.map((o) => {
          const dead = ["cancelled", "refunded"].includes(o.status);
          return (
            <div
              key={o.id}
              className="flex flex-col gap-3 border-b border-line-soft p-4 last:border-0 sm:flex-row sm:items-center sm:gap-4"
            >
              <Link href={`/auctions/${o.slug}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-soft">
                <Image src={o.image} alt="" fill sizes="56px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/auctions/${o.slug}`} className="line-clamp-1 text-sm font-semibold hover:underline">
                  {o.title}
                </Link>
                <p className="font-mono text-xs text-muted">
                  {o.number} · {formatRupiah(o.amountDue)}
                </p>
                <p className="mt-0.5 text-[0.68rem] text-faint">
                  {o.paymentExpiresAt && o.status === "awaiting_payment"
                    ? `Pay before ${formatDateTime(o.paymentExpiresAt)}`
                    : o.carrier && o.trackingNumber
                      ? `${o.carrier} · ${o.trackingNumber} · ${o.carrierStatus.replace("_", " ")}`
                      : o.paidAt
                        ? `Settled ${formatDateTime(o.paidAt)}`
                        : ""}
                  {o.statusReason && o.statusReason === "payment_expired"
                    ? " · payment window closed"
                    : ""}
                </p>
                {o.shipmentProof && (
                  <a
                    href={o.shipmentProof}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-success hover:underline"
                  >
                    <IconShield size={12} /> Proof of shipment
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${statusCls[o.status] ?? "badge-muted"}`}>
                  {o.status.replace(/_/g, " ")}
                </span>

                {!dead && kind === "buyer" && o.status === "awaiting_payment" && (
                  <Link href={`/checkout/${o.id}`} className="btn btn-primary">
                    Pay now
                  </Link>
                )}
                {!dead && kind === "seller" && o.status === "paid" && (
                  <button
                    className="btn btn-outline"
                    disabled={busy === o.id + "preparing"}
                    onClick={() => onAct(o, "preparing")}
                  >
                    Start preparing
                  </button>
                )}
                {!dead && kind === "seller" && ["paid", "preparing"].includes(o.status) && (
                  <button
                    className="btn btn-primary inline-flex items-center gap-1.5"
                    disabled={busy === o.id + "ship"}
                    onClick={() => onShip(o)}
                  >
                    <IconTruck size={15} /> Mark shipped
                  </button>
                )}
                {!dead && kind === "buyer" && o.status === "shipped" && (
                  <button className="btn btn-primary" onClick={() => onAct(o, "deliver")}>
                    Confirm delivery
                  </button>
                )}
                {!dead && kind === "seller" && o.status === "shipped" && (
                  <button className="btn btn-outline" onClick={() => onAct(o, "deliver")}>
                    Mark delivered
                  </button>
                )}
                {!dead && kind === "buyer" && o.status === "delivered" && (
                  <button className="btn btn-primary" onClick={() => onAct(o, "complete")}>
                    Complete order
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CARRIERS = ["JNE", "J&T", "SiCepat", "AnterAja", "GoSend", "JNE YES", "Other"];

function ShipDialog({
  order,
  busy,
  onClose,
  onSubmit,
}: {
  order: OrderRow;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (p: { carrier: string; trackingNumber: string; shipmentProof: string }) => void;
}) {
  const [carrier, setCarrier] = useState("JNE");
  const [trackingNumber, setTracking] = useState("");
  const [shipmentProof, setShipmentProof] = useState("");

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center p-4">
      <button className="sheet-backdrop absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="modal-panel surface relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl p-6">
        <button className="icon-btn absolute right-3 top-3" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
        <span className="medallion">
          <IconTruck size={16} />
        </span>
        <h3 className="mt-4 font-serif text-2xl">Dispatch the lot</h3>
        <p className="mt-1 text-xs text-muted">{order.title}</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="field-label">Carrier</span>
            <div className="select-wrap">
              <select className="input appearance-none pr-9" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {CARRIERS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="block">
            <span className="field-label">Tracking number</span>
            <input className="input" value={trackingNumber} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. JNE0099123456" required />
          </label>
          <label className="block">
            <span className="field-label">Proof of shipment (photo URL, optional)</span>
            <input className="input" value={shipmentProof} onChange={(e) => setShipmentProof(e.target.value)} placeholder="https://…/receipt.jpg" />
          </label>
          <p className="text-[0.7rem] leading-relaxed text-muted">
            Dispatch within 48 hours of payment. The tracking number and proof
            are shown to the buyer and recorded on the immutable order receipt.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn btn-outline flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            disabled={busy || !trackingNumber.trim()}
            onClick={() =>
              onSubmit({
                carrier,
                trackingNumber: trackingNumber.trim(),
                shipmentProof: shipmentProof.trim(),
              })
            }
          >
            Confirm dispatch
          </button>
        </div>
      </div>
    </div>
  );
}
