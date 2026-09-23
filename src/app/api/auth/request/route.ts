import { NextResponse } from "next/server";
import { issueAuthToken, localDemoEnabled } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit, safeRedirect } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const next = safeRedirect(body?.next, "/account");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address.", code: "BAD_EMAIL" },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const rl = rateLimit(`auth:${email}`, { limit: 5, windowMs: 15 * 60_000 });
  const ipRl = rateLimit(`auth-ip:${ip}`, { limit: 12, windowMs: 15 * 60_000 });
  if (!rl.ok || !ipRl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let issued;
  try {
    issued = await issueAuthToken(email);
  } catch (error) {
    const limited = error instanceof Error && error.message === "AUTH_RATE_LIMITED";
    return NextResponse.json({ error: limited ? "Too many requests. Try again later." : "Sign-in is temporarily unavailable." }, { status: limited ? 429 : 503 });
  }
  const link = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/auth/callback?token=${encodeURIComponent(
    issued.token,
  )}&next=${encodeURIComponent(next)}`;

  const subject = "Your AUCTA sign-in code";
  const text = `Your one-time AUCTA sign-in code is ${issued.code}.

It expires in 15 minutes. You can also sign in directly with this link:
${link}

If you didn't request this, you can ignore the email.`;

  const delivery = await sendEmail({ to: email, subject, text });
  if (!delivery.sent && !localDemoEnabled()) return NextResponse.json({ error: "Email delivery is not configured or is unavailable. Please try again later." }, { status: 503 });

  // In local/preview without SMTP, surface the code so the journey is testable.
  const isDev = localDemoEnabled() && !delivery.sent;
  return NextResponse.json({
    ok: true,
    email,
    devCode: isDev ? issued.code : undefined,
    next,
  });
}
