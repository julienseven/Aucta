'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { User } from '@/lib/domain';
import { ArrowUpRight, Heart, Menu, Search, X, UserRound } from './icons';
import './header.css';

function HeaderDialog({ id, title, trigger, onClose, children, mobile = false }: {
 id: string; title: string; trigger: RefObject<HTMLButtonElement | null>;
 onClose: () => void; children: ReactNode; mobile?: boolean;
}) {
 const dialogRef = useRef<HTMLDialogElement>(null);
 useEffect(() => {
   const dialog = dialogRef.current;
   const opener = trigger.current;
   if (!dialog) return;
   // showModal makes every element outside this dialog inert, including the header.
   dialog.showModal();
   dialog.querySelector<HTMLElement>('input, a[href], button')?.focus();
   const desktop = window.matchMedia('(min-width: 1100px)');
   const resized = () => { if (mobile && desktop.matches) onClose(); };
   desktop.addEventListener('change', resized);
   window.addEventListener('popstate', onClose);
   return () => {
     desktop.removeEventListener('change', resized);
     window.removeEventListener('popstate', onClose);
     dialog.close();
     if (opener?.isConnected && opener.getClientRects().length) opener.focus();
     else document.querySelector<HTMLElement>('.wordmark')?.focus();
   };
 }, [mobile, onClose, trigger]);
 return <dialog ref={dialogRef} id={id} className={`header-dialog${mobile ? ' header-dialog-menu' : ''}`} aria-label={title} aria-modal="true"
   onCancel={(event) => { event.preventDefault(); onClose(); }}
   onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
   onKeyDown={(event) => {
     if (event.key !== 'Tab') return;
     const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter((element) => element.getClientRects().length);
     const first = controls[0], last = controls[controls.length - 1];
     if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
     else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   }}>
   <div className="header-dialog-content">{children}<button type="button" className="icon-button header-dialog-close" aria-label={mobile ? 'Close menu' : 'Close search'} onClick={onClose}><X size={20}/></button></div>
 </dialog>;
}
export function Header({user:initialUser,local}:{user:User|null;local:boolean}) {
 const [panel,setPanel]=useState<'menu'|'search'|null>(null);const path=usePathname();const router=useRouter();
 const menu=panel==='menu',search=panel==='search';
 const menuTrigger=useRef<HTMLButtonElement>(null),searchTrigger=useRef<HTMLButtonElement>(null);
 const closePanel=useCallback(()=>setPanel(null),[]);
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
 return <>
   <a className="skip-link" href="#main">Skip to content</a>
   {local&&<div className="development-bar"><span className="status-dot"/> PRIVATE PREVIEW <span className="development-separator">/</span> Fictional inventory. Local development only.</div>}
   <header className="site-header">
     <Link href="/" className="wordmark" aria-label="AUCTA home">AUCTA<span>®</span></Link>
     <nav className="desktop-nav" aria-label="Main navigation">
       <Link className={path==='/auctions'?'active':''} href="/auctions">Auctions</Link>
       <Link href="/auctions?category=watches">Categories</Link>
       <Link className={path==='/sold'?'active':''} href="/sold">Price archive</Link>
       <Link href="/sell">Sell with us <ArrowUpRight size={13}/></Link>
     </nav>
     <div className="header-actions">
       <button ref={searchTrigger} type="button" className="icon-button" aria-label="Search auctions" aria-expanded={search} aria-controls="header-search-dialog" aria-haspopup="dialog" onClick={()=>setPanel('search')}><Search size={20}/></button>
       <Link className="icon-button watch-nav" href="/watchlist" aria-label="Watchlist"><Heart size={20}/></Link>
       {displayedUser?<Link className="account-link" href="/account"><UserRound size={18}/><span>{displayedUser.name.split(' ')[0]}</span></Link>:<><Link className="sign-in-link" href="/sign-in">Sign in</Link><Link className="join-button" href="/sign-in">Join AUCTA <ArrowUpRight size={14}/></Link></>}
       <button ref={menuTrigger} type="button" className="icon-button mobile-menu" aria-label="Open menu" aria-expanded={menu} aria-controls="header-menu-dialog" aria-haspopup="dialog" onClick={()=>setPanel('menu')}><Menu/></button>
     </div>
   </header>
   {search&&<HeaderDialog id="header-search-dialog" title="Search auctions" trigger={searchTrigger} onClose={closePanel}>
     <form className="header-search" role="search" action="/auctions" onSubmit={(event)=>{
       event.preventDefault();
       const query=String(new FormData(event.currentTarget).get('q')??'').trim();
       closePanel();
       router.push(`/auctions${query?`?${new URLSearchParams({q:query})}`:''}`);
     }}><Search size={20}/><input name="q" aria-label="Search the catalogue" placeholder="An object, a maker, a story…"/><button type="submit" className="text-link">Search <ArrowUpRight size={16}/></button></form>
   </HeaderDialog>}
   {menu&&<HeaderDialog id="header-menu-dialog" title="Mobile menu" trigger={menuTrigger} onClose={closePanel} mobile>
     <nav className="mobile-nav" aria-label="Mobile navigation">{[['Auctions','/auctions'],['Categories','/auctions?category=watches'],['Price archive','/sold'],['Sell with us','/sell'],['Watchlist','/watchlist'],[displayedUser?'My account':'Sign in',displayedUser?'/account':'/sign-in']].map(([label,href])=><Link key={href} href={href} onClick={()=>{closePanel();router.refresh();}}>{label}<ArrowUpRight size={18}/></Link>)}</nav>
   </HeaderDialog>}
 </>;
}
