import {pageMetadata} from '@/lib/site-metadata';
import Link from 'next/link';
import ShowcaseStudio from '@/components/showcase-studio';
import './showcase-studio.css';
import './showcase-studio-mobile.css';

export const metadata=pageMetadata('Showcase Studio','Arrange your owned cards, customize your composition, and download a full-size showcase image.','/showcase/create',false);

export default function ShowcaseCreatePage(){
 return <main className="showcase-page">
  <header className="showcase-shell-head">
   <Link href="/binder" className="showcase-back">← Back to binder</Link>
   <div><span>TROPEAMINE PACKS</span><strong>Showcase Studio</strong></div>
  </header>
  <ShowcaseStudio/>
 </main>;
}
