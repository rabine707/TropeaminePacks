import './globals.css';
import './collection-locks.css';
import './collection-fun.css';
import './casual-guide.css';
import CollectionFun from '@/components/collection-fun';
import CasualGuide from '@/components/casual-guide';

export const metadata = {
  metadataBase: new URL('https://tropeaminepacks.vercel.app'),
  title: 'Tropeamine Packs — A shelf beyond the story',
  applicationName: 'Tropeamine Packs',
  description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
  openGraph: {
    title: 'Tropeamine Packs',
    description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
    type: 'website',
    siteName: 'Tropeamine Packs',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Tropeamine Packs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tropeamine Packs',
    description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
    images: ['/twitter-image'],
  },
  icons: { icon: '/icon' },
};

export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}<CollectionFun/><CasualGuide/></body></html>;
}
