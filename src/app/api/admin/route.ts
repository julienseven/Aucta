import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { performAdminAction, isAdmin, type AdminAction } from "@/lib/admin";
import { isSameOriginRequest } from "@/lib/security";

export const dynamic = "force-dynamic";

const ACTIONS: AdminAction[] = [
  "approve_seller",
  "reject_seller",
  "approve_listing",
  "reject_listing",
  "pause_listing",
  "resume_listing",
  "withdraw_listing",
  "resolve_report",
  "dismiss_report",
  "resolve_dispute",
  "suspend_user",
  "reinstate_user",
  "dismiss_payment",
  "issue_refund",
];

export async function POST(req: Request) {
  if (!isSameOriginRequest(req))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const user = await getSessionUser().catch(() => null);
  if (!isAdmin(user))
    return NextResponse.json({ error: "Desk access required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "") as AdminAction;
  if (!ACTIONS.includes(action))
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (typeof body?.id !== "string")
    return NextResponse.json({ error: "Missing target id." }, { status: 400 });

  try {
    await performAdminAction(user, action, {
      id: body.id,
      reason: body?.reason ? String(body.reason) : undefined,
      resolution: body?.resolution ? String(body.resolution) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Action failed." },
      { status: 500 },
    );
  }
}
