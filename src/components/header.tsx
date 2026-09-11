'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@/lib/domain';
import { ArrowUpRight, Heart, Menu, Search, X, UserRound } from './icons';
export function Header({user:initialUser,local}:{user:User|null;local:boolean}) {
 const [menu,setMenu]=useState(false),[search,setSearch]=useState(false);const path=usePathname();const router=useRouter();
 useEffect(()=>{
   let pending=false, cancelled=false;
   const fingerprint=(value:User|null)=>JSON.stringify([value?.id,value?.name,value?.role,value?.sellerVerified]);
   const reload=async()=>{
     if(pending)return;
     pending=true;
     try {
       const response=await fetch('/api/session',{cache:'no-store'});
       if(!response.ok)return;
       const payload=await response.json();
       if(!cancelled && fingerprint(payload.user??null)!==fingerprint(initialUser)) router.refresh();
     } catch { /* Keep the current server-rendered state until the next focus. */ }
     finally {pending=false;}
   };
   const changed=(event:StorageEvent)=>{if(event.key==='aucta:session-change'||event.key?.includes('auth-token'))void reload();};
   window.addEventListener('focus',reload);window.addEventListener('storage',changed);
   return()=>{cancelled=true;window.removeEventListener('focus',reload);window.removeEventListener('storage',changed);};
 },[router,initialUser]);
 // Always use the verified server identity, including an explicit signed-out null.
 const displayedUser=initialUser;
 return <><a className="skip-link" href="#main">Skip to content</a>{local&&<div className="development-bar"><span className="status-dot"/> PRIVATE PREVIEW <span className="development-separator">/</span> Fictional inventory. Local development only.</div>}<header className="site-header"><Link href="/" className="wordmark" aria-label="AUCTA home">AUCTA<span>®</span></Link><nav className="desktop-nav" aria-label="Main navigation"><Link className={path==='/auctions'?'active':''} href="/auctions">Auctions</Link><Link href="/auctions?category=watches">Categories</Link><Link className={path==='/sold'?'active':''} href="/sold">Price archive</Link><Link href="/sell">Sell with us <ArrowUpRight size={13}/></Link></nav><div className="header-actions"><button className="icon-button" aria-label="Search auctions" onClick={()=>setSearch(!search)}><Search size={20}/></button><Link className="icon-button watch-nav" href="/watchlist" aria-label="Watchlist"><Heart size={20}/></Link>{displayedUser?<Link className="account-link" href="/account"><UserRound size={18}/><span>{displayedUser.name.split(' ')[0]}</span></Link>:<><Link className="sign-in-link" href="/sign-in">Sign in</Link><Link className="join-button" href="/sign-in">Join AUCTA <ArrowUpRight size={14}/></Link></>}<button className="icon-button mobile-menu" aria-label={menu?'Close menu':'Open menu'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>{search&&<form className="header-search" action="/auctions" onSubmit={()=>setSearch(false)}><Search size={20}/><input name="q" aria-label="Search the catalogue" placeholder="An object, a maker, a story…" autoFocus/><button className="text-link">Search <ArrowUpRight size={16}/></button></form>}{menu&&<nav className="mobile-nav" aria-label="Mobile navigation">{[['Auctions','/auctions'],['Categories','/auctions?category=watches'],['Price archive','/sold'],['Sell with us','/sell'],['Watchlist','/watchlist'],[displayedUser?'My account':'Sign in',displayedUser?'/account':'/sign-in']].map(([label,href])=><Link key={href} href={href} onClick={()=>{setMenu(false);router.refresh();}}>{label}<ArrowUpRight size={18}/></Link>)}</nav>}</>;
}
