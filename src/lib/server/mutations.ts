import "server-only";
import { callRpc, callServiceRpc } from "./repository";

export function setWatch(auctionId: string, watching: boolean, userId: string) {
  return callRpc<{ watching: boolean; watch_count: number }>("set_watch", { p_auction_id: auctionId, p_watching: watching }, userId);
}

export function placeBid(auctionId: string, maximum: number, idempotencyKey: string, userId: string) {
  return callRpc("place_bid", { p_auction_id: auctionId, p_maximum: maximum, p_idempotency_key: idempotencyKey }, userId);
}

export function settleDue(limit = 50) {
  return callServiceRpc("settle_due", { p_limit: limit });
}

export function applySeller(shopName: string, city: string, province: string, userId: string) {
  return callRpc("apply_seller", { p_shop_name: shopName, p_city: city, p_province: province }, userId);
}

export function saveListingDraft(listingId: string | null, payload: object, userId: string) {
  return callRpc("save_listing_draft", { p_listing_id: listingId, p_payload: payload }, userId);
}

export function submitListing(listingId: string, userId: string) {
  return callRpc("submit_listing", { p_listing_id: listingId }, userId);
}

export function listingEditor(listingId: string, userId: string) {
  return callRpc("listing_editor", { p_listing_id: listingId }, userId);
}

export function moderateListing(listingId: string, decision: string, reason: string, userId: string) {
  return callRpc("moderate_listing", { p_listing_id: listingId, p_decision: decision, p_reason: reason }, userId);
}

export function moderateSeller(sellerId: string, decision: string, reason: string, userId: string) {
  return callRpc("moderate_seller", { p_seller_id: sellerId, p_decision: decision, p_reason: reason }, userId);
}
