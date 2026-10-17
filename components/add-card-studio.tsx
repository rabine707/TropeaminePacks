'use client';

import {useEffect,useRef,useState} from 'react';
import {Upload,X,CheckCircle2} from 'lucide-react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {newCardArtPath} from '@/lib/card-art';
import {loadCreatorCatalog,checkDraftNumber,createCardDraft,listCardDrafts} from '@/app/admin/card-actions';
import {ART_BUCKET,characterDefaults,rarities,validateArtwork,validateDraft,type CreatorCatalog,type DraftCard} from '@/lib/creator-card';

type Artwork = {file:File; url:string; path:string};
type SavedDrafts = Awaited<ReturnType<typeof listCardDrafts>>;

export default function AddCardStudio() {
  const [open,setOpen] = useState(false);
  return <><button className="button gold" onClick={()=>setOpen(true)}><Upload size={17}/>Add card</button>{open&&<AddCardDialog close={()=>setOpen(false)}/>}</>;
}

function AddCardDialog({close}:{close:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const previews = useRef(new Set<string>());
  const [catalog,setCatalog] = useState<CreatorCatalog|null>(null);
  const [draft,setDraft] = useState<DraftCard>(()=>({id:crypto.randomUUID(),seriesId:'',setId:'',characterId:'',number:'',rarity:'common',bookRange:'',description:'',front:'',back:''}));
  const [art,setArt] = useState<Partial<Record<'front'|'back',Artwork>>>({});
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [saved,setSaved] = useState(false);
  const [drafts,setDrafts] = useState<SavedDrafts>([]);
  const [draftError,setDraftError] = useState('');
  const [loadAttempt,setLoadAttempt] = useState(0);

  useEffect(()=>{
    const element=dialog.current;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    element?.showModal();
    const urls=previews.current;
    return ()=>{element?.close();document.body.style.overflow=previous;for(const url of urls)URL.revokeObjectURL(url)};
  },[]);
  useEffect(()=>{
    let active=true;
    loadCreatorCatalog().then(value=>{if(active){setCatalog(value);setMessage('')}}).catch(error=>{if(active)setMessage(error instanceof Error?error.message:'Could not load the catalog.')});
    return ()=>{active=false};
  },[loadAttempt]);

  const series=catalog?.series.find(s=>s.id===draft.seriesId);
  const selectedSet=catalog?.sets.find(s=>s.id===draft.setId);
  const character=catalog?.characters.find(c=>c.id===draft.characterId);
  const sets=(catalog?.sets??[]).filter(s=>s.series_id===draft.seriesId).sort((a,b)=>a.code.localeCompare(b.code));
  const characters=(catalog?.characters??[]).filter(c=>c.series_id===draft.seriesId).sort((a,b)=>a.name.localeCompare(b.name));

  async function chooseArtwork(side:'front'|'back',file:File) {
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setMessage('');
    try {
      await validateArtwork(file);
      const url=URL.createObjectURL(file);
      previews.current.add(url);
      const old=art[side]?.url;
      if(old){URL.revokeObjectURL(old);previews.current.delete(old)}
      setArt(current=>({...current,[side]:{file,url,path:''}}));
      setDraft(current=>({...current,[side]:''}));
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not read the artwork.');}
    finally{busyRef.current=false;setBusy(false)}
  }

  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setMessage('');
    try {
      const payload=validateDraft(draft);
      if(!selectedSet || !character || selectedSet.series_id!==draft.seriesId || character.series_id!==draft.seriesId)throw new Error('Select a set and character from this series.');
      if(!await checkDraftNumber(payload.setId,payload.number))throw new Error('That card number already exists. Choose a unique number, such as CK02-001.');
      const client=createClient();
      for(const side of ['front','back'] as const) {
        const artwork=art[side];
        if(!artwork)continue;
        if(artwork.path){payload[side]=artwork.path;continue}
        const extension=await validateArtwork(artwork.file);
        const path=newCardArtPath('sfw',draft.id,side,extension);
        const {error}=await client.storage.from(ART_BUCKET).upload(path,artwork.file,{upsert:false,contentType:artwork.file.type});
        if(error)throw new Error(`Could not upload ${side} artwork. Check your connection and creator access, then retry.`);
        // Retain successful uploads when the other side or final save fails.
        artwork.path=path;
        payload[side]=path;
        setArt(current=>({...current,[side]:{...artwork}}));
        setDraft(current=>({...current,[side]:path}));
      }
      const result=await createCardDraft(payload);
      if(!result.ok)throw new Error(result.error);
      setSaved(true);setMessage('Draft saved to your catalog.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not confirm the save. Check saved drafts before retrying.');}
    finally{busyRef.current=false;setBusy(false)}
  }

  async function refreshDrafts() {
    setDraftError('');
    try{setDrafts(await listCardDrafts())}catch(error){setDraftError(error instanceof Error?error.message:'Could not load drafts.')}
  }

  return <dialog ref={dialog} className="modal wide creator-add-card" aria-labelledby="add-card-title" onCancel={event=>{if(busyRef.current)event.preventDefault();else close()}}>
    <button type="button" className="close icon-btn" onClick={close} disabled={busy} aria-label="Close Add Card"><X size={22}/></button>
    <p className="eyebrow">CREATOR STUDIO</p>
    <h2 id="add-card-title">{saved?'A new story, saved.':'Add a card'}</h2>
    <p className="creator-intro">Choose a character, add their artwork, and save your draft.</p>
    {!catalog?<div role="status"><p>{message||'Loading your series, sets and characters…'}</p>{message&&<button className="button outline" onClick={()=>setLoadAttempt(value=>value+1)}>Try again</button>}</div>:saved?<div className="creator-saved" role="status">
      <CheckCircle2 size={28}/><h3>{character?.name}</h3><p>{selectedSet?.code} · {draft.number} · Draft</p><p>Your card is saved privately. Publishing and pack availability stay off.</p><div className="button-row"><button className="button gold" onClick={close}>Done</button><Link className="button outline" href="/admin/cards">Manage saved drafts</Link></div>
    </div>:<form className="form" onSubmit={save}>
      <fieldset className="creator-fields" disabled={busy}>
        <div className="form-grid">
          <label>Series<select required value={draft.seriesId} onChange={event=>{const seriesId=event.target.value;setDraft(current=>({...current,seriesId,setId:'',characterId:'',number:'',description:'',bookRange:''}))}}><option value="">Choose series</option>{[...catalog.series].sort((a,b)=>a.title.localeCompare(b.title)).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label>Set<select required disabled={!series} value={draft.setId} onChange={event=>setDraft(current=>({...current,setId:event.target.value,number:''}))}><option value="">{series?'Choose set':'Choose a series first'}</option>{sets.map(s=><option key={s.id} value={s.id}>{s.code} · {s.title}{s.published?'':' (Draft)'}</option>)}</select></label>
          <label>Character<select required disabled={!series} value={draft.characterId} onChange={event=>{const next=catalog.characters.find(c=>c.id===event.target.value);setDraft(current=>({...current,characterId:next?.id??'',...(next?characterDefaults(next):{description:'',bookRange:''})}))}}><option value="">{series?'Choose existing character':'Choose a series first'}</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Card number<input required maxLength={80} placeholder={selectedSet?`${selectedSet.code}-001`:'e.g. CK02-001'} value={draft.number} onChange={event=>setDraft(current=>({...current,number:event.target.value}))}/></label>
        </div>
        {series&&<p className="creator-known">{series.title}{series.author?` · ${series.author}`:''}{character?` · ${character.name}`:''}</p>}
        {series&&!sets.length&&<p role="status">This series has no sets yet. Create a set before adding a card.</p>}
        {series&&!characters.length&&<p role="status">This series has no characters yet. Add a character before creating a card.</p>}
        <div className="creator-art-grid">{(['front','back'] as const).map(side=><label className="creator-art-upload" key={side}>
          <span>{side==='front'?'Front artwork':'Back artwork'}</span>
          <div className="creator-art-preview">{art[side]?<img src={art[side]!.url} alt={`${side} artwork preview`}/>:<Upload size={25} aria-hidden="true"/>}</div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void chooseArtwork(side,file);event.target.value=''}}/>
          <small>{art[side]?.file.name||'PNG, JPEG or WebP · up to 20 MB'}</small>
        </label>)}</div>
        <label>Rarity<select value={draft.rarity} onChange={event=>setDraft(current=>({...current,rarity:event.target.value as DraftCard['rarity']}))}>{rarities.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}</select></label>
        <details className="creator-advanced"><summary>Advanced Options <span>Optional card details</span></summary><div>
          <p className="footnote">Known character details fill automatically. Changes here apply only to this card.</p>
          <label>Book range / appearances<input maxLength={200} value={draft.bookRange} onChange={event=>setDraft(current=>({...current,bookRange:event.target.value}))}/></label>
          <label>Card description / creator notes<textarea maxLength={4000} rows={4} value={draft.description} onChange={event=>setDraft(current=>({...current,description:event.target.value}))}/></label>
        </div></details>
      </fieldset>
      {message&&<p className="creator-message" role="alert">{message}</p>}
      <div className="creator-save-row"><p className="footnote">Draft only · Artwork can be added later.</p><button className="button gold" disabled={busy||!draft.setId||!draft.characterId||!draft.number.trim()}>{busy?'Saving…':'Save as draft'}</button></div>
    </form>}
    {catalog&&<details className="creator-drafts" onToggle={event=>{if(event.currentTarget.open)void refreshDrafts()}}><summary>Saved drafts</summary><p className="footnote">Your 20 most recent drafts.</p><button type="button" className="button outline" onClick={()=>void refreshDrafts()}>Refresh drafts</button>{draftError&&<p role="alert">{draftError}</p>}{drafts.map(card=><p key={card.id}>{card.number} · Draft <small>{card.id}</small></p>)}</details>}
  </dialog>;
}
