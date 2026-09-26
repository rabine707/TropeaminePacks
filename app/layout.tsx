import './globals.css';
import './collection-locks.css';
import './collection-fun.css';
import CollectionFun from '@/components/collection-fun';

export const metadata = {title: 'Tropeamine Packs — A shelf beyond the story', applicationName: 'Tropeamine Packs', description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.'};

export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}<CollectionFun/></body></html>;
}
