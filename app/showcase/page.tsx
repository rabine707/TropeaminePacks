import Link from 'next/link';
import './showcase.css';

export const metadata={title:'Create a Showcase — Tropeamine Packs'};

export default function ShowcaseHomePage(){
 return <main className="showcase-hub-page">
  <div className="showcase-hub-shell">
   <Link href="/binder" className="showcase-hub-back">← Back to binder</Link>
   <header className="showcase-hub-hero">
    <span>TROPEAMINE PACKS</span>
    <h1>Create a Showcase</h1>
    <p>Turn the cards you own into something worth sharing.</p>
   </header>
   <div className="showcase-mode-grid">
    <Link href="/showcase/quick" className="showcase-mode-card quick">
     <div className="showcase-mode-badge">RECOMMENDED</div>
     <div className="showcase-mode-icon">⚡</div>
     <strong>Quick Create</strong>
     <p>Pick cards. Pick a style. Done. Tropeamine builds the polished image for you.</p>
     <span>Start Quick Create →</span>
    </Link>
    <Link href="/showcase/create" className="showcase-mode-card studio">
     <div className="showcase-mode-icon">✦</div>
     <strong>Studio</strong>
     <p>Move everything yourself, add text, layer cards, and customize the whole composition.</p>
     <span>Open Studio →</span>
    </Link>
   </div>
   <p className="showcase-hub-footnote">Every Quick Create export includes a subtle Tropeamine Packs wordmark in the top-right.</p>
  </div>
 </main>;
}
