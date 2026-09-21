'use client';
import { useEffect, useState } from 'react';
export function Countdown({endsAt,serverTime,compact=false}:{endsAt:string;serverTime:string;compact?:boolean}) {
  const initial=Math.max(0,new Date(endsAt).getTime()-new Date(serverTime).getTime());
  const [remaining,setRemaining]=useState(initial);
  useEffect(()=>{const start=performance.now();const remainingAtSync=Math.max(0,new Date(endsAt).getTime()-new Date(serverTime).getTime());const tick=()=>setRemaining(Math.max(0,remainingAtSync-(performance.now()-start)));const interval=setInterval(tick,1000);return()=>clearInterval(interval);},[endsAt,serverTime]);
  const seconds=Math.floor(remaining/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds/3600)%24,minutes=Math.floor(seconds/60)%60;
  const text=days>0?`${days}d ${hours}h ${minutes}m`:`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  return <span className={`countdown ${remaining<3600000?'urgent':''}`} role="timer" aria-live="off" aria-atomic="true" aria-label={remaining===0?'Auction closing':`Time remaining ${text}`}>{remaining===0?'Closing…':text}{!compact && days===0 && <span className="timer-units" aria-hidden="true"> HRS : MIN : SEC</span>}</span>;
}
