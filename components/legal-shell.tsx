import Link from 'next/link';

export function LegalShell({title,kicker,children}:{title:string;kicker:string;children:React.ReactNode}){
 return <main className="legal-page"><div className="legal-wrap"><Link href="/" className="legal-brand">TROPEAMINE PACKS</Link><p className="eyebrow">{kicker}</p><h1>{title}</h1><p className="legal-updated">Effective September 28, 2026</p><div className="legal-notice"><strong>Unofficial fan-made project.</strong> Tropeamine Packs is not affiliated with, endorsed by, sponsored by, or authorized by any referenced author, publisher, studio, or other rights holder.</div><article className="legal-copy">{children}</article><nav className="legal-links" aria-label="Legal"><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><Link href="/data">What Data We Collect</Link><Link href="/">Return to Tropeamine</Link></nav></div></main>
}
