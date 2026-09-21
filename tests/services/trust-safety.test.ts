import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../../src/lib/server/errors";

const mocks = vi.hoisted(() => ({ callRpc: vi.fn(), requireUser: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("../../src/lib/server/repository", () => ({ callRpc: mocks.callRpc }));
vi.mock("../../src/lib/server/auth", () => ({ requireUser: mocks.requireUser, requireAdmin: mocks.requireAdmin }));

import { POST as report } from "../../src/app/api/reports/route";
import { POST as dispute } from "../../src/app/api/orders/[id]/dispute/route";
import { POST as review } from "../../src/app/api/admin/reports/[id]/route";
import { POST as resolve } from "../../src/app/api/admin/disputes/[id]/route";
import { POST as suspend } from "../../src/app/api/admin/accounts/[id]/suspension/route";

const id = "bbbbbbbb-0000-0000-0000-000000000001";
const reason = "The item differs from its description.";
let sequence = 0;
let user: { id: string };
const cases = [
  { name: "report", handler: report, admin: false, body: { listingId: id, reason }, rpc: "report_listing", args: { p_listing_id: id, p_reason: reason } },
  { name: "dispute", handler: dispute, admin: false, body: { reason }, rpc: "open_dispute", args: { p_order_id: id, p_reason: reason } },
  { name: "review", handler: review, admin: true, body: { decision: "reviewed", reason }, rpc: "review_report", args: { p_report_id: id, p_decision: "reviewed", p_reason: reason } },
  { name: "resolve", handler: resolve, admin: true, body: { reason }, rpc: "resolve_dispute", args: { p_dispute_id: id, p_reason: reason } },
  { name: "suspend", handler: suspend, admin: true, body: { suspended: true, reason }, rpc: "set_account_suspension", args: { p_user_id: id, p_suspended: true, p_reason: reason } },
];

function post(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  user = { id: `verified-session-${++sequence}` };
  mocks.requireUser.mockResolvedValue(user);
  mocks.requireAdmin.mockResolvedValue(user);
  mocks.callRpc.mockResolvedValue({ recorded: true });
});
afterEach(() => vi.unstubAllEnvs());

describe.each(cases)("trust safety $name route", ({ handler, admin, body, rpc, args }) => {
  it("passes the verified identity and trimmed reason to the database", async () => {
    const response = await handler(post({ ...body, reason: `  ${reason}  ` }), context());
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith(rpc, args, user.id);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ data: { recorded: true } });
  });
  it("rejects anonymous users before calling the database", async () => {
    (admin ? mocks.requireAdmin : mocks.requireUser).mockRejectedValue(new ServiceError("Sign in", 401, "UNAUTHENTICATED"));
    expect((await handler(post(body), context())).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before authentication", async () => {
    expect((await handler(post(body, "https://attacker.example"), context())).status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects reasons that are missing, short, blank, or too long", async () => {
    for (const invalid of [undefined, "short", "         ", "x".repeat(2001)]) {
      expect((await handler(post({ ...body, reason: invalid }), context())).status).toBe(400);
    }
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects caller-supplied identity and privileged state", async () => {
    expect((await handler(post({ ...body, userId: id, state: "REFUNDED" }), context())).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("preserves database permission failures", async () => {
    mocks.callRpc.mockRejectedValue(new ServiceError("You do not have permission for this action.", 403, "FORBIDDEN"));
    const response = await handler(post(body), context());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
  });
  if (admin) it("requires administrator authorization", async () => {
    mocks.requireAdmin.mockRejectedValue(new ServiceError("Administrator access is required.", 403, "FORBIDDEN"));
    expect((await handler(post(body), context())).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  if (rpc !== "report_listing") it("rejects malformed target ids", async () => {
    expect((await handler(post(body), context("invalid"))).status).toBe(404);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});

describe("trust safety action boundaries", () => {
  it("rejects invalid listing ids", async () => {
    expect((await report(post({ listingId: "invalid", reason }))).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("accepts only the two report review decisions", async () => {
    expect((await review(post({ decision: "dismissed", reason }), context())).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("review_report", { p_report_id: id, p_decision: "dismissed", p_reason: reason }, user.id);
    mocks.callRpc.mockClear();
    expect((await review(post({ decision: "ban", reason }), context())).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("requires an actual boolean for suspension and supports reinstatement", async () => {
    for (const suspended of ["false", "true", 0, 1, null]) {
      expect((await suspend(post({ suspended, reason }), context())).status).toBe(400);
    }
    expect(mocks.callRpc).not.toHaveBeenCalled();
    expect((await suspend(post({ suspended: false, reason }), context())).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("set_account_suspension", { p_user_id: id, p_suspended: false, p_reason: reason }, user.id);
  });
  it("cannot choose a payment or refund outcome when resolving a dispute", async () => {
    expect((await resolve(post({ reason, outcome: "REFUNDED" }), context())).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});
