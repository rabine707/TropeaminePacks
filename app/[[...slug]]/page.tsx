import {pageMetadata,SITE_DESCRIPTION} from '@/lib/site-metadata';
import {publishedSeries,seriesPathKey} from '@/lib/public-series';
import AccountCollectionShell from '@/components/account-collection-shell';
import {createClient} from '@/lib/supabase/server';
import {notFound,redirect} from 'next/navigation';

export async function generateMetadata({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 const pages:Record<string,[string,string,boolean]>={
  home:['A shelf beyond the story',SITE_DESCRIPTION,true],
  discover:['Browse character cards','Find your next fictional obsession. Explore fan-made digital character cards and book collections.',true],
  packs:['Open digital card packs','Choose a Tropeamine collection, explore its card pool, and open packs with Ink.',true],
  requests:['Community requests','Suggest the books and characters you want to collect and support your next fictional obsession.',true],
  binder:['My binder','Your collected character cards, foil editions, and favorite fictional worlds in one personal binder.',false],
  quests:['Earn Ink','Fund the obsession. Do tiny collector things, get Ink, and open more packs.',false],
  admin:['Creator studio','Manage the Tropeamine card catalog and collector community.',false]
 };
 if(slug.length===2&&slug[0]==='series'){
  const series=(await publishedSeries()).find(s=>seriesPathKey(s.title)===seriesPathKey(slug[1]));
  return series?pageMetadata(`${series.title} collection`,`Explore fan-made digital character cards inspired by ${series.title}${series.author?' by '+series.author:''}.`,`/series/${seriesPathKey(series.title)}`):pageMetadata('Series collection','Explore fictional worlds and their character cards.',`/series/${encodeURIComponent(slug[1])}`,false);
 }
 const entry=pages[slug[0]??'home'];
 if(!entry||slug.length>1)return pageMetadata('Page not found','This chapter is not on the shelf. Return to Tropeamine Packs.','/',false);
 return pageMetadata(entry[0],entry[1],slug.length?`/${slug[0]}`:'/',entry[2]);
}

export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 if(slug.length>2||(slug.length===2&&slug[0]!=='series')||(slug.length&&!['discover','binder','series','packs','quests','requests','admin'].includes(slug[0])))notFound();

 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 let isAdmin=false;
 if(user){
  const {data:role}=await supabase.from('creator_roles').select('role').eq('user_id',user.id).maybeSingle();
  isAdmin=role?.role==='admin';
 }

 if(slug[0]==='admin'&&!isAdmin){
  if(!user)redirect('/login?next=/admin');
  notFound();
 }

 return <AccountCollectionShell isAdmin={isAdmin}/>;
}
