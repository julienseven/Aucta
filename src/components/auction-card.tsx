import Image from 'next/image';
import Link from 'next/link';
import type { Auction } from '@/lib/domain';
import { formatIDR } from '@/lib/auction';
import { Countdown } from './countdown';
import { ShieldCheck, ArrowUpRight } from './icons';
import { WatchButton } from './watch-button';
export function AuctionCard({auction,priority=false}:{auction:Auction;priority?:boolean}){
 const sold=['COMPLETED','PAID','FULFILLMENT'].includes(auction.status);
 return <article className="auction-card"><div className="card-image"><Link href={`/auction/${auction.slug}`} tabIndex={-1} aria-hidden="true"><Image src={auction.images[0]||'/images/camera.png'} alt={auction.imageAlt||auction.title} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 25vw" priority={priority}/></Link><span className="image-label">{auction.category}</span><WatchButton key={`${auction.id}:${auction.isWatching}`} auctionId={auction.id} watching={auction.isWatching??false}/>{sold&&<span className="sold-stamp">SOLD</span>}</div><div className="card-kicker"><span>{auction.brand}</span>{auction.seller.verified&&<span title="Verified sample seller"><ShieldCheck size={14}/> Verified seller</span>}</div><Link className="card-title" href={`/auction/${auction.slug}`}>{auction.title}<ArrowUpRight size={18}/></Link><p className="card-condition">{auction.condition}{auction.attributes?.year&&` · ${auction.attributes.year}`}</p><div className="card-bidding"><div><span className="label">{sold?'FINAL PRICE':auction.status==='SCHEDULED'?'STARTING BID':'CURRENT BID'}</span><strong>{formatIDR(auction.currentPrice||auction.startingPrice)}</strong></div><div className="card-ending"><span>{auction.bidCount} bids</span>{sold?<span className="sold-text">The market decided.</span>:auction.status==='SCHEDULED'?<span>Upcoming</span>:auction.status==='LIVE'?<Countdown endsAt={auction.endsAt} serverTime={auction.serverTime} compact/>:<span>{auction.status.replaceAll('_',' ').toLowerCase()}</span>}</div></div></article>
}
