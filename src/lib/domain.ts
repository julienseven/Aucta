/** Public application DTOs. Never add reserve amounts or competitors' ceilings. */
export type AuctionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'AWAITING_PAYMENT' | 'PAID' | 'FULFILLMENT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'NO_SALE' | 'PAYMENT_FAILED' | 'DISPUTED' | 'REFUNDED';
export type Condition = 'New' | 'Like New' | 'Excellent' | 'Good' | 'Fair' | 'For Parts';
export interface Category { id: string; slug: string; name: string; }
export interface Seller { id: string; name: string; city: string; province?: string; verified: boolean; joinedAt: string; rating: number | null; completedSales: number; }
export interface Auction {
  id: string; listingId: string; slug: string; title: string; subtitle?: string;
  category: string; categorySlug: string; brand: string; condition: Condition;
  description: string; flaws: string; provenance: string; attributes: Record<string, string>;
  images: string[]; imageAlt: string; seller: Seller; status: AuctionStatus;
  startingPrice: number; currentPrice: number; minimumBid: number; bidCount: number; bidderCount: number; watchCount: number;
  startsAt: string; endsAt: string; serverTime: string; reserveMet: boolean; hasReserve: boolean;
  featured: boolean; sample: boolean; shippingAmount: number;
  soldAt?: string; isWatching?: boolean; isLeading?: boolean; ownMaximum?: number;
}
export interface BidActivity { id: string; alias: string; amount: number; createdAt: string; automatic?: boolean; }
export interface AuctionDetail { auction: Auction; bids: BidActivity[]; }
export interface User { id: string; name: string; email?: string; role: 'buyer' | 'seller' | 'admin'; local: boolean; sellerVerified?: boolean; }
export interface Notification { id: string; type: string; title: string; message: string; href?: string; readAt?: string | null; createdAt: string; }
export interface Address { name: string; phone: string; line1: string; city: string; province: string; postalCode: string; }
export interface Order {
  id: string; auctionId: string; auction: Auction; buyerId: string; sellerId: string;
  status: AuctionStatus; winningBid: number; buyerFee: number; sellerFee: number; shippingAmount: number; total: number;
  paymentDeadline: string; createdAt: string; address?: Address; carrier?: string; trackingNumber?: string; review?: {rating: number; text: string};
}
export interface AccountData { user: User; bidding: Auction[]; watching: Auction[]; orders: Order[]; notifications: Notification[]; }
export interface SellingData { user: User; auctions: Auction[]; orders: Order[]; grossSales: number; completedAuctions: number; }
export interface AdminData { pending: Auction[]; live: Auction[]; sellers: Seller[]; reports: Array<{id: string; reason: string; status: string}>; disputes: Array<{id: string; reason: string; status: string; orderId: string}>; audit: Array<{id: string; action: string; createdAt: string}>; }
export interface ListingDraft {
  title: string; category: string; brand: string; description: string; condition: Condition; flaws: string; provenance: string;
  attributes: Record<string, string>; images: string[]; startingPrice: number; reservePrice?: number; increment?: number;
  durationHours: number; scheduledStart?: string; shippingAmount: number; city: string;
}
