import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getCurrentUser } from '@/lib/server/auth';
import './globals.css';
export const dynamic = 'force-dynamic';
export const metadata:Metadata={metadataBase:new URL(process.env.APP_URL||'http://localhost:3000'),title:{default:'AUCTA — Rare things. Real prices.',template:'%s — AUCTA'},description:'A considered collection of rare and remarkable objects. Discover live auctions, follow the bidding, and find your next great object.',openGraph:{title:'AUCTA — Rare things. Real prices.',description:'Objects worth competing for.',type:'website'},robots:process.env.AUCTA_LOCAL_MODE==='true'?{index:false,follow:false}:{index:true,follow:true}};
export default async function RootLayout({children}:{children:React.ReactNode}){
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  return <html lang="en"><body><Header user={user} local={process.env.AUCTA_LOCAL_MODE==='true'}/><main id="main">{children}</main><Footer/></body></html>;
}
