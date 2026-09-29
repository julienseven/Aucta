import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[][], writes: 0, limits: [] as number[] }));
vi.mock("@/db", () => {
  function select() {
    const rows = state.rows.shift() ?? [];
    const query: Record<string, unknown> = {};
    for (const method of ["from", "where", "for", "orderBy"]) query[method] = () => query;
    query.limit = (size: number) => { state.limits.push(size); return query; };
    query.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
    return query;
  }
  function write() {
    state.writes++;
    const query: Record<string, unknown> = {};
    for (const method of ["set", "where", "values"]) query[method] = () => query;
    query.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve);
    return query;
  }
  const db = { select, update: write, insert: write, transaction: async (fn: (tx: unknown) => unknown) => fn(db) };
  return { db };
});
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
import { processDueCloses } from "@/lib/close";
import { confirmSettlement, expireUnpaidOrders } from "@/lib/payments/confirm";

describe("transaction eligibility rechecks", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  beforeEach(() => { state.rows = []; state.writes = 0; state.limits = []; });

  it("closes at most one bounded batch per scheduler call", async () => {
    state.rows = [[]];
    expect(await processDueCloses(now)).toEqual({ sold: [], unsold: [] });
    expect(state.limits).toEqual([25]);
  });

  it("does not close a lot extended since the candidate scan", async () => {
    state.rows = [[{ id: "lot" }], [{ id: "lot", status: "live", endsAt: new Date(now.getTime() + 120_000) }]];
    expect(await processDueCloses(now)).toEqual({ sold: [], unsold: [] });
    expect(state.writes).toBe(0);
  });

  it("does not expire or revert a lot after settlement wins the order lock", async () => {
    state.rows = [[{ id: "order" }], [{ id: "order", status: "paid", paymentExpiresAt: new Date(0) }]];
    expect(await expireUnpaidOrders(now)).toBe(0);
    expect(state.writes).toBe(0);
  });

  it("rechecks an extended payment deadline under the lock", async () => {
    state.rows = [[{ id: "order" }], [{ id: "order", status: "awaiting_payment", paymentExpiresAt: new Date(now.getTime() + 1) }]];
    expect(await expireUnpaidOrders(now)).toBe(0);
    expect(state.writes).toBe(0);
  });

  it("rejects fractional settlement rather than rounding it into a valid amount", async () => {
    state.rows = [[{ id: "order", status: "awaiting_payment", amountDue: 100_000 }]];
    expect(await confirmSettlement({ orderNumber: "test", provider: "test", amount: 100_000.1 })).toEqual({ ok: false, reason: "AMOUNT_MISMATCH" });
    expect(state.writes).toBe(0);
  });
});

import { bidStateFor } from "@/lib/auctions";
import type { LotRow } from "@/db/schema";

describe("authoritative bid snapshot", () => {
  const lot = { startAmount: 100_000, currentAmount: 100_000, reserveAmount: 500_000, incrementOverride: null, bidCount: 1, leadingAlias: null } as LotRow;
  it("meets reserve when the leading ceiling can cover it", () => {
    const result = bidStateFor(lot, [{ alias: "first", maxAmount: 600_000 }]);
    expect(result.current).toBe(500_000);
    expect(result.reserveMet).toBe(true);
    expect(result.nextMin).toBe(525_000);
    expect(result).not.toHaveProperty("reserveAmount");
  });
  it("never charges above the ceiling to reach reserve", () => {
    const result = bidStateFor(lot, [{ alias: "first", maxAmount: 400_000 }]);
    expect(result.current).toBe(400_000);
    expect(result.reserveMet).toBe(false);
  });
  it("keeps the first equivalent maximum in the supplied chronological order", () => {
    expect(bidStateFor(lot, [{ alias: "first", maxAmount: 600_000 }, { alias: "second", maxAmount: 600_000 }]).leaderAlias).toBe("first");
  });
});
