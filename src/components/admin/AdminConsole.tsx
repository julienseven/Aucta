"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { DashboardShell, Donut, EmptyQueue, KpiCard, NavItem } from "@/components/dashboard/primitives";
import { formatDateTime, formatRupiah } from "@/lib/format";
import {
  IconBell,
  IconChart,
  IconCheck,
  IconClose,
  IconEye,
  IconFlag,
  IconGavel,
  IconList,
  IconShieldCheck,
  IconStore,
  IconUsers,
} from "@/components/icons";

type Tab =
  | "overview"
  | "verification"
  | "approvals"
  | "live"
  | "bidding"
  | "payments"
  | "disputes"
  | "reports"
  | "sellers"
  | "audit";

export function AdminConsole({ data }: { data: any }) {
  const { dict } = useI18n();
  const a = dict.admin;
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [eventsFor, setEventsFor] = useState<any | null>(null);

  const o = data.overview;
  const c = o.counts;

  async function act(action: string, id: string, reason?: string) {
    setBusyId(`${action}-${id}`);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, reason }),
    });
    setBusyId(null);
    if (res.ok) {
      toast(a.actionLogged, "success");
      router.refresh();
    } else {
      toast("Action failed", "error");
    }
  }

  const nav: NavItem[] = [
    { href: "overview", label: a.overview, icon: IconChart },
    { href: "verification", label: a.verification, icon: IconShieldCheck, count: c.pendingSellers, tone: "red" },
    { href: "approvals", label: a.approvals, icon: IconCheck, count: c.reviewListings, tone: "red" },
    { href: "live", label: a.live, icon: IconGavel, count: c.liveLots },
    { href: "bidding", label: a.bidding, icon: IconEye, count: data.suspicious.flagged.length, tone: data.suspicious.flagged.length ? "red" : undefined },
    { href: "payments", label: a.payments, icon: IconBell, count: c.failedOrders, tone: c.failedOrders ? "red" : undefined },
    { href: "disputes", label: a.disputes, icon: IconFlag, count: c.openDisputes, tone: c.openDisputes ? "red" : undefined },
    { href: "reports", label: a.reports, icon: IconList, count: c.openReports, tone: c.openReports ? "red" : undefined },
    { href: "sellers", label: a.sellers, icon: IconUsers },
    { href: "audit", label: a.audit, icon: IconStore },
  ];

  const categoryDonut = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of o.queues.liveLots) map.set(l.category, (map.get(l.category) ?? 0) + 1);
    const palette = ["#6e5230", "#97734a", "#b89a73", "#a9795c", "#46382a", "#c9c0ad", "#807c70", "#336b4f"];
    return Array.from(map.entries()).map(([label, value], i) => ({
      label: label[0].toUpperCase() + label.slice(1),
      value,
      color: palette[i % palette.length],
    }));
  }, [o]);

  const stageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of o.stageCounts) map.set(s.stage, Number(s.n));
    return map;
  }, [o]);

  return (
    <DashboardShell
      brandHref="/admin"
      active={tab}
      onNavigate={(key) => {
        setTab(key as Tab);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      brand={
        <div>
          <p className="eyebrow is-clean">{a.adminBadge}</p>
          <p className="mt-2 font-serif text-xl leading-tight">AUCTA desk</p>
        </div>
      }
      nav={nav.map((n) => ({ ...n, href: `#${n.href}` }))}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(1.8rem,4vw,2.6rem)]">{a.title}</h1>
          <p className="mt-1 text-sm text-muted-ink">{a.subtitle}</p>
        </div>
        <Link href="/prohibited-items" className="btn btn-outline">
          {a.prohibited}
        </Link>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard label={a.kpiPendingSellers} value={c.pendingSellers} icon={IconShieldCheck} tone={c.pendingSellers ? "red" : "ink"} />
            <KpiCard label={a.kpiApprovals} value={c.reviewListings} icon={IconCheck} tone={c.reviewListings ? "red" : "ink"} />
            <KpiCard label={a.kpiLive} value={c.liveLots} icon={IconGavel} tone="bronze" />
            <KpiCard label={a.kpiEvents} value={c.events} icon={IconEye} tone="green" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard label={a.kpiDisputes} value={c.openDisputes} icon={IconFlag} tone={c.openDisputes ? "red" : "ink"} />
            <KpiCard label={a.kpiReports} value={c.openReports} icon={IconBell} tone={c.openReports ? "red" : "ink"} />
            <KpiCard label={a.kpiPayments} value={c.failedOrders} icon={IconList} tone={c.failedOrders ? "red" : "green"} />
            <KpiCard label="Suspended accounts" value={c.suspended} icon={IconUsers} tone="ink" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={a.topCategories}>
              {categoryDonut.length ? (
                <Donut segments={categoryDonut} centerLabel={c.liveLots} centerSub="live" />
              ) : (
                <p className="py-8 text-center text-sm text-muted">{a.noQueue}</p>
              )}
            </Panel>
            <Panel title={a.stageFunnel}>
              <ul className="space-y-3 py-2">
                {["draft", "under_review", "published", "paused", "withdrawn"].map((key) => (
                  <li key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize text-muted-ink">{key.replace("_", " ")}</span>
                      <span className="font-mono font-semibold">{stageCounts.get(key) ?? 0}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-bronze-deep to-bronze-soft transition-all duration-700"
                        style={{ width: `${((stageCounts.get(key) ?? 0) / Math.max(...Array.from(stageCounts.values()), 1)) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title={a.recentAudit}>
            <AuditFeed events={o.recentEvents} />
          </Panel>
        </div>
      )}

      {tab === "verification" && (
        <Queue
          empty={o.queues.pendingSellers.length === 0}
          icon={IconShieldCheck}
          emptyText={a.noQueue}
        >
          <div className="space-y-4">
            {o.queues.pendingSellers.map((u: any) => (
              <div key={u.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-lg">{u.displayName ?? u.alias}</p>
                    <p className="text-xs text-muted">{u.email} · {u.alias}</p>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmAction label={a.approve} kind="approve_seller" id={u.id} busy={busyId} onAct={act} tone="primary" />
                    <ConfirmAction label={a.reject} kind="reject_seller" id={u.id} busy={busyId} onAct={act} needsReason />
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <AppRow k={a.identity} v={`${u.sellerApplication?.idKind ?? "—"} · ${u.sellerApplication?.idNumber ?? "—"}`} />
                  <AppRow k={a.location} v={`${u.sellerApplication?.city ?? u.sellerCity ?? "—"}, ${u.sellerApplication?.province ?? u.sellerProvince ?? "—"}`} />
                  <AppRow k={a.applied} v={formatDateTime(u.sellerApplication?.submittedAt ?? u.createdAt)} />
                  <AppRow k="Phone" v={u.sellerApplication?.phone ?? "—"} />
                </dl>
                {u.sellerApplication?.statement && (
                  <p className="mt-3 rounded-lg bg-cream p-3 text-xs italic leading-relaxed text-muted-ink">
                    “{u.sellerApplication.statement}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </Queue>
      )}

      {tab === "approvals" && (
        <Queue empty={o.queues.reviewListings.length === 0} icon={IconCheck} emptyText={a.noQueue}>
          <div className="space-y-4">
            {o.queues.reviewListings.map((l: any) => (
              <div key={l.id} className="surface flex flex-col gap-4 p-5 sm:flex-row">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-soft">
                  <Image src={l.image} alt="" fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/auctions/${l.slug}`} className="font-serif text-lg hover:text-bronze-deep">{l.title}</Link>
                  <p className="text-xs text-muted">{l.category} · {l.condition} · {formatRupiah(Number(l.startAmount))}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-ink">{l.description}</p>
                  {l.authenticity && <p className="mt-2 text-xs text-success">✓ Authenticity evidence provided</p>}
                </div>
                <div className="flex flex-row gap-2 sm:flex-col">
                  <Link href={`/auctions/${l.slug}`} className="btn btn-outline">
                    <IconEye size={15} /> {a.viewLot}
                  </Link>
                  <ConfirmAction label={a.approve} kind="approve_listing" id={l.id} busy={busyId} onAct={act} tone="primary" />
                  <ConfirmAction label={a.reject} kind="reject_listing" id={l.id} busy={busyId} onAct={act} needsReason />
                </div>
              </div>
            ))}
          </div>
        </Queue>
      )}

      {tab === "live" && (
        <Queue empty={o.queues.liveLots.length === 0} icon={IconGavel} emptyText={a.noQueue}>
          <div className="surface overflow-hidden">
            {o.queues.liveLots.map((l: any, i: number) => (
              <div key={l.id} className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5 ${i !== o.queues.liveLots.length - 1 ? "border-b border-line-soft" : ""}`}>
                <div className="relative h-11 w-11 overflow-hidden rounded-md bg-soft">
                  <Image src={l.image} alt="" fill sizes="44px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <Link href={`/auctions/${l.slug}`} className="block truncate text-sm font-semibold hover:underline">{l.title}</Link>
                  <p className="text-xs text-muted">
                    {l.status} · {formatRupiah(Number(l.currentAmount))} · closes {formatDateTime(l.endsAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button className="icon-btn h-9 w-9" title={a.inspectEvents} onClick={() => setEventsFor(l)}>
                    <IconEye size={16} />
                  </button>
                  {l.stage === "paused" ? (
                    <ConfirmAction label="" kind="resume_listing" id={l.id} busy={busyId} onAct={act} iconOnly={<IconCheck size={15} />} />
                  ) : (
                    <ConfirmAction label="" kind="pause_listing" id={l.id} busy={busyId} onAct={act} needsReason iconOnly={<IconBell size={15} />} />
                  )}
                  <ConfirmAction label="" kind="withdraw_listing" id={l.id} busy={busyId} onAct={act} needsReason iconOnly={<IconClose size={15} />} />
                </div>
              </div>
            ))}
          </div>
        </Queue>
      )}

      {tab === "bidding" && (
        <div className="space-y-6">
          <Panel title={a.flaggedLate}>
            {data.suspicious.flagged.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{a.noQueue}</p>
            ) : (
              <div className="space-y-3">
                {data.suspicious.flagged.map((f: any) => (
                  <div key={f.lot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-cream p-4">
                    <div>
                      <Link href={`/auctions/${f.lot.slug}`} className="text-sm font-semibold hover:underline">{f.lot.title}</Link>
                      <p className="text-xs text-muted">
                        {f.late && <span className="font-semibold text-oxblood">● {a.flaggedLate} </span>}
                        {f.share >= 0.6 && f.totalBids >= 4 && (
                          <span className="font-semibold text-amber">● {a.flaggedConcentration} ({Math.round(f.share * 100)}% {f.topAlias})</span>
                        )}
                      </p>
                    </div>
                    <button className="btn btn-outline" onClick={() => setEventsFor(f.lot)}>
                      {a.inspectEvents}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title={a.events}>
            <EventTable events={data.suspicious.events.slice(0, 24)} />
          </Panel>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-5">
          <PaymentsTable
            a={a}
            orders={data.orders}
            busyId={busyId}
            act={act}
            filter={["payment_failed", "awaiting_payment"]}
            title="Payment failures & expiry"
            onlyCancel
          />
          <PaymentsTable
            a={a}
            orders={data.orders}
            busyId={busyId}
            act={act}
            filter={["paid", "preparing", "shipped", "delivered", "completed", "disputed"]}
            title="Settled orders & refunds"
          />
        </div>
      )}

      {tab === "disputes" && (
        <Queue empty={data.disputes.filter((d: any) => d.dispute.status === "open").length === 0} icon={IconFlag} emptyText={a.noQueue}>
          <div className="space-y-4">
            {data.disputes.map(({ dispute, title, slug, image, orderNumber }: any) => (
              <div key={dispute.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-md bg-soft">
                      <Image src={image} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                    <div>
                      <Link href={`/auctions/${slug}`} className="font-semibold hover:underline">{title}</Link>
                      <p className="text-xs text-muted">
                        {a.disputeReasons[dispute.reason as keyof typeof a.disputeReasons] ?? dispute.reason} · {orderNumber ?? "—"} · {dispute.openedByAlias}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${dispute.status === "open" ? "badge-live" : "badge-success"}`}>{dispute.status}</span>
                </div>
                <p className="mt-3 rounded-lg bg-cream p-3 text-sm leading-relaxed text-ink-soft">{dispute.evidence}</p>
                {dispute.status === "open" && (
                  <div className="mt-3 flex justify-end">
                    <ConfirmAction label={a.resolve} kind="resolve_dispute" id={String(dispute.id)} busy={busyId} onAct={act} needsReason tone="primary" />
                  </div>
                )}
                {dispute.status === "resolved" && dispute.resolution && (
                  <p className="mt-3 rounded-lg bg-success-soft p-3 text-xs text-success">✓ {dispute.resolution}</p>
                )}
              </div>
            ))}
          </div>
        </Queue>
      )}

      {tab === "reports" && (
        <Queue empty={data.reports.filter((r: any) => r.report.status === "open").length === 0} icon={IconFlag} emptyText={a.noQueue}>
          <div className="space-y-3">
            {data.reports.map(({ report, lotTitle, lotSlug, sellerAlias }: any) => (
              <div key={report.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {report.targetType === "lot" ? (
                        <Link href={`/auctions/${lotSlug}`} className="hover:underline">{lotTitle}</Link>
                      ) : (
                        <span>{dict.trust.sellerProfile}: {sellerAlias}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {dict.trust.reasons[report.reason as keyof typeof dict.trust.reasons] ?? report.reason} ·{" "}
                      {formatDateTime(report.createdAt)}
                    </p>
                  </div>
                  <span className={`badge ${report.status === "open" ? "badge-upcoming" : report.status === "resolved" ? "badge-success" : "badge-sold"}`}>
                    {report.status}
                  </span>
                </div>
                {report.message && <p className="mt-3 rounded-lg bg-cream p-3 text-sm">{report.message}</p>}
                {report.status === "open" && (
                  <div className="mt-3 flex justify-end gap-2">
                    <ConfirmAction label={a.dismiss} kind="dismiss_report" id={String(report.id)} busy={busyId} onAct={act} />
                    <ConfirmAction label={a.resolve} kind="resolve_report" id={String(report.id)} busy={busyId} onAct={act} needsReason tone="primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Queue>
      )}

      {tab === "sellers" && (
        <div className="surface overflow-hidden">
          {data.sellers.map((u: any, i: number) => (
            <div key={u.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${i !== data.sellers.length - 1 ? "border-b border-line-soft" : ""}`}>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {u.displayName ?? u.alias}
                  {u.sellerVerified && <IconShieldCheck size={15} className="text-success" />}
                  {u.suspended && <span className="badge badge-live">{a.suspended}</span>}
                </p>
                <p className="text-xs text-muted">
                  {u.alias} · {u.sellerStatus} · {u.sellerCity ?? "—"} ·{" "}
                  {u.metrics?.successfulSales ?? 0} ✓
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/seller/${u.alias}`} className="btn btn-outline">
                  {a.viewLot}
                </Link>
                {u.role !== "admin" &&
                  (u.suspended ? (
                    <ConfirmAction label={a.reinstate} kind="reinstate_user" id={u.id} busy={busyId} onAct={act} />
                  ) : (
                    <ConfirmAction label={a.suspend} kind="suspend_user" id={u.id} busy={busyId} onAct={act} needsReason />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <Panel title={a.audit}>
          <AuditFeed events={data.audit} detailed />
        </Panel>
      )}

      {eventsFor && <EventsModal lot={eventsFor} onClose={() => setEventsFor(null)} />}
    </DashboardShell>
  );
}

/* ---- helpers ---- */

function PaymentsTable({
  a,
  orders,
  busyId,
  act,
  filter,
  title,
  onlyCancel,
}: {
  a: any;
  orders: any[];
  busyId: string | null;
  act: (action: string, id: string, reason?: string) => void;
  filter: string[];
  title: string;
  onlyCancel?: boolean;
}) {
  const rows = orders.filter(({ order }: any) => filter.includes(order.status));
  if (!rows.length) return null;
  return (
    <section className="surface overflow-x-auto">
      <h2 className="px-5 py-4 font-serif text-lg">{title}</h2>
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-y border-line bg-cream text-[0.62rem] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-5 py-2.5">{a.orderNumber}</th>
            <th className="px-5 py-2.5">Object</th>
            <th className="px-5 py-2.5 text-right">{a.amount}</th>
            <th className="px-5 py-2.5">Status</th>
            <th className="px-5 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ order, title, slug }: any) => (
            <tr key={order.id} className="border-b border-line-soft last:border-0">
              <td className="px-5 py-3 font-mono text-xs">{order.number}</td>
              <td className="px-5 py-3">
                <Link href={`/auctions/${slug}`} className="hover:underline">{title}</Link>
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs font-semibold">
                {formatRupiah(Number(order.amountDue ?? order.hammerAmount))}
              </td>
              <td className="px-5 py-3">
                <span className="badge badge-muted">{order.status.replace(/_/g, " ")}</span>
                {order.paymentMethod && (
                  <span className="ml-2 text-[0.66rem] text-muted">{order.paymentProvider} · {order.paymentMethod}</span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                {onlyCancel ? (
                  order.status === "payment_failed" || order.status === "awaiting_payment" ? (
                    <ConfirmAction label={a.cancelOrder} kind="dismiss_payment" id={order.id} busy={busyId} onAct={act} needsReason />
                  ) : null
                ) : (
                  ["paid", "preparing", "shipped", "delivered", "completed", "disputed"].includes(order.status) && (
                    <ConfirmAction label="Refund" kind="issue_refund" id={order.id} busy={busyId} onAct={act} needsReason />
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <h2 className="mb-4 font-serif text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Queue({ empty, icon: Icon, emptyText, children }: { empty: boolean; icon: any; emptyText: string; children: React.ReactNode }) {
  if (empty) return <EmptyQueue icon={Icon}>{emptyText}</EmptyQueue>;
  return children;
}

function AppRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft pb-2 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink-soft">{v}</dd>
    </div>
  );
}

function ConfirmAction({
  label,
  kind,
  id,
  busy,
  onAct,
  needsReason = false,
  tone,
  iconOnly,
}: {
  label: string;
  kind: string;
  id: string;
  busy: string | null;
  onAct: (action: string, id: string, reason?: string) => void;
  needsReason?: boolean;
  tone?: "primary";
  iconOnly?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const isBusy = busy === `${kind}-${id}`;
  if (!needsReason) {
    return (
      <button
        onClick={() => onAct(kind, id)}
        disabled={isBusy}
        className={iconOnly ? "icon-btn h-9 w-9" : `btn ${tone === "primary" ? "btn-primary" : "btn-outline"}`}
        title={label}
      >
        {isBusy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : iconOnly ?? label}
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={iconOnly ? "icon-btn h-9 w-9" : `btn ${tone === "primary" ? "btn-primary" : "btn-outline"}`}
        title={label}
      >
        {iconOnly ?? label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[130] grid place-items-center p-4">
          <button className="sheet-backdrop absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="modal-panel surface relative w-full max-w-md rounded-2xl p-6">
            <h3 className="font-serif text-xl">{label}</h3>
            <textarea
              className="input mt-4 min-h-[6rem] resize-y py-2.5"
              placeholder="Reason / resolution — recorded in the immutable audit log."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className={`btn ${tone === "primary" ? "btn-primary" : "btn-outline"}`}
                onClick={() => {
                  onAct(kind, id, reason);
                  setOpen(false);
                  setReason("");
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AuditFeed({ events, detailed = false }: { events: any[]; detailed?: boolean }) {
  return (
    <ul className="space-y-0">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 border-b border-line-soft py-2.5 text-sm last:border-0">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bronze" />
          <div className="min-w-0 flex-1">
            <p className="truncate">
              <span className="font-mono text-xs text-bronze-deep">{e.adminAlias}</span>{" "}
              <span className="text-ink-soft">{e.action.replace(/_/g, " ")}</span>{" "}
              <span className="text-muted">{e.targetType}</span>
            </p>
            {detailed && e.reason && <p className="text-xs text-muted">{e.reason}</p>}
          </div>
          <span className="shrink-0 text-[0.68rem] text-faint">{formatDateTime(e.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function EventTable({ events }: { events: any[] }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted">No events recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-line text-[0.64rem] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="py-2 pr-3">Event</th>
            <th className="py-2 pr-3">Alias</th>
            <th className="py-2 pr-3 text-right">Amount</th>
            <th className="py-2 text-right">When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-line-soft last:border-0">
              <td className="py-2 pr-3 font-mono text-xs">{e.type.replace("_", " ")}</td>
              <td className="py-2 pr-3">{e.alias ?? "—"}</td>
              <td className="py-2 pr-3 text-right font-mono text-xs">{e.amount ? formatRupiah(Number(e.amount)) : "—"}</td>
              <td className="py-2 text-right text-xs text-muted">{formatDateTime(e.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsModal({ lot, onClose }: { lot: any; onClose: () => void }) {
  const { dict } = useI18n();
  const [events, setEvents] = useState<any[] | null>(null);
  useEffect(() => {
    fetch(`/api/admin/events?lotId=${lot.id}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));
  }, [lot.id]);
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center p-4">
      <button className="sheet-backdrop absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="modal-panel surface relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <button className="icon-btn absolute right-3 top-3" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
        <h3 className="font-serif text-xl">{dict.admin.events}</h3>
        <p className="text-xs text-muted">{lot.title}</p>
        <div className="mt-4">
          {events ? <EventTable events={events} /> : <p className="py-8 text-center text-sm text-muted"><span className="spinner mx-auto text-bronze" /></p>}
        </div>
      </div>
    </div>
  );
}
