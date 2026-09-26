import './globals.css';
import './collection-locks.css';
import './collection-fun.css';
import './casual-guide.css';
import CollectionFun from '@/components/collection-fun';
import CasualGuide from '@/components/casual-guide';

const shareImage = 'https://tropeaminepacks.vercel.app/tropeamine-packs-preview-v3.jpg';

export const metadata = {
  metadataBase: new URL('https://tropeaminepacks.vercel.app'),
  title: 'Tropeamine Packs — A shelf beyond the story',
  applicationName: 'Tropeamine Packs',
  description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
  openGraph: {
    title: 'Tropeamine Packs',
    description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.',
    url: 'https://tropeaminepacks.vercel.app/',
    type: 'website',
    siteName: 'Tropeamine Packs',
    images: [{
      url: shareImage,
      secureUrl: shareImage,
      width: 600,
      height: 315,
      type: 'image/jpeg',
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
 return <html lang="en"><body>{children}<CollectionFun/><CasualGuide/></body></html>;
}
