import "server-only";
import { z } from "zod";
import { reason, uuid } from "./http";
import { callRpc } from "./repository";

export const reportBody = z.object({ listingId: uuid, reason }).strict();
export const disputeBody = z.object({ reason }).strict();
export const reviewReportBody = z.object({ decision: z.enum(["reviewed", "dismissed"]), reason }).strict();
export const suspensionBody = z.object({ suspended: z.boolean(), reason }).strict();

export function reportListing(listingId: string, detail: string, userId: string) {
  return callRpc("report_listing", { p_listing_id: listingId, p_reason: detail }, userId);
}

export function reviewReport(reportId: string, decision: "reviewed" | "dismissed", detail: string, userId: string) {
  return callRpc("review_report", { p_report_id: reportId, p_decision: decision, p_reason: detail }, userId);
}

export function openDispute(orderId: string, detail: string, userId: string) {
  return callRpc("open_dispute", { p_order_id: orderId, p_reason: detail }, userId);
}

export function resolveDispute(disputeId: string, detail: string, userId: string) {
  return callRpc("resolve_dispute", { p_dispute_id: disputeId, p_reason: detail }, userId);
}

export function setAccountSuspension(accountId: string, suspended: boolean, detail: string, userId: string) {
  return callRpc("set_account_suspension", { p_user_id: accountId, p_suspended: suspended, p_reason: detail }, userId);
}

