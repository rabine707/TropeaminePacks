import CollectionApp from '@/components/collection-app';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;if(slug.length>2||(slug.length===2&&slug[0]!=='series')||(slug.length&& !['discover','binder','series','packs','quests','requests','admin'].includes(slug[0])))notFound();return <CollectionApp/>}
