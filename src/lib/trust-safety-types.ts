export interface TrustReport {
  id: string;
  listing_id: string;
  listing_title: string;
  seller_id: string;
  reason: string;
  status: string;
}

export interface TrustDispute {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  previous_state: string | null;
  resolution_reason: string | null;
}

export interface TrustAccount {
  id: string;
  name: string;
  role: string;
  suspended: boolean;
}

export interface TrustSafetyData {
  reports: TrustReport[];
  disputes: TrustDispute[];
  accounts: TrustAccount[];
}
