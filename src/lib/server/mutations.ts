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
