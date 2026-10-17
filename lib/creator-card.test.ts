import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft,validateArtwork,characterDefaults,MAX_ART_BYTES} from './creator-card.ts';
const id='00000000-0000-4000-8000-000000000001';
const draft={id,seriesId:id,setId:id,characterId:id,number:' CK02-001 ',rarity:'rare',bookRange:'',description:'',front:'',back:''};

test('draft validation requires catalog IDs and number, permits unfinished artwork, ignores publication and metadata writes',()=>{
  const valid=validateDraft({...draft,published:true,available:true,author:'Changed',characterName:'Changed'});
  assert.equal(valid.number,'CK02-001');
  assert.equal('published' in valid,false);
  assert.equal('author' in valid,false);
  assert.throws(()=>validateDraft({...draft,setId:''}));
  assert.throws(()=>validateDraft({...draft,number:''}));
  assert.throws(()=>validateDraft({...draft,rarity:'invalid'}));
  assert.throws(()=>validateDraft({...draft,description:'a'.repeat(4001)}));
  assert.throws(()=>validateDraft({...draft,front:`sfw/00000000-0000-4000-8000-000000000002/${id}-front.png`}));
  assert.throws(()=>validateDraft({...draft,front:`adult/${id}/${id}-front.png`}));
  assert.equal(validateDraft({...draft,front:`sfw/${id}/${id}-front.png`}).front.endsWith('.png'),true);
});

test('character defaults reuse known bio and book range without changing source metadata',()=>{
  const character={id,series_id:id,name:'Alpha',bio:'Known character',lore:{spoiler_scope:'Books 1–2',genre:'HaremLit'}};
  const before=JSON.stringify(character);
  assert.deepEqual(characterDefaults(character),{description:'Known character',bookRange:'Books 1–2'});
  assert.equal(JSON.stringify(character),before);
});

test('artwork validation checks real byte signatures and size',async()=>{
  const png=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'front.png',{type:'image/png'});
  assert.equal(await validateArtwork(png),'png');
  await assert.rejects(()=>validateArtwork(new File(['fake'],'front.png',{type:'image/png'})));
  await assert.rejects(()=>validateArtwork(new File([],'front.png',{type:'image/png'})));
  await assert.rejects(()=>validateArtwork(new File([new Uint8Array(MAX_ART_BYTES+1)],'large.png',{type:'image/png'})));
});
