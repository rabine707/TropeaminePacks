export const ART_BUCKET = 'card-art';
export const MAX_ART_BYTES = 20 * 1024 * 1024;
export const rarities = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type Series = {id:string; title:string; author:string; slug:string};
export type CardSet = {id:string; series_id:string; title:string; code:string; published:boolean};
export type Character = {id:string; series_id:string; name:string; bio:string; lore:Record<string,unknown>};
export type CreatorCatalog = {series:Series[]; sets:CardSet[]; characters:Character[]};
export type DraftCard = {
  id:string; seriesId:string; setId:string; characterId:string; number:string;
  rarity:typeof rarities[number]; bookRange:string; description:string; front:string; back:string;
};
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateDraft(value:unknown):DraftCard {
  if (!value || typeof value !== 'object') throw new Error('Complete the card fields.');
  const v = value as Record<string,unknown>;
  const text = (key:string,max:number,required=false) => {
    if (typeof v[key] !== 'string') throw new Error(`Check ${key}.`);
    const result = v[key].trim();
    if (result.length > max || (required && !result)) throw new Error(`Check ${key}.`);
    return result;
  };
  const ids = {id:text('id',36,true),seriesId:text('seriesId',36,true),setId:text('setId',36,true),characterId:text('characterId',36,true)};
  if (!Object.values(ids).every(id=>uuidPattern.test(id))) throw new Error('Select a series, set and character.');
  if (!rarities.includes(v.rarity as DraftCard['rarity'])) throw new Error('Select a rarity.');
  const paths = {front:text('front',200),back:text('back',200)};
  for (const side of ['front','back'] as const) {
    if (paths[side] && !new RegExp(`^sfw/${ids.id}/[0-9a-f-]{36}-${side}\\.(jpg|png|webp)$`).test(paths[side])) throw new Error(`Check ${side} artwork.`);
  }
  // Publication, availability and shared character metadata are never accepted.
  return {...ids,...paths,number:text('number',80,true),rarity:v.rarity as DraftCard['rarity'],bookRange:text('bookRange',200),description:text('description',4000)};
}

export function characterDefaults(character:Character) {
  return {description:character.bio || '',bookRange:typeof character.lore?.spoiler_scope === 'string' ? character.lore.spoiler_scope : ''};
}

export async function validateArtwork(file:File):Promise<'jpg'|'png'|'webp'> {
  if (!file.size || file.size > MAX_ART_BYTES) throw new Error('Choose an image up to 20 MB.');
  const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
  if (file.type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (file.type === 'image/png' && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return 'png';
  if (file.type === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'webp';
  throw new Error('Choose a valid JPEG, PNG or WebP image.');
}
