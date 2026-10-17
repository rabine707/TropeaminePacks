'use server';

import {createClient} from '@/lib/supabase/server';
import {validateDraft,uuidPattern,type CreatorCatalog,type Series,type CardSet,type Character} from '@/lib/creator-card';

async function requireAdmin() {
  const client = await createClient();
  const {data:{user},error} = await client.auth.getUser();
  if (error || !user) throw new Error('Sign in with your creator account.');
  const {data:role,error:roleError} = await client.from('creator_roles').select('role').eq('user_id',user.id).maybeSingle();
  if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');
  return client;
}

export async function loadCreatorCatalog():Promise<CreatorCatalog> {
  const client = await requireAdmin();
  // Page instead of silently losing options at the Data API's row limit.
  async function rows(table:'series'|'card_sets'|'characters',columns:string) {
    const result:unknown[] = [];
    for (let offset=0;;offset+=500) {
      const {data,error} = await client.from(table).select(columns).order('id').range(offset,offset+499);
      if (error) throw new Error('Could not load the creator catalog. Try again.');
      result.push(...data);
      if (data.length<500) return result;
    }
  }
  const [series,sets,characters] = await Promise.all([
    rows('series','id,title,author,slug'),rows('card_sets','id,series_id,title,code,published'),rows('characters','id,series_id,name,bio,lore')
  ]);
  return {series:series as Series[],sets:sets as CardSet[],characters:characters as Character[]};
}

export async function checkDraftNumber(setId:string,number:string):Promise<boolean> {
  const client = await requireAdmin();
  if (!uuidPattern.test(setId) || !number.trim() || number.length>80) throw new Error('Check the card number.');
  // The live catalog has a global number constraint, including unpublished cards.
  const {data,error} = await client.from('cards').select('id').eq('number',number.trim()).limit(1);
  if (error) throw new Error('Could not check the card number.');
  return data.length===0;
}

export async function createCardDraft(value:unknown):Promise<{ok:true;id:string}|{ok:false;error:string}> {
  try {
    const client = await requireAdmin();
    const draft = validateDraft(value);
    const {data,error} = await client.rpc('admin_create_card_draft',{payload:draft});
    if (error) {
      if (error.code==='23505') return {ok:false,error:'This card ID or number already exists. Check your saved drafts before retrying; existing cards were not changed.'};
      if (error.code==='P0001') return {ok:false,error:error.message};
      return {ok:false,error:'Could not confirm the save. Your uploads are retained. Check saved drafts before retrying.'};
    }
    return {ok:true,id:String(data)};
  } catch (error) {
    return {ok:false,error:error instanceof Error?error.message:'Could not save the draft.'};
  }
}

export async function listCardDrafts() {
  const client = await requireAdmin();
  const {data,error} = await client.from('cards').select('id,number,created_at,characters(name),card_sets(title,code)').eq('published',false).order('created_at',{ascending:false}).limit(20);
  if (error) throw new Error('Could not load saved drafts.');
  return data;
}
