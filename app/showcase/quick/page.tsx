import {pageMetadata} from '@/lib/site-metadata';
import Link from 'next/link';
import ShowcaseQuickCreate from '@/components/showcase-quick-create';
import '../showcase.css';
import './instagram-polish.css';
import './quick-polish.css';

export const metadata=pageMetadata('Quick Create','Pick owned cards and a style. Build a polished digital showcase and download it in a few steps.','/showcase/quick',false);

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
