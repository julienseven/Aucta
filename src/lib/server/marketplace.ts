import "server-only";
import type { AccountData, AdminData, Auction, AuctionDetail, BidActivity, Notification, Order, Seller, SellingData } from "@/lib/domain";
import { getCurrentUser, requireAdmin, requireUser } from "./auth";
import { callRpc } from "./repository";
import { incrementFor } from "@/lib/auction/money";
import { safeReturnPath } from "./runtime";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const str = (value: unknown, fallback = "") => value == null ? fallback : String(value);
const num = (value: unknown, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : str(value, new Date().toISOString());
const bool = (value: unknown) => value === true;

export function sanitizeSeller(value: unknown): Seller {
  const seller = row(value);
  return { id: str(seller.id), name: str(seller.shop_name || seller.name, "Independent collector"), city: str(seller.city, "Indonesia"), province: str(seller.province), verified: bool(seller.verified) || seller.verification_status === "VERIFIED" || seller.verification === "VERIFIED", joinedAt: timestamp(seller.created_at), rating: seller.rating == null ? null : Number(seller.rating), completedSales: num(seller.completed_sales) };
}

export function sanitizeAuction(value: unknown, serverTime = new Date().toISOString()): Auction {
  const auction = row(value), listing = row(auction.listing), category = row(listing.category);
  const currentPrice = num(auction.current_price || auction.starting_price);
  const images = Array.isArray(listing.image_urls) ? listing.image_urls.filter((value): value is string => typeof value === "string") : typeof listing.image_url === "string" ? [listing.image_url] : [];
  const attributes = Object.fromEntries(Object.entries(row(listing.attributes)).filter(([, value]) => typeof value === "string")) as Record<string, string>;
  const conditionMap: Record<string, Auction["condition"]> = { NEW: "New", LIKE_NEW: "Like New", EXCELLENT: "Excellent", GOOD: "Good", FAIR: "Fair", FOR_PARTS: "For Parts" };
  const conditionText = str(listing.condition, "Good");
  const result: Auction = {
    id: str(auction.id), listingId: str(auction.listing_id || listing.id), slug: str(listing.slug, str(auction.id)), title: str(listing.title), subtitle: str(listing.subtitle),
    category: str(category.name || listing.category_name || listing.category_slug, "Collectibles"), categorySlug: str(category.slug || listing.category_slug), brand: str(listing.brand),
    condition: conditionMap[conditionText] || conditionText as Auction["condition"], description: str(listing.description), flaws: str(listing.flaws), provenance: str(listing.provenance), attributes,
    images: images.length ? images : ["/images/camera.png"], imageAlt: str(listing.image_alt, str(listing.title)), seller: sanitizeSeller(auction.seller), status: str(auction.state, "DRAFT") as Auction["status"],
    startingPrice: num(auction.starting_price), currentPrice, minimumBid: num(auction.bid_count) === 0 ? num(auction.starting_price) : currentPrice + incrementFor(currentPrice, num(auction.increment_override) || undefined),
    bidCount: num(auction.bid_count), bidderCount: num(auction.bidder_count), watchCount: num(auction.watch_count), startsAt: timestamp(auction.starts_at), endsAt: timestamp(auction.ends_at), serverTime,
    reserveMet: bool(auction.reserve_met), hasReserve: bool(auction.has_reserve), featured: bool(auction.featured), sample: bool(auction.sample) || bool(listing.sample), shippingAmount: num(auction.shipping_price),
  };
  if (auction.sold_at) result.soldAt = timestamp(auction.sold_at);
  if (typeof auction.is_watching === "boolean") result.isWatching = auction.is_watching;
  if (typeof auction.is_leading === "boolean") result.isLeading = auction.is_leading;
  if (auction.own_maximum != null) result.ownMaximum = num(auction.own_maximum);
  return result;
}

function activity(value: unknown): BidActivity {
  const bid = row(value);
  return { id: str(bid.id), alias: str(bid.bidder_alias || bid.alias, "Collector"), amount: num(bid.amount || bid.visible_price || bid.price), createdAt: timestamp(bid.created_at), automatic: bool(bid.automatic) };
}

export async function browseAuctions(filters: Record<string, string | undefined> = {}): Promise<Auction[]> {
  const data = await callRpc<Row>("catalogue");
  let auctions = rows(data.auctions).map(value => sanitizeAuction(value, timestamp(data.server_time)));
  if (filters.category && filters.category !== "all") auctions = auctions.filter(item => item.categorySlug === filters.category);
  if (filters.q) { const query = filters.q.toLowerCase(); auctions = auctions.filter(item => `${item.title} ${item.brand} ${item.category}`.toLowerCase().includes(query)); }
  if (filters.condition && filters.condition !== "all") auctions = auctions.filter(item => item.condition.toLowerCase() === filters.condition!.toLowerCase());
  if (filters.status && filters.status !== "all") {
    if (filters.status === "sold") auctions = auctions.filter(item => ["PAID", "FULFILLMENT", "COMPLETED"].includes(item.status));
    else auctions = auctions.filter(item => item.status === filters.status!.toUpperCase());
  }
  if (filters.minPrice && Number.isFinite(Number(filters.minPrice))) auctions = auctions.filter(item => item.currentPrice >= Number(filters.minPrice));
  if (filters.maxPrice && Number.isFinite(Number(filters.maxPrice))) auctions = auctions.filter(item => item.currentPrice <= Number(filters.maxPrice));
  if (filters.sort === "price-low") auctions.sort((a, b) => a.currentPrice - b.currentPrice);
  else if (filters.sort === "price-high") auctions.sort((a, b) => b.currentPrice - a.currentPrice);
  else if (filters.sort === "popular") auctions.sort((a, b) => b.watchCount - a.watchCount);
  else if (filters.sort === "newest") auctions.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  else auctions.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  return auctions;
}

export async function getAuction(slugOrId: string): Promise<AuctionDetail | null> {
  const user = await getCurrentUser();
  const data = await callRpc<Row>("auction_detail", { p_slug: slugOrId }, user?.id ?? null);
  if (!data.auction) return null;
  const auction = sanitizeAuction(data.auction, timestamp(data.server_time));
  if (user) {
    auction.isWatching = bool(data.is_watching);
    auction.isLeading = bool(data.is_leading);
    if (data.own_maximum != null) auction.ownMaximum = num(data.own_maximum);
  }
  return { auction, bids: rows(data.bids).map(activity) };
}

async function dashboard() { const user = await requireUser(); return { user, data: await callRpc<Row>("dashboard", {}, user.id) }; }

function notification(value: unknown): Notification {
  const item = row(value), payload = row(item.payload);
  const type = str(item.type);
  return { id: str(item.id), type, title: str(payload.title || item.title || type.replace(/_/g, " ")), message: str(payload.message || item.message, "Your auction activity has been updated."), href: safeReturnPath(payload.href || item.href, "") || undefined, readAt: item.read_at ? timestamp(item.read_at) : null, createdAt: timestamp(item.created_at) };
}

function mapOrders(data: Row, allAuctions: Auction[]): Order[] {
  return rows(data.orders).flatMap(value => {
    const joined = row(value.auction);
    const auction = joined.id ? sanitizeAuction(joined) : allAuctions.find(item => item.id === str(value.auction_id));
    if (!auction) return [];
    const shipment = rows(data.shipments).find(item => item.order_id === value.id);
    const review = rows(data.reviews).find(item => item.order_id === value.id);
    const address = row(value.address || value.shipping_address);
    const order: Order = { id: str(value.id), auctionId: str(value.auction_id), auction, buyerId: str(value.buyer_id), sellerId: str(value.seller_id), status: str(value.state || value.status, "AWAITING_PAYMENT") as Order["status"], winningBid: num(value.winning_bid || value.hammer_price || value.amount), buyerFee: num(value.buyer_fee), sellerFee: num(value.seller_fee), shippingAmount: num(value.shipping_price || value.shipping_amount), total: num(value.total || value.total_amount), paymentDeadline: timestamp(value.payment_deadline), createdAt: timestamp(value.created_at), carrier: shipment ? str(shipment.carrier) : undefined, trackingNumber: shipment ? str(shipment.tracking_number || shipment.tracking) : undefined };
    if (address.name) order.address = { name: str(address.name), phone: str(address.phone), line1: str(address.line1), city: str(address.city), province: str(address.province), postalCode: str(address.postalCode || address.postal_code) };
    if (review) order.review = { rating: num(review.rating), text: str(review.body || review.text) };
    return [order];
  });
}

export async function getAccountData(): Promise<AccountData> {
  const { user, data } = await dashboard();
  const all = [...new Map([...await browseAuctions(), ...rows(data.auctions).map(value => sanitizeAuction(value))].map(auction => [auction.id, auction])).values()];
  const watches = Array.isArray(data.watchlist) ? data.watchlist.map(value => typeof value === "string" ? value : str(row(value).auction_id)) : [];
  return { user, bidding: rows(data.bidding).map(value => sanitizeAuction(value)), watching: all.filter(item => watches.includes(item.id)).map(item => ({ ...item, isWatching: true })), orders: mapOrders(data, all), notifications: rows(data.notifications).map(notification) };
}

export async function getWatchlist(): Promise<Auction[]> { return (await getAccountData()).watching; }

export async function getSellingData(): Promise<SellingData> {
  const { user, data } = await dashboard();
  const auctions = rows(data.auctions).map(value => sanitizeAuction(value));
  const orders = mapOrders(data, [...auctions, ...await browseAuctions()]).filter(order => order.sellerId === user.id);
  return { user, auctions, orders, grossSales: orders.filter(order => ["PAID", "FULFILLMENT", "COMPLETED"].includes(order.status)).reduce((sum, order) => sum + order.winningBid, 0), completedAuctions: auctions.filter(item => item.status === "COMPLETED").length };
}

export async function getAdminData(): Promise<AdminData> {
  const user = await requireAdmin();
  const data = await callRpc<Row>("dashboard", {}, user.id);
  return { pending: rows(data.pending_listings).map(value => sanitizeAuction(value)), live: (await browseAuctions()).filter(item => ["LIVE", "SCHEDULED"].includes(item.status)), sellers: rows(data.pending_sellers).map(sanitizeSeller), reports: rows(data.reports).map(item => ({ id: str(item.id), reason: str(item.reason), status: str(item.state || item.status) })), disputes: rows(data.disputes).map(item => ({ id: str(item.id), reason: str(item.reason), status: str(item.state || item.status), orderId: str(item.order_id) })), audit: rows(data.audit).map(item => ({ id: str(item.id), action: str(item.action), createdAt: timestamp(item.created_at) })) };
}

export async function getOrder(id: string): Promise<Order | null> {
  return (await getAccountData()).orders.find(order => order.id === id) ?? null;
}

export { getCurrentUser } from "./auth";
