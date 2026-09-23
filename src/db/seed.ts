import { db } from "@/db";
import {
  adminEvents,
  bidEvents,
  bids,
  disputes,
  lots,
  orders,
  reports,
  users,
  watchlist,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { incrementFor } from "@/lib/config";
import { seedOperations } from "@/db/seed-ops";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

type SeedLot = {
  slug: string;
  title: string;
  category: string;
  condition: string;
  status: "live" | "upcoming" | "sold";
  description: string;
  flaws: string;
  provenance: string;
  sellerCity: string;
  sellerProvince: string;
  image: string;
  start: number;
  reserve?: number;
  current: number;
  sold?: number;
  bids: number;
  watches: number;
  startsAt: Date;
  endsAt: Date;
};

const HOUR = 3_600_000;

const seedLots: SeedLot[] = [
  /* ---------------------------- LIVE ---------------------------- */
  {
    slug: "seiko-6139-pogue-chronograph-1973",
    title: "Seiko 6139-6012 “Pogue” Chronograph, 1973",
    category: "watches",
    condition: "Good",
    status: "live",
    description:
      "The gold-toned chronograph worn by Colonel Pogue on the Skylab mission — widely regarded as the first automatic chronograph in space. This 6139-6012 has the original champagne dial, Pepsi bezel and the creamy lume collectors look for. The 6139 column-wheel movement was recently serviced and all chronograph functions reset to zero.",
    flaws:
      "Light wear to the high points of the case. The bezel insert shows a faint hairline near 20 minutes. One bracelet end link is a period-correct replacement.",
    provenance:
      "Consigned by the family of the original owner, purchased new in Singapore in 1974. Serviced in Bandung, 2024, with receipt.",
    sellerCity: "Bandung",
    sellerProvince: "West Java",
    image: "/images/lots/watch-3.jpg",
    start: 8_500_000,
    reserve: 15_000_000,
    current: 12_650_000,
    bids: 19,
    watches: 142,
    startsAt: hoursAgo(30),
    endsAt: hoursFromNow(1.6),
  },
  {
    slug: "frederique-constant-highlife-full-set",
    title: "Frédérique Constant Highlife Automatic, Full Set",
    category: "watches",
    condition: "Like New",
    status: "live",
    description:
      "Modern Highlife with the guilloché silver dial, applied indices and the integrated bracelet that made the collection desirable. Automatic FC-303 movement, 38mm steel case, sapphire crystal. Worn lightly in an office rotation; it presents like a fresh delivery.",
    flaws:
      "A single desk-diving hairline on the clasp, invisible on the wrist. Bracelet sized to 17cm with spare links retained.",
    provenance:
      "Purchased from an authorised dealer in Jakarta, 2023. Warranty card, inner and outer boxes, hangtag and booklet included.",
    sellerCity: "Jakarta Selatan",
    sellerProvince: "DKI Jakarta",
    image: "/images/lots/watch-1.jpg",
    start: 16_000_000,
    reserve: 20_000_000,
    current: 21_500_000,
    bids: 7,
    watches: 64,
    startsAt: hoursAgo(12),
    endsAt: hoursFromNow(96),
  },
  {
    slug: "leica-iiic-summitar-50-f2-1949",
    title: "Leica IIIc with Summitar 5cm f/2, 1949",
    category: "cameras",
    condition: "Good",
    status: "live",
    description:
      "A post-war IIIc screw-mount body in working order, paired with a coated Summitar 5cm f/2 — the fast collapsible standard lens of its era. Shutter speeds are accurate across the range, rangefinder patch is clear with good contrast, and the cloth curtain is intact.",
    flaws:
      "Brassing on the top plate corners and around the rewind lever. Light internal dust that does not affect images. Summitar has a small cleaning mark on the rear element.",
    provenance:
      "From a retired press photographer's collection in Yogyakarta. CLA by a specialist in Surakarta, 2025.",
    sellerCity: "Yogyakarta",
    sellerProvince: "DI Yogyakarta",
    image: "/images/lots/camera-3.jpg",
    start: 6_000_000,
    current: 9_800_000,
    reserve: 11_000_000,
    bids: 14,
    watches: 98,
    startsAt: hoursAgo(20),
    endsAt: hoursFromNow(6),
  },
  {
    slug: "zeiss-ikon-prontor-folding-camera-1956",
    title: "Zeiss Ikon Nettar Folding Camera, 1956",
    category: "cameras",
    condition: "Fair",
    status: "live",
    description:
      "A gentle entry into folding cameras: bellows-carrying 120 film body with Novar lens and Prontor shutter. Opens with the familiar clack, frame counter works, and the red-window winding is smooth. A beautiful object even on a shelf.",
    flaws:
      "Bellows are light-tight but show corner creasing. Shutter slow speeds below 1/30 are approximate. Sold as a user / display piece, not a freshly CLA'd tool.",
    provenance: "Estate sale, Malang. Stored in the original leather ERC for 40 years.",
    sellerCity: "Malang",
    sellerProvince: "East Java",
    image: "/images/lots/camera-2.jpg",
    start: 400_000,
    current: 1_150_000,
    bids: 9,
    watches: 37,
    startsAt: hoursAgo(8),
    endsAt: hoursFromNow(28),
  },
  {
    slug: "holo-elemental-bird-first-edition-psa9",
    title: "Holo Elemental Bird, First Edition (PSA 9)",
    category: "cards",
    condition: "Like New",
    status: "live",
    description:
      "The fan favourite of the first base set, slabbed Mint 9 with clean centering and a scratch-free holo window. First-edition print run, pre-errata text on the lower frame. Ships in the slab with the grading certificate number recorded in the listing photos.",
    flaws:
      "Whitest-white grade is 9 rather than 9.5 due to a micro touch on one lower corner — visible only under loupe.",
    provenance:
      "Pulled in Bali in 2015 and kept in a UV-protected box until grading in 2024.",
    sellerCity: "Denpasar",
    sellerProvince: "Bali",
    image: "/images/lots/card-1.jpg",
    start: 2_000_000,
    reserve: 3_500_000,
    current: 3_200_000,
    bids: 11,
    watches: 76,
    startsAt: hoursAgo(26),
    endsAt: hoursFromNow(0.7),
  },
  {
    slug: "origins-booster-pack-trio-sealed",
    title: "Origins Booster Pack Trio, Factory Sealed",
    category: "cards",
    condition: "New",
    status: "live",
    description:
      "Three factory-sealed booster packs from the original Origins print run, each showing intact crimp seals and uncreased foil. Held as a set since release; photographed under neutral light so the holo patterns can be inspected.",
    flaws: "One pack has a 2mm soft touch at the upper seal corner. No tears, no re-seals.",
    provenance: "Single-owner collection, Jakarta, kept in a humidity-controlled cabinet.",
    sellerCity: "Jakarta Pusat",
    sellerProvince: "DKI Jakarta",
    image: "/images/lots/card-2.jpg",
    start: 1_200_000,
    current: 1_850_000,
    bids: 5,
    watches: 41,
    startsAt: hoursAgo(6),
    endsAt: hoursFromNow(70),
  },
  {
    slug: "new-balance-990v3-deadstock-us10",
    title: "New Balance 990v3 Made in USA, Deadstock US 10",
    category: "sneakers",
    condition: "New",
    status: "live",
    description:
      "The grey-suede 990v3 that defined dad-shoe grail status — mesh panels, 990-series tooling and the Made in USA tag. Deadstock with box, paper and uncut spare laces. Tried-on outsoles are untouched; the glue lines are clean.",
    flaws: "Box lid has light shelf wear. Yellowing on the midsole is within the normal range for this release.",
    provenance: "Bought at a US boutique, stored with silica packs since 2022.",
    sellerCity: "Surabaya",
    sellerProvince: "East Java",
    image: "/images/lots/sneaker-1.jpg",
    start: 3_000_000,
    reserve: 4_500_000,
    current: 4_200_000,
    bids: 8,
    watches: 55,
    startsAt: hoursAgo(14),
    endsAt: hoursFromNow(8),
  },
  {
    slug: "playstation-scph1000-boxed-1994",
    title: "PlayStation SCPH-1000 Launch Model, Boxed (1994)",
    category: "gaming",
    condition: "Excellent",
    status: "live",
    description:
      "The Japanese launch SCPH-1000 with the rare S-video capable early board and the famously sturdy mech. Reads original pressed discs across multiple regions on this unit; the original controller, AV and power leads, manuals and the stamped outer carton are all present.",
    flaws:
      "Yellowing of the top shell is light and even. One internal memory-port cover is missing. Lens assembly cleaned and calibrated this year.",
    provenance: "Imported to Jakarta in 1995 by a Japanese expatriate family; second owner since 2009.",
    sellerCity: "Jakarta Timur",
    sellerProvince: "DKI Jakarta",
    image: "/images/lots/gaming-1.jpg",
    start: 3_000_000,
    current: 4_700_000,
    reserve: 5_500_000,
    bids: 13,
    watches: 89,
    startsAt: hoursAgo(22),
    endsAt: hoursFromNow(5),
  },
  {
    slug: "steam-deck-oled-1tb-sealed",
    title: "Steam Deck OLED 1TB, Factory Sealed",
    category: "gaming",
    condition: "New",
    status: "live",
    description:
      "The 1TB OLED model with the HDR screen and Wi-Fi 6E board, factory sealed in the valve wrapper. Full manufacturer warranty starts from the buyer's purchase date; receipt included. Region-free, English interface.",
    flaws: "None — sealed. Outer shipping box shows a single light crease.",
    provenance: "Ordered direct in the most recent shipment window; surplus to the consignor's needs.",
    sellerCity: "Tangerang",
    sellerProvince: "Banten",
    image: "/images/lots/gaming-2.jpg",
    start: 7_500_000,
    current: 8_900_000,
    bids: 4,
    watches: 33,
    startsAt: hoursAgo(4),
    endsAt: hoursFromNow(50),
  },
  {
    slug: "studio-stoneware-vase-signed",
    title: "Studio Stoneware Vase, Signed, Bandung Atelier",
    category: "design",
    condition: "Excellent",
    status: "live",
    description:
      "A hand-thrown stoneware vase with an ash glaze that breaks warm at the shoulder. Balanced 24cm silhouette, maker's chop stamped at the foot. Fired in a wood-kiln outside Bandung; each piece in the run is unique.",
    flaws:
      "A deliberate glaze skip near the base documented in the photographs. No cracks, chips or repairs.",
    provenance: "Acquired directly from the maker's 2023 open-kiln sale.",
    sellerCity: "Bandung",
    sellerProvince: "West Java",
    image: "/images/lots/design-1.jpg",
    start: 600_000,
    current: 1_450_000,
    bids: 6,
    watches: 28,
    startsAt: hoursAgo(9),
    endsAt: hoursFromNow(9),
  },
  {
    slug: "portable-mw-sw-radio-c1978",
    title: "Portable MW/SW Transistor Radio, c.1978",
    category: "electronics",
    condition: "Fair",
    status: "live",
    description:
      "A leather-cased portable multiband radio from the golden age of shortwave. Medium wave and two shortwave bands; the analogue dial glows warm under the lamp. Tuning is smooth, volume pot is quiet after a clean. Runs on four D cells or the included DC adapter.",
    flaws:
      "One dial lamp is out. Leather case has softened at the corners. SW reception in dense urban areas is limited — expected for a set of this age.",
    provenance: "Marked to a Semarang household, found during a family-home clear-out in 2024.",
    sellerCity: "Semarang",
    sellerProvince: "Central Java",
    image: "/images/lots/radio-1.jpg",
    start: 150_000,
    current: 480_000,
    bids: 12,
    watches: 19,
    startsAt: hoursAgo(3),
    endsAt: hoursFromNow(7),
  },
  {
    slug: "abstract-composition-oil-board",
    title: "Abstract Composition in Rust, Oil on Board",
    category: "art",
    condition: "Good",
    status: "live",
    description:
      "A 40×50cm oil on hardboard in the warm abstract expressionist register — rust, black and bone whites layered with a palette knife. Signed and dated '01 on the reverse, presented in a stained oak float frame.",
    flaws:
      "Minor craquelure consistent with age. Two pinhole-era marks at the top edge, hidden by the frame lip.",
    provenance: "From a private collection of Indonesian post-2000 abstract works, Ubud.",
    sellerCity: "Gianyar",
    sellerProvince: "Bali",
    image: "/images/lots/art-1.jpg",
    start: 1_500_000,
    current: 2_900_000,
    bids: 7,
    watches: 24,
    startsAt: hoursAgo(18),
    endsAt: hoursFromNow(27),
  },

  /* -------------------------- UPCOMING -------------------------- */
  {
    slug: "omega-seamaster-cosmic-2000-1972",
    title: "Omega Seamaster Cosmic 2000, 1972",
    category: "watches",
    condition: "Good",
    status: "upcoming",
    description:
      "The tonneau-cased Cosmic 2000 with the deep-blue crosshair dial and original bracelet. Calibre 1012 automatic, freshly serviced with a one-year workshop guarantee. Opening bids start at the guide below when the catalogue opens.",
    flaws:
      "Crystal carries a light polishable mark. Bracelet has stretch appropriate to fifty years, rated 7/10.",
    provenance: "Swiss-market watch, consigned through a Medan collector.",
    sellerCity: "Medan",
    sellerProvince: "North Sumatra",
    image: "/images/lots/watch-2.jpg",
    start: 7_500_000,
    current: 7_500_000,
    bids: 0,
    watches: 51,
    startsAt: hoursFromNow(30),
    endsAt: hoursFromNow(102),
  },
  {
    slug: "canon-ae1-program-kit-1983",
    title: "Canon AE-1 Program with 50mm f/1.8, 1983",
    category: "cameras",
    condition: "Excellent",
    status: "upcoming",
    description:
      "The student classic that taught a generation to shoot on film: shutter-priority AE-1 Program body with the reliable nFD 50mm f/1.8. Meter responds, seals replaced this decade, battery tested. A perfect first film camera.",
    flaws: "Light brightening of the black paint on the prism edges. Lens barrel engraving is worn.",
    provenance: "Single-owner, Makassar, with the original foam-lined case.",
    sellerCity: "Makassar",
    sellerProvince: "South Sulawesi",
    image: "/images/lots/camera-1.jpg",
    start: 1_800_000,
    current: 1_800_000,
    bids: 0,
    watches: 29,
    startsAt: hoursFromNow(14),
    endsAt: hoursFromNow(86),
  },
  {
    slug: "adidas-campus-00s-collab-us9",
    title: "adidas Campus 00s Collaboration, US 9",
    category: "sneakers",
    condition: "New",
    status: "upcoming",
    description:
      "The suede-heavy Campus 00s collaboration colourway in its limited box, deadstock with tags. Chunky tongue, gum outsole and the tonal stitching that sold the release out within an hour.",
    flaws: "None. Box is crisp with all tissue and inserts.",
    provenance: "Won via raffle; never worn, consigned before first lace-up.",
    sellerCity: "Bandung",
    sellerProvince: "West Java",
    image: "/images/lots/sneaker-2.jpg",
    start: 1_400_000,
    current: 1_400_000,
    bids: 0,
    watches: 68,
    startsAt: hoursFromNow(52),
    endsAt: hoursFromNow(124),
  },
  {
    slug: "seashore-study-acrylic-3-of-12",
    title: "Seashore Study III/XII, Acrylic on Linen",
    category: "art",
    condition: "Excellent",
    status: "upcoming",
    description:
      "Numbered 3 of 12 from a small acrylic series on raw linen, 50×60cm. Earthy bands of pigment over a stone-coloured ground — the series explores tidal light at the south coast. Sold unframed, shipped rolled in a tube.",
    flaws: "Studio-fresh, no condition issues.",
    provenance: "Acquired from the artist directly during a 2025 studio visit.",
    sellerCity: "Yogyakarta",
    sellerProvince: "DI Yogyakarta",
    image: "/images/lots/art-2.jpg",
    start: 900_000,
    current: 900_000,
    bids: 0,
    watches: 17,
    startsAt: hoursFromNow(40),
    endsAt: hoursFromNow(112),
  },

  /* ---------------------------- SOLD ---------------------------- */
  {
    slug: "heuer-carrera-re-edition-2002",
    title: "Heuer Carrera Re-edition Chronograph, 2002",
    category: "watches",
    condition: "Excellent",
    status: "sold",
    description:
      "The faithful 39mm Carrera re-edition with the panda dial and hand-wound Lemania-based calibre. One of 2,000 pieces; the full-register layout is textbook 1960s Heuer.",
    flaws: "Light strap wear; case is unpolished with crisp lugs.",
    provenance: "Original owner, Jakarta, with punched guarantee and boxes.",
    sellerCity: "Jakarta Pusat",
    sellerProvince: "DKI Jakarta",
    image: "/images/lots/watch-4.jpg",
    start: 18_000_000,
    current: 31_200_000,
    sold: 31_200_000,
    bids: 41,
    watches: 203,
    startsAt: hoursAgo(24 * 12),
    endsAt: hoursAgo(24 * 5),
  },
  {
    slug: "atelier-oak-lounge-chair-2019",
    title: "Atelier Oak & Linen Lounge Chair, 2019",
    category: "design",
    condition: "Like New",
    status: "sold",
    description:
      "A low-slung lounge chair in whitewashed oak with undyed linen webbing, produced by a small Jepara atelier in a numbered run of 30. Disassembles flat for shipping; hardware stamped and bagged.",
    flaws: "Two water marks on one arm, treated and stable. Webbing is taut.",
    provenance: "First owner, architectural practice in Sanur.",
    sellerCity: "Denpasar",
    sellerProvince: "Bali",
    image: "/images/lots/design-2.jpg",
    start: 5_000_000,
    current: 9_600_000,
    sold: 9_600_000,
    bids: 22,
    watches: 118,
    startsAt: hoursAgo(24 * 20),
    endsAt: hoursAgo(24 * 9),
  },
  {
    slug: "belt-drive-turntable-serviced",
    title: "Belt-Drive Turntable, Serviced with New Cartridge",
    category: "electronics",
    condition: "Good",
    status: "sold",
    description:
      "A heavy-plinth two-speed belt-drive turntable, fully serviced: new belt, fresh oil, recalibrated tonearm and a budget moving-magnet cartridge with under ten hours of use. 33⅓ and 45 verified against a strobe.",
    flaws:
      "Hinge dampers for the dust cover are tired (cover holds open but lowers freely). Feet are replacements.",
    provenance: "Hi-fi enthusiast clearance, Bandung.",
    sellerCity: "Bandung",
    sellerProvince: "West Java",
    image: "/images/lots/vinyl-1.jpg",
    start: 2_500_000,
    current: 5_250_000,
    sold: 5_250_000,
    bids: 16,
    watches: 47,
    startsAt: hoursAgo(24 * 26),
    endsAt: hoursAgo(24 * 16),
  },
  {
    slug: "origins-elite-trainer-box-2020",
    title: "Origins Elite Trainer Box, 2020 Print Run",
    category: "cards",
    condition: "New",
    status: "sold",
    description:
      "Sealed elite trainer box with eight boosters, sleeves, dice and the metal condition counter. Case-fresh seals and a tight cello wrap with normal shelf handling.",
    flaws: "Corner touch on one lower edge of the outer box.",
    provenance: "Retail overstock from a Bali game café that closed in 2024.",
    sellerCity: "Denpasar",
    sellerProvince: "Bali",
    image: "/images/lots/card-2.jpg",
    start: 4_000_000,
    current: 7_400_000,
    sold: 7_400_000,
    bids: 27,
    watches: 93,
    startsAt: hoursAgo(24 * 15),
    endsAt: hoursAgo(24 * 3),
  },
  {
    slug: "playstation-scph5501-boxed-1997",
    title: "PlayStation SCPH-5501, Boxed NTSC Set, 1997",
    category: "gaming",
    condition: "Good",
    status: "sold",
    description:
      "The revised, quieter SCPH-5501 dual-shock-era model with the later serial port and the original dual-analog controller. Reads pressed and CD-R media; box, manual and demo disc included.",
    flaws: "Controller sticks show thumb wear; console top has light scuffing. Fully tested.",
    provenance: "US-service family posting, Palembang.",
    sellerCity: "Palembang",
    sellerProvince: "South Sumatra",
    image: "/images/lots/gaming-1.jpg",
    start: 1_500_000,
    current: 3_650_000,
    sold: 3_650_000,
    bids: 18,
    watches: 61,
    startsAt: hoursAgo(24 * 11),
    endsAt: hoursAgo(24 * 1),
  },
];

const bidderAliases = [
  { email: "seed-merak@aucta.local", alias: "merak*42" },
  { email: "seed-garuda@aucta.local", alias: "garuda*07" },
  { email: "seed-bamboo@aucta.local", alias: "bamboo*19" },
  { email: "seed-raden@aucta.local", alias: "raden*88" },
  { email: "seed-celuluk@aucta.local", alias: "celuluk*03" },
  { email: "seed-topeng@aucta.local", alias: "topeng*55" },
];

export async function seedDatabase(force = false): Promise<void> {
  const existing = await db.select({ id: lots.id }).from(lots).limit(1);
  if (existing.length > 0 && !force) return;

  if (force) {
    await db.delete(disputes);
    await db.delete(reports);
    await db.delete(orders);
    await db.delete(bidEvents);
    await db.delete(adminEvents);
    await db.delete(bids);
    await db.delete(watchlist);
    await db.delete(lots);
    await db.delete(users);
  }

  const bidderRows = [];
  for (const b of bidderAliases) {
    const rows = await db
      .insert(users)
      .values({ email: b.email, alias: b.alias, provider: "seed", displayName: b.alias })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (rows[0]) bidderRows.push(rows[0]);
  }
  const allBidders =
    bidderRows.length === bidderAliases.length
      ? bidderRows
      : await db
        .select()
        .from(users)
        .where(inArray(users.email, bidderAliases.map((b) => b.email)));

  for (const seed of seedLots) {
    const [lot] = await db
      .insert(lots)
      .values({
        slug: seed.slug,
        title: seed.title,
        category: seed.category,
        condition: seed.condition,
        status: seed.status,
        description: seed.description,
        flaws: seed.flaws,
        provenance: seed.provenance,
        sellerCity: seed.sellerCity,
        sellerProvince: seed.sellerProvince,
        image: seed.image,
        images: [seed.image],
        stage: "house",
        startAmount: seed.start,
        reserveAmount: seed.reserve ?? null,
        currentAmount: seed.current,
        soldAmount: seed.sold ?? null,
        bidCount: seed.bids,
        watchCount: seed.watches,
        startsAt: seed.startsAt,
        endsAt: seed.endsAt,
      })
      .returning();

    if (!lot) continue;

    /* Fabricate a believable proxy-bid history behind the visible price. */
    if ((seed.status === "live" || seed.status === "sold") && seed.bids > 0) {
      const inc = incrementFor(seed.current);
      const leader = allBidders[seed.title.length % allBidders.length];
      const runner = allBidders[(seed.title.length + 2) % allBidders.length];
      const leaderMax =
        seed.status === "sold" ? seed.current : seed.current + inc * 2;
      const runnerMax = Math.max(
        seed.start,
        seed.current - inc,
      );
      const thirdMax = Math.max(seed.start, seed.current - inc * 4);

      const seededBids = await db
        .insert(bids)
        .values([
          {
            lotId: lot.id,
            userId: runner.id,
            alias: runner.alias,
            maxAmount: thirdMax,
            createdAt: new Date(seed.startsAt.getTime() + 1 * HOUR),
          },
          {
            lotId: lot.id,
            userId: runner.id,
            alias: runner.alias,
            maxAmount: runnerMax,
            createdAt: new Date(seed.endsAt.getTime() - 5 * HOUR),
          },
          {
            lotId: lot.id,
            userId: leader.id,
            alias: leader.alias,
            maxAmount: leaderMax,
            createdAt: new Date(seed.endsAt.getTime() - 2 * HOUR),
          },
        ])
        .returning();

      await db.insert(bidEvents).values(
        seededBids.map((bd) => ({
          lotId: lot.id,
          lotSlug: lot.slug,
          bidId: bd.id,
          userId: bd.userId,
          alias: bd.alias,
          type: "bid_placed",
          amount: bd.maxAmount,
          createdAt: bd.createdAt,
        })),
      );

      await db
        .update(lots)
        .set({ leadingAlias: leader.alias })
        .where(eq(lots.id, lot.id));
    }
  }

  await seedOperations();
}
