'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { X } from './icons';

export async function mutate<T = unknown>(path: string, body: unknown = {}, method = 'POST'): Promise<T> {
  const response = await fetch(path, { method, credentials:'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({error:'Something went wrong. Please try again.'}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message ?? 'The request could not be completed.');
  return result.data ?? result;
}
export function Dialog({open, onClose, title, children}: {open:boolean;onClose:()=>void;title:string;children:React.ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleRef=useRef<HTMLHeadingElement>(null);
  const titleId=useId();
  useEffect(()=>{
    const dialog=ref.current;
    if(!open||!dialog)return;
    const opener=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(!dialog.open)dialog.showModal();
    titleRef.current?.focus();
    return()=>{
      if(dialog.open)dialog.close();
      if(opener?.isConnected)opener.focus();
    };
  },[open]);
  if(!open)return null;
  return <dialog ref={ref} className="dialog" onCancel={event=>{event.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby={titleId} aria-modal="true"><div className="dialog-top"><p className="eyebrow">AUCTA</p><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} aria-hidden="true"/></button></div><h2 ref={titleRef} id={titleId} tabIndex={-1}>{title}</h2>{children}</dialog>;
}
export function Feedback({message, error=false}:{message:string;error?:boolean}) { return message ? <p className={`feedback ${error?'error':''}`} role={error?'alert':'status'} aria-atomic="true">{message}</p> : null; }
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export function StatusBadge({children,tone='neutral'}:{children:React.ReactNode;tone?:StatusTone}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Alert({children,tone='info',className=''}:{children?:React.ReactNode;tone?:StatusTone;className?:string}) {
  return <div className={`alert alert-${tone} ${className}`.trim()} role={tone==='danger'?'alert':'status'} aria-atomic="true">{children}</div>;
}
export function ActionButton({path,body,label,doneLabel='Done',className='button',onDone}:{path:string;body?:unknown;label:string;doneLabel?:string;className?:string;onDone?:()=>void}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
  return <div><button type="button" className={className} disabled={busy} aria-busy={busy} onClick={async()=>{setBusy(true);setMessage('');try{await mutate(path,body);setMessage(doneLabel);setFailed(false);onDone?.();}catch(error){setMessage((error as Error).message);setFailed(true);}finally{setBusy(false);}}}>{busy?'Working…':label}</button><Feedback message={message} error={failed}/></div>;
}
