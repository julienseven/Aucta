import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AuctionDetail } from '@/lib/domain';
import { getAuction, getCurrentUser } from '@/lib/server/marketplace';
import { ShieldCheck } from '@/components/icons';
import { AuctionLive } from '@/components/pages/auction-live';
import { Gallery } from '@/components/pages/gallery';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';
import { publicError } from '@/components/pages/protect';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const detail = await getAuction(slug);
    if (!detail) return { title: 'Auction' };
    return { title: detail.auction.title, description: detail.auction.subtitle || detail.auction.description.slice(0,160), alternates:{canonical:'/auction/'+detail.auction.slug} };
  } catch { return { title: 'Auction' }; }
}
export default async function AuctionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  let detail: AuctionDetail | null = null;
  try { detail = await getAuction(slug); }
  catch (error) { return <div className="page"><p className="error-banner" role="alert">{publicError(error, 'This auction could not be loaded. Please try again.')}</p></div>; }
  if (!detail) notFound();
  const { auction } = detail;
  const location = [auction.seller.city, auction.seller.province].filter(Boolean).join(', ');
  const attributes = Object.entries(auction.attributes);
  return <article className="page auction-detail">
    {auction.sample&&<p className="notice auction-sample">Fictional development inventory. This object is not a real consignment.</p>}
    <div className="auction-summary">
      <p className="eyebrow">{auction.category} · {auction.brand}</p>
      <h1 className="page-title">{auction.title}</h1>
      {auction.subtitle&&<p>{auction.subtitle}</p>}
      <p className="muted">{auction.condition}{auction.attributes.year?` · ${auction.attributes.year}`:''} · {statusLabel(auction.status)}</p>
      <aside className="bid-trust" aria-label="Seller and buyer protection">
        <p><ShieldCheck size={16}/><span><strong>{auction.seller.verified ? 'Verified seller' : 'Seller profile'}</strong><small>{auction.seller.completedSales} completed sales{auction.seller.rating != null ? ` · ${auction.seller.rating.toFixed(1)} rating` : ''}</small></span></p>
        <p><span><strong>{money(auction.shippingAmount)} shipping</strong><small><Link href="/buyer-protection">Buyer protection</Link> · <Link href="/auction-rules">Auction rules</Link></small></span></p>
      </aside>
      <AuctionLive key={auction.id+':'+(user?.id??'guest')} initial={detail} signedIn={Boolean(user)}/>
    </div>
    <div className="auction-object">
      <Gallery images={auction.images} alt={auction.imageAlt||auction.title}/>
      <section className="item-description">
        <p className="eyebrow">THE OBJECT</p>
        <h2>A closer look.</h2>
        {auction.description&&<p>{auction.description}</p>}
        <h3>Condition</h3><p>{auction.condition}. {auction.flaws||'No additional flaw notes were provided.'}</p>
        {auction.provenance&&<><h3>Provenance</h3><p>{auction.provenance}</p></>}
        {attributes.length>0&&<><h3>Details</h3><dl className="item-attributes">{attributes.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></>}
        <div className="seller-card"><p className="eyebrow">Seller</p><p><strong>{auction.seller.name}</strong>{auction.seller.verified&&<span className="badge"><ShieldCheck size={14}/> Verified seller</span>}</p><p className="muted">{location||'Indonesia'}</p><p className="muted">Joined {formatWhen(auction.seller.joinedAt,false)} · {auction.seller.completedSales} completed sales{auction.seller.rating!=null?` · Rating ${auction.seller.rating.toFixed(1)}`:''}</p></div>
        <h3>Shipping</h3><p>Quoted shipping {money(auction.shippingAmount)}. The seller arranges dispatch after payment.</p><p><Link href="/buyer-protection">Buying with AUCTA</Link> · <Link href="/auction-rules">How bidding works</Link></p>
      </section>
    </div>
  </article>;
}
