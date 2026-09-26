import AccountCollectionShell from '@/components/account-collection-shell';
import {notFound} from 'next/navigation';

export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 if(slug.length>2||(slug.length===2&&!['series','collector'].includes(slug[0]))||(slug.length&&!['discover','binder','series','packs','quests','requests','account','collector','admin'].includes(slug[0])))notFound();
 return <AccountCollectionShell/>;
}
