'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuctionDetail } from '@/lib/domain';
import { BidControls } from './bid-controls';
import { formatWhen, money } from './helpers';

export function AuctionLive({initial,signedIn}:{initial:AuctionDetail;signedIn:boolean}) {
  const [detail,setDetail]=useState(initial);
  const [connectionError,setConnectionError]=useState(false);
  const [extension,setExtension]=useState(false);
  const previousEnd=useRef(initial.auction.endsAt);
  const active=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    active.current?.abort();
    const controller=new AbortController();
    active.current=controller;
    try {
      const response=await fetch('/api/auctions/'+initial.auction.id,{cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error('Auction refresh failed');
      const payload=await response.json();
      const next:AuctionDetail=payload.data;
      if(!next?.auction || next.auction.id!==initial.auction.id) throw new Error('Invalid auction response');
      if(Date.parse(next.auction.endsAt)>Date.parse(previousEnd.current)) setExtension(true);
      previousEnd.current=next.auction.endsAt;
      setDetail(next);
      setConnectionError(false);
    } catch {
      if(!controller.signal.aborted) setConnectionError(true);
    }
  },[initial.auction.id]);
  const live=detail.auction.status==='LIVE';
  const awaiting=detail.auction.status==='DRAFT'||detail.auction.status==='PENDING_REVIEW';
  useEffect(()=>{
    const update=()=>{if(document.visibilityState==='visible') void refresh();};
    // Scope updates to this auction; poll only while LIVE and visible.
    const timer=live?setInterval(update,5000):undefined;
    if(!awaiting){window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);}
    return()=>{if(timer)clearInterval(timer);active.current?.abort();if(!awaiting){window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);}};
  },[refresh,live,awaiting]);
  return <div className="auction-live">
    {live&&extension&&<p className="notice" role="status"><strong>Auction extended · 2 minutes added</strong><br/>A new bid arrived near the close. The countdown has been updated.</p>}
    {live&&connectionError&&<p className="error-banner" role="status">Live updates are temporarily unavailable. Bids are still validated by the server.</p>}
    {live?<BidControls auction={detail.auction} signedIn={signedIn} onAccepted={refresh}/>:<p className="notice muted" role="status">{detail.auction.status==='DRAFT'?'Owner preview. This lot is still a draft. It is not live and is not in the catalogue.':detail.auction.status==='PENDING_REVIEW'?'Awaiting moderation. This lot is not live and is not in the catalogue.':'Bidding is only open while the auction is live.'}</p>}
    <section className="auction-activity">
      <h2>Bid activity</h2>
      {detail.bids.length===0?<p className="muted">No public bids yet. Opening at {money(detail.auction.startingPrice)}.</p>:<ul className="activity-list">
        {detail.bids.map(bid=><li key={bid.id}><div><span>{bid.alias}</span><time dateTime={bid.createdAt}>{formatWhen(bid.createdAt)}</time></div><div><strong>{money(bid.amount)}</strong>{bid.automatic&&<span className="muted">Automatic</span>}</div></li>)}
      </ul>}
    </section>
  </div>;
}
