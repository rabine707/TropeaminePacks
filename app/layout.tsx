import './globals.css';
import './seo.css';
import './collection-locks.css';
import './collection-fun.css';
import './casual-guide.css';
import './theme-overrides.css';
import './showcase-entrypoints.css';
import './homepage-density.css';
import './review-fixes.css';
import CollectionFun from '@/components/collection-fun';
import CasualGuide from '@/components/casual-guide';
import RevealStabilizer from '@/components/reveal-stabilizer';
import ShowcaseEntrypoints from '@/components/showcase-entrypoints';
import HomepageDensity from '@/components/homepage-density';
import ReviewFixes from '@/components/review-fixes';
import Link from 'next/link';
import type { Viewport } from 'next';

import {siteUrl} from '@/lib/seo';
const shareImage = '/opengraph-image';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#09080c',
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Tropeamine Packs — A shelf beyond the story',
  applicationName: 'Tropeamine Packs',
  description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
  openGraph: {
    title: 'Tropeamine Packs',
    description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
    url: '/',
    type: 'website',
    siteName: 'Tropeamine Packs',
    images: [{
      url: shareImage,
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: 'Tropeamine Packs — A shelf beyond the story',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tropeamine Packs',
    description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
    images: [shareImage],
  },
  icons: { icon: '/icon' },
};

export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}<footer className="site-legal-footer"><p><strong>Unofficial fan-made project.</strong> Not affiliated with or endorsed by any referenced author, publisher, or rights holder.</p><nav><Link href="/albums">Collection Albums</Link><Link href="/odds">Pack Odds</Link><Link href="/showcase/create">Showcase Studio</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/data">What Data We Collect</Link></nav></footer><CollectionFun/><CasualGuide/><RevealStabilizer/><ShowcaseEntrypoints/><HomepageDensity/><ReviewFixes/></body></html>;
}
