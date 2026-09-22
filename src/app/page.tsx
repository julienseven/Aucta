import Image from 'next/image';
import Link from 'next/link';
import { AuctionCard } from '@/components/auction-card';
import { Countdown } from '@/components/countdown';
import { ArrowRight, ArrowUpRight, Eye, Gavel, ShieldCheck } from '@/components/icons';
import { formatIDR } from '@/lib/auction';
import { browseAuctions } from '@/lib/server/marketplace';

const categories = [
  ['Watches', 'watches'],
  ['Cameras', 'cameras'],
  ['Cards', 'cards'],
  ['Sneakers', 'sneakers'],
  ['Design', 'design'],
  ['Gaming', 'gaming'],
] as const;

const trustPrinciples = [
  { number: '01', icon: ShieldCheck, title: 'Know the seller.', copy: 'Seller verification and clear condition standards help you assess every lot.', href: '/seller-policy', link: 'Seller standards' },
  { number: '02', icon: Gavel, title: 'Let the market decide.', copy: 'Public bidding, private maximums and fair extensions keep competition transparent.', href: '/auction-rules', link: 'Auction rules' },
  { number: '03', icon: Eye, title: 'Look closely.', copy: 'Detailed imagery and honest descriptions give you the context to bid carefully.', href: '/buyer-protection', link: 'Buyer protection' },
] as const;

export default async function Home() {
  let auctions: Awaited<ReturnType<typeof browseAuctions>> = [];
  let catalogueUnavailable = false;
  try { auctions = await browseAuctions(); } catch { catalogueUnavailable = true; }

  const live = auctions.filter((auction) => auction.status === 'LIVE');
  const featured = live.find((auction) => auction.featured) ?? live[0];
  const sold = auctions.filter((auction) => ['COMPLETED', 'PAID', 'FULFILLMENT'].includes(auction.status));
  const ending = [...live].sort((a, b) => a.endsAt.localeCompare(b.endsAt)).slice(0, 3);
  const verifiedSellers = new Set(auctions.filter((auction) => auction.seller.verified).map((auction) => auction.seller.id)).size;
  const totalBids = live.reduce((sum, auction) => sum + auction.bidCount, 0);
  const pulse = [
    { label: 'Live lots', value: live.length, detail: live.length === 1 ? 'auction active' : 'auctions active' },
    { label: 'Verified sellers', value: verifiedSellers, detail: verifiedSellers === 1 ? 'seller on the floor' : 'sellers on the floor' },
    { label: 'Open bids', value: totalBids, detail: totalBids === 1 ? 'bid in motion' : 'bids in motion' },
  ];

  return <>
    {catalogueUnavailable && <div className="page"><p className="error-banner" role="alert">The catalogue is temporarily unavailable. Please try again shortly.</p></div>}

    <section className="hero editorial-hero" aria-labelledby="home-heading">
      <div className="hero-copy editorial-hero-copy">
        <p className="eyebrow hero-eyebrow"><span className="little-line" />An Indonesian auction house for collectible objects</p>
        <h1 id="home-heading">Rare things.<br /><em>Real prices.</em></h1>
        <p>Discover considered objects, follow the bidding and decide what each one is worth.</p>
        <Link className="button hero-cta" href="/auctions">Explore the auctions <ArrowUpRight size={18} aria-hidden="true" /></Link>
      </div>

      <figure className="editorial-hero-art">
        <div className="editorial-hero-image">
          <Image src="/images/aucta-editorial-hero.png" alt="An editorial still life of collectible objects in warm natural light" fill priority sizes="(max-width: 959px) 100vw, 58vw" />
        </div>
        <figcaption><span>AUCTA Editorial</span><span>Objects worth a closer look</span></figcaption>
      </figure>

      {featured && <article className="hero-feature featured-live-lot" aria-labelledby="featured-lot-title">
        <div className="hero-image featured-live-image">
          <Image src={featured.images[0] || '/images/camera.png'} alt={featured.imageAlt || featured.title} fill sizes="(max-width: 719px) 100vw, (max-width: 959px) 48vw, 32vw" />
          <div className="hero-lot"><span><span className="status-dot" /> Live lot</span><span>{featured.category}</span></div>
          <Link href={`/auction/${featured.slug}`} className="hero-image-link" aria-label={`View ${featured.title}`}><ArrowUpRight size={26} aria-hidden="true" /></Link>
        </div>
        <div className="hero-auction-meta featured-live-meta">
          <div><span className="eyebrow">Featured auction</span><Link id="featured-lot-title" href={`/auction/${featured.slug}`}>{featured.title}</Link><span className="hero-object-subtitle">{featured.condition} · {featured.seller.city}</span></div>
          <div><span className="label">Current bid</span><strong>{formatIDR(featured.currentPrice)}</strong><span>{featured.bidCount} {featured.bidCount === 1 ? 'bid' : 'bids'}</span></div>
          <div className="hero-time"><span className="label">Time remaining</span><Countdown endsAt={featured.endsAt} serverTime={featured.serverTime} /></div>
        </div>
      </article>}
    </section>

    <nav className="category-strip category-tabs" aria-label="Browse by category">
      <span>Browse categories</span>
      {categories.map(([name, slug]) => <Link key={slug} href={`/auctions?category=${slug}`}>{name}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}
    </nav>

    <section className="market-pulse" aria-label="Market overview">
      {pulse.map((item) => (
        <div key={item.label} className="market-pulse-card">
          <span className="eyebrow">{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </section>

    <section className="section live-section" aria-labelledby="live-auctions-heading">
      <div className="section-heading"><div><span className="eyebrow"><span className="status-dot" /> Live now</span><h2 id="live-auctions-heading">On the auction floor.</h2></div><Link className="text-link" href="/auctions">View all auctions <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      {live.length > 0 ? <div className="auction-grid">{live.slice(0, 4).map((auction) => <AuctionCard key={auction.id} auction={auction} />)}</div> : !catalogueUnavailable && <p className="empty-state">There are no live auctions right now. <Link href="/auctions">See upcoming lots</Link>.</p>}
    </section>

    <section className="collection-interlude section" aria-labelledby="collection-heading">
      <div className="collection-intro"><p className="eyebrow">Follow your curiosity</p><h2 id="collection-heading">Two ways into the collection.</h2><p>Explore categories through editorial studies. The objects pictured here are AUCTA imagery, not live lots.</p></div>
      <div className="collection-editorials">
        <Link className="collection-editorial-card" href="/auctions?category=watches">
          <div className="collection-editorial-image"><Image src="/images/aucta-watch-editorial.png" alt="AUCTA editorial study of a vintage watch" fill sizes="(max-width: 719px) 100vw, 50vw" /></div>
          <span className="collection-editorial-label"><span><small>AUCTA Editorial</small>Watches</span><ArrowUpRight size={20} aria-hidden="true" /></span>
        </Link>
        <Link className="collection-editorial-card" href="/auctions?category=design">
          <div className="collection-editorial-image"><Image src="/images/aucta-design-editorial.png" alt="AUCTA editorial study of collectible modern design" fill sizes="(max-width: 719px) 100vw, 50vw" /></div>
          <span className="collection-editorial-label"><span><small>AUCTA Editorial</small>Design</span><ArrowUpRight size={20} aria-hidden="true" /></span>
        </Link>
      </div>
    </section>

    {ending.length > 0 && <section className="ending-section section" aria-labelledby="ending-heading">
      <div className="ending-intro"><span className="eyebrow">Closing next</span><h2 id="ending-heading">Auctions nearing their close.</h2><p>Live countdowns use the auction server time. Late competitive bids may extend an auction.</p><Link className="text-link" href="/auctions?sort=ending-soon">View ending soon <ArrowRight size={18} aria-hidden="true" /></Link></div>
      <div className="ending-list">{ending.map((auction, index) => <Link href={`/auction/${auction.slug}`} className="ending-row" key={auction.id}>
        <span className="ending-number">0{index + 1}</span>
        <div className="ending-thumb"><Image src={auction.images[0] || '/images/camera.png'} alt={auction.imageAlt || auction.title} fill sizes="100px" /></div>
        <div className="ending-object"><span className="eyebrow">{auction.category}</span><h3>{auction.title}</h3><span>{auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'} · {auction.condition}</span></div>
        <div className="ending-price"><strong>{formatIDR(auction.currentPrice)}</strong><Countdown endsAt={auction.endsAt} serverTime={auction.serverTime} compact /></div>
        <ArrowUpRight size={21} aria-hidden="true" />
      </Link>)}</div>
    </section>}

    <section className="manifesto section trust-principles" aria-labelledby="principles-heading">
      <span className="eyebrow">How AUCTA works</span><h2 id="principles-heading">A market built on knowing.</h2>
      <div className="trust-grid">{trustPrinciples.map((principle) => {
        const Icon = principle.icon;
        return <article className="trust-principle-card" key={principle.number}>
          <div className="trust-principle-top"><span className="trust-principle-number">{principle.number}</span><Icon strokeWidth={1.2} aria-hidden="true" /></div>
          <h3>{principle.title}</h3><p>{principle.copy}</p><Link href={principle.href}>{principle.link} <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </article>;
      })}</div>
    </section>

    {sold.length > 0 && <section className="section sold-section" aria-labelledby="sold-heading">
      <div className="section-heading"><div><span className="eyebrow">Price archive</span><h2 id="sold-heading">Where the market landed.</h2></div><Link className="text-link" href="/sold">Explore sold lots <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <div className="auction-grid">{sold.slice(0, 4).map((auction) => <AuctionCard key={auction.id} auction={auction} />)}</div>
    </section>}

    <section className="seller-banner"><div><span className="eyebrow">Something special in your collection?</span><h2>Let the right people find it.</h2><p>Open a seller desk, prepare an honest listing and submit it for review.</p></div><Link className="button button-light" href="/sell">Sell with AUCTA <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
  </>;
}
