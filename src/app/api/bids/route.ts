import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { placeBid, BidError } from "@/lib/auctions";
import {
  clientIp,
  getIdempotent,
  rateLimit,
  setIdempotent,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to place a bid.", code: "AUTH" },
      { status: 401 },
    );
  }

  // Abuse protection: cap bid attempts and repeated identical submissions.
  const ip = clientIp(req);
  const rl = rateLimit(`bid:${user.id}:${ip}`, { limit: 24, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many bids — please slow down.", code: "RATE_LIMITED", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const lotId = String(body?.lotId ?? "");
  const amount = Number(body?.amount);

  // Idempotency: a repeated identical bid (double-click / retry) returns the
  // prior response instead of mutating state twice.
  const idemKey =
    (req.headers.get("idempotency-key") ||
      `bid:${user.id}:${lotId}:${amount}`) +
    ":" +
    Math.floor(Date.now() / 60_000);
  const cached = getIdempotent(idemKey);
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.status });
  }

  if (!lotId)
    return NextResponse.json(
      { error: "Missing lot.", code: "NOT_FOUND" },
      { status: 400 },
    );
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json(
      { error: "Enter a whole rupiah amount.", code: "NOT_WHOLE" },
      { status: 400 },
    );

  try {
    const result = await placeBid(lotId, user, amount);
    const payload = {
      ok: true,
      current: result.state.current,
      nextMin: result.state.nextMin,
      leadingAlias: result.state.leaderAlias,
      reserveMet: result.state.reserveMet,
      bidCount: result.state.bidCount,
      extended: result.extended,
      raised: result.raised,
      leading: result.state.leaderAlias === user.alias,
      endsAt: result.endsAt.toISOString(),
    };
    setIdempotent(idemKey, 200, payload);
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof BidError) {
      const body = {
        error: err.message,
        code: err.code,
        amount: err.meta?.amount,
      };
      return NextResponse.json(body, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: "The bid could not be recorded. Please try again.", code: "GENERIC" },
      { status: 500 },
    );
  }
}
