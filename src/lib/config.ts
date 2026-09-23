/* Product configuration for AUCTA.
   Figures are operational settings, not contracts. */

export const config = {
  sellerCommissionBps: 700, // 7% of hammer price
  buyerFeeBps: 0, // 0% buyer fee
  paymentWindowHours: 24,
  antiSnipeSeconds: 120,
  reserveNeverShown: true,
} as const;

export type CategorySlug =
  | "watches"
  | "cameras"
  | "cards"
  | "sneakers"
  | "design"
  | "gaming"
  | "electronics"
  | "art";

export const categories: {
  slug: CategorySlug;
  label: string;
  blurb: string;
}[] = [
  {
    slug: "watches",
    label: "Watches",
    blurb: "Mechanical wristwear with a paper trail.",
  },
  {
    slug: "cameras",
    label: "Cameras",
    blurb: "Film bodies, lenses and rangefinders.",
  },
  {
    slug: "cards",
    label: "Cards",
    blurb: "Graded and raw trading cards.",
  },
  {
    slug: "sneakers",
    label: "Sneakers",
    blurb: "Deadstock and grail-tier footwear.",
  },
  {
    slug: "design",
    label: "Design",
    blurb: "Considered objects, furniture and ceramics.",
  },
  {
    slug: "gaming",
    label: "Gaming",
    blurb: "Consoles, handhelds and sealed titles.",
  },
  {
    slug: "electronics",
    label: "Vintage electronics",
    blurb: "Analog audio and pre-digital gear.",
  },
  {
    slug: "art",
    label: "Art",
    blurb: "Prints, paintings and small sculpture.",
  },
];

export const categoryMap = Object.fromEntries(
  categories.map((c) => [c.slug, c]),
) as Record<CategorySlug, (typeof categories)[number]>;

export const conditions = [
  "New",
  "Like New",
  "Excellent",
  "Good",
  "Fair",
  "For Parts",
] as const;
export type Condition = (typeof conditions)[number];

export type LotStatus = "live" | "upcoming" | "sold" | "unsold";

/* Default proxy increments — whole rupiah, decided on the server. */
export function incrementFor(visiblePrice: number): number {
  if (visiblePrice < 1_000_000) return 25_000;
  if (visiblePrice < 5_000_000) return 50_000;
  if (visiblePrice < 20_000_000) return 100_000;
  return 250_000;
}

export const sortOptions = [
  { value: "ending", label: "Ending soon" },
  { value: "newest", label: "Newest" },
  { value: "watched", label: "Most watched" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
] as const;

export const statusTabs = [
  { value: "open", label: "Live & upcoming" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "sold", label: "Sold" },
] as const;
