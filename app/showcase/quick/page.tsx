import Link from 'next/link';
import ShowcaseQuickCreate from '@/components/showcase-quick-create';
import '../showcase.css';
import './instagram-polish.css';
import './quick-polish.css';

export const metadata={title:'Quick Create — Tropeamine Packs'};

export default function ShowcaseQuickPage(){
 return <main className="showcase-quick-page">
  <div className="showcase-quick-shell">
   <header className="showcase-quick-topbar">
    <Link href="/showcase">← Showcase</Link>
    <span>TROPEAMINE PACKS</span>
   </header>
   <ShowcaseQuickCreate/>
  </div>
 </main>;
}
