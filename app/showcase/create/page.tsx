import Link from 'next/link';
import ShowcaseStudio from '@/components/showcase-studio';
import './showcase-studio.css';
import './showcase-studio-mobile.css';

export const metadata={title:'Showcase Studio — Tropeamine Packs'};

export default function ShowcaseCreatePage(){
 return <main className="showcase-page">
  <header className="showcase-shell-head">
   <Link href="/binder" className="showcase-back">← Back to binder</Link>
   <div><span>TROPEAMINE PACKS</span><strong>Showcase Studio</strong></div>
  </header>
  <ShowcaseStudio/>
 </main>;
}
