'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Draft = {
  seriesTitle: string
  author: string
  characterName: string
  setTitle: string
  setCode: string
  cardNumber: string
  bookRange: string
  description: string
  variantLabel: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  rating: 'sfw' | 'adult'
  published: boolean
}

type CatalogRow = {
  id: string
  number: string | null
  book_range: string
  published: boolean
  characters?: { name?: string | null; series?: { title?: string | null } | null } | null
  card_sets?: { title?: string | null; code?: string | null } | null
  variants?: Array<{ label?: string | null; rarity?: string | null; rating?: string | null }> | null
}

type ExistingAsset = { id: string; storage_path: string; previewUrl?: string }
type EditContext = {
  cardId: string
  characterId: string
  seriesId: string
  setId: string
  variantId: string | null
  characterName: string
  assets: { front?: ExistingAsset; back?: ExistingAsset }
}

const EMPTY: Draft = {
  seriesTitle: '', author: '', characterName: '', setTitle: '', setCode: '', cardNumber: '',
  bookRange: '', description: '', variantLabel: 'Standard', rarity: 'common', rating: 'sfw', published: false,
}

const DRAFT_KEY = 'tropeamine-admin-card-draft-v1'
const MAX_ART_BYTES = 20 * 1024 * 1024
const ALLOWED_ART_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export default function CardManager({ email }: { email: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [editing, setEditing] = useState<EditContext | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState('')
  const [backPreview, setBackPreview] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) setDraft({ ...EMPTY, ...JSON.parse(saved) })
    } catch {}
    void refreshCards()
  }, [])

  useEffect(() => {
    if (editing) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
  }, [draft, editing])

  async function refreshCards() {
    setLoading(true)
    const { data, error } = await supabase
      .from('cards')
      .select('id,number,book_range,published,characters(name,series(title)),card_sets(title,code),variants(label,rarity,rating)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) setError(error.message)
    else setRows((data ?? []) as unknown as CatalogRow[])
    setLoading(false)
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function setPreview(side: 'front' | 'back', url: string) {
    if (side === 'front') setFrontPreview(url)
    else setBackPreview(url)
  }

  function chooseArt(side: 'front' | 'back', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setError('')
    if (!file) return
    if (!ALLOWED_ART_TYPES.includes(file.type)) {
      setError('Card art must be a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_ART_BYTES) {
      setError('Each card image must be 20 MB or smaller.')
      event.target.value = ''
      return
    }
    const preview = URL.createObjectURL(file)
    if (side === 'front') {
      if (frontPreview.startsWith('blob:')) URL.revokeObjectURL(frontPreview)
      setFrontFile(file); setFrontPreview(preview)
    } else {
      if (backPreview.startsWith('blob:')) URL.revokeObjectURL(backPreview)
      setBackFile(file); setBackPreview(preview)
    }
  }

  function clearArt() {
    if (frontPreview.startsWith('blob:')) URL.revokeObjectURL(frontPreview)
    if (backPreview.startsWith('blob:')) URL.revokeObjectURL(backPreview)
    setFrontFile(null); setBackFile(null); setFrontPreview(''); setBackPreview('')
  }

  function restoreExistingArt(context = editing) {
    if (frontPreview.startsWith('blob:')) URL.revokeObjectURL(frontPreview)
    if (backPreview.startsWith('blob:')) URL.revokeObjectURL(backPreview)
    setFrontFile(null); setBackFile(null)
    setFrontPreview(context?.assets.front?.previewUrl ?? '')
    setBackPreview(context?.assets.back?.previewUrl ?? '')
  }

  function loadSavedNewDraft() {
    clearArt()
    setEditing(null)
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      setDraft(saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY)
    } catch { setDraft(EMPTY) }
  }

  async function editCard(cardId: string) {
    setBusy(true); setError(''); setMessage('')
    try {
      const cardResult = await supabase.from('cards').select('id,character_id,set_id,number,book_range,description,published').eq('id', cardId).single()
      if (cardResult.error) throw cardResult.error
      const card = cardResult.data

      const characterResult = await supabase.from('characters').select('id,series_id,name').eq('id', card.character_id).single()
      if (characterResult.error) throw characterResult.error
      const character = characterResult.data

      const [seriesResult, setResult, variantResult] = await Promise.all([
        supabase.from('series').select('id,title,author').eq('id', character.series_id).single(),
        supabase.from('card_sets').select('id,title,code').eq('id', card.set_id).single(),
        supabase.from('variants').select('id,label,rarity,rating').eq('card_id', card.id).limit(1).maybeSingle(),
      ])
      if (seriesResult.error) throw seriesResult.error
      if (setResult.error) throw setResult.error
      if (variantResult.error) throw variantResult.error

      const variant = variantResult.data
      const assets: EditContext['assets'] = {}
      if (variant?.id) {
        const assetResult = await supabase.from('card_assets').select('id,side,storage_path').eq('variant_id', variant.id)
        if (assetResult.error) throw assetResult.error
        for (const asset of assetResult.data ?? []) {
          if (asset.side !== 'front' && asset.side !== 'back') continue
          const signed = await supabase.storage.from('card-art').createSignedUrl(asset.storage_path, 3600)
          const item: ExistingAsset = { id: asset.id, storage_path: asset.storage_path, previewUrl: signed.data?.signedUrl }
          assets[asset.side] = item
        }
      }

      const context: EditContext = {
        cardId: card.id,
        characterId: character.id,
        seriesId: seriesResult.data.id,
        setId: setResult.data.id,
        variantId: variant?.id ?? null,
        characterName: character.name,
        assets,
      }
      setEditing(context)
      setDraft({
        seriesTitle: seriesResult.data.title,
        author: seriesResult.data.author,
        characterName: character.name,
        setTitle: setResult.data.title,
        setCode: setResult.data.code,
        cardNumber: card.number ?? '',
        bookRange: card.book_range,
        description: card.description,
        variantLabel: variant?.label ?? 'Standard',
        rarity: (variant?.rarity ?? 'common') as Draft['rarity'],
        rating: (variant?.rating ?? 'sfw') as Draft['rating'],
        published: card.published,
      })
      setFrontFile(null); setBackFile(null)
      setPreview('front', assets.front?.previewUrl ?? '')
      setPreview('back', assets.back?.previewUrl ?? '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this card for editing.')
    } finally { setBusy(false) }
  }

  async function findOrCreateSeries() {
    const slug = slugify(draft.seriesTitle)
    const { data } = await supabase.from('series').select('id').eq('slug', slug).maybeSingle()
    if (data?.id) return data.id as string
    const inserted = await supabase.from('series').insert({ slug, title: draft.seriesTitle.trim(), author: draft.author.trim(), published: draft.published }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function findOrCreateCharacter(seriesId: string) {
    const { data } = await supabase.from('characters').select('id').eq('series_id', seriesId).eq('name', draft.characterName.trim()).maybeSingle()
    if (data?.id) return data.id as string
    const inserted = await supabase.from('characters').insert({ series_id: seriesId, name: draft.characterName.trim(), lore: {} }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function findOrCreateSet(seriesId: string) {
    const code = draft.setCode.trim().toUpperCase()
    const { data } = await supabase.from('card_sets').select('id').eq('code', code).maybeSingle()
    if (data?.id) return data.id as string
    const inserted = await supabase.from('card_sets').insert({ series_id: seriesId, title: draft.setTitle.trim(), code, featured: false, published: draft.published }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function uploadArt(file: File, side: 'front' | 'back', cardId: string, variantId: string, existing?: ExistingAsset) {
    const path = existing?.storage_path ?? `${draft.rating}/${cardId}/${variantId}-${side}.${extensionFor(file)}`
    const upload = await supabase.storage.from('card-art').upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: Boolean(existing),
    })
    if (upload.error) throw upload.error
    if (!existing) {
      const asset = await supabase.from('card_assets').insert({ variant_id: variantId, side, storage_path: path })
      if (asset.error) throw asset.error
    }
  }

  async function saveExistingCard() {
    if (!editing) return
    const code = draft.setCode.trim().toUpperCase()
    const seriesUpdate = await supabase.from('series').update({ slug: slugify(draft.seriesTitle), title: draft.seriesTitle.trim(), author: draft.author.trim() }).eq('id', editing.seriesId)
    if (seriesUpdate.error) throw seriesUpdate.error
    const characterUpdate = await supabase.from('characters').update({ name: draft.characterName.trim() }).eq('id', editing.characterId)
    if (characterUpdate.error) throw characterUpdate.error
    const setUpdate = await supabase.from('card_sets').update({ title: draft.setTitle.trim(), code, published: draft.published }).eq('id', editing.setId)
    if (setUpdate.error) throw setUpdate.error
    const cardUpdate = await supabase.from('cards').update({
      number: draft.cardNumber.trim() || null,
      book_range: draft.bookRange.trim(),
      description: draft.description.trim(),
      published: draft.published,
      updated_at: new Date().toISOString(),
    }).eq('id', editing.cardId)
    if (cardUpdate.error) throw cardUpdate.error

    let variantId = editing.variantId
    if (variantId) {
      const variantUpdate = await supabase.from('variants').update({
        label: draft.variantLabel.trim() || 'Standard', rarity: draft.rarity, rating: draft.rating,
        premium: draft.rating === 'adult', available: draft.published,
      }).eq('id', variantId)
      if (variantUpdate.error) throw variantUpdate.error
    } else {
      const created = await supabase.from('variants').insert({
        card_id: editing.cardId, label: draft.variantLabel.trim() || 'Standard', rarity: draft.rarity,
        rating: draft.rating, premium: draft.rating === 'adult', foil: false, available: draft.published,
        craft_cost: 30, duplicate_shards: 10,
      }).select('id').single()
      if (created.error) throw created.error
      variantId = created.data.id
    }

    const uploads: Promise<void>[] = []
    if (frontFile) uploads.push(uploadArt(frontFile, 'front', editing.cardId, variantId, editing.assets.front))
    if (backFile) uploads.push(uploadArt(backFile, 'back', editing.cardId, variantId, editing.assets.back))
    await Promise.all(uploads)
  }

  async function saveCard(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!draft.seriesTitle.trim() || !draft.author.trim() || !draft.characterName.trim() || !draft.setTitle.trim() || !draft.setCode.trim() || !draft.bookRange.trim() || !draft.description.trim()) {
      setError('Fill in the required fields before saving.'); return
    }

    setBusy(true)
    try {
      if (editing) {
        const name = draft.characterName.trim()
        await saveExistingCard()
        loadSavedNewDraft()
        setMessage(`${name} was updated without creating a duplicate.`)
      } else {
        const seriesId = await findOrCreateSeries()
        const characterId = await findOrCreateCharacter(seriesId)
        const setId = await findOrCreateSet(seriesId)
        const cardResult = await supabase.from('cards').insert({
          character_id: characterId, set_id: setId, number: draft.cardNumber.trim() || null,
          book_range: draft.bookRange.trim(), description: draft.description.trim(), published: draft.published,
        }).select('id').single()
        if (cardResult.error) throw cardResult.error
        const variantResult = await supabase.from('variants').insert({
          card_id: cardResult.data.id, label: draft.variantLabel.trim() || 'Standard', rarity: draft.rarity,
          rating: draft.rating, premium: draft.rating === 'adult', foil: false, available: draft.published,
          craft_cost: 30, duplicate_shards: 10,
        }).select('id').single()
        if (variantResult.error) throw variantResult.error
        const uploads: Promise<void>[] = []
        if (frontFile) uploads.push(uploadArt(frontFile, 'front', cardResult.data.id, variantResult.data.id))
        if (backFile) uploads.push(uploadArt(backFile, 'back', cardResult.data.id, variantResult.data.id))
        await Promise.all(uploads)
        const name = draft.characterName.trim()
        localStorage.removeItem(DRAFT_KEY); setDraft(EMPTY); clearArt()
        setMessage(`${name} was added to the live catalog${uploads.length ? ' with card art' : ''}.`)
      }
      await refreshCards()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the card.')
    } finally { setBusy(false) }
  }

  const inputStyle = { width: '100%', background: '#151914', border: '1px solid #3a4234', color: '#eeeede', borderRadius: 6, padding: '11px 12px' }
  const labelStyle = { display: 'grid', gap: 6, fontSize: 12, color: '#aeb6a4' }
  const artBoxStyle = { border: '1px solid #30362d', borderRadius: 8, background: '#151914', padding: 12, display: 'grid', gap: 10 }

  return (
    <main style={{ maxWidth: 1180, paddingTop: 36, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <p className="eyebrow">TROPEAMINE PACKS · ADMIN</p>
          <h1 style={{ marginBottom: 8 }}>Card Manager</h1>
          <p style={{ marginBottom: 0 }}>Create new cards or edit the live catalog without making duplicates.</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#8f9888' }}><div>{email}</div><Link className="text-link" href="/">Back to site</Link></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, .75fr)', gap: 24, alignItems: 'start' }}>
        <form onSubmit={saveCard} style={{ border: editing ? '1px solid #81744d' : '1px solid #30362d', background: '#191c18', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 7 }}>{editing ? 'EDITING LIVE CARD' : 'NEW CATALOG ENTRY'}</p>
              <h2 style={{ fontSize: 28 }}>{editing ? `Edit ${editing.characterName}` : 'New card'}</h2>
            </div>
            {editing && <button className="button outline" type="button" onClick={loadSavedNewDraft} disabled={busy} style={{ minHeight: 34, padding: '7px 10px' }}>Cancel edit</button>}
          </div>
          <p style={{ fontSize: 12 }}>{editing ? 'Changes update this exact live card. Existing art stays unless you choose a replacement.' : 'Your text fields are saved in this browser automatically. Selected image files must be reselected after a page refresh.'}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>Series title *<input style={inputStyle} value={draft.seriesTitle} onChange={e => update('seriesTitle', e.target.value)} placeholder="Coven King" /></label>
            <label style={labelStyle}>Author *<input style={inputStyle} value={draft.author} onChange={e => update('author', e.target.value)} placeholder="Author name" /></label>
            <label style={labelStyle}>Character name *<input style={inputStyle} value={draft.characterName} onChange={e => update('characterName', e.target.value)} placeholder="Felicity" /></label>
            <label style={labelStyle}>Book range *<input style={inputStyle} value={draft.bookRange} onChange={e => update('bookRange', e.target.value)} placeholder="Books 1–4" /></label>
            <label style={labelStyle}>Set title *<input style={inputStyle} value={draft.setTitle} onChange={e => update('setTitle', e.target.value)} placeholder="Coven King" /></label>
            <label style={labelStyle}>Set code *<input style={inputStyle} value={draft.setCode} onChange={e => update('setCode', e.target.value)} placeholder="CK01" /></label>
            <label style={labelStyle}>Card number<input style={inputStyle} value={draft.cardNumber} onChange={e => update('cardNumber', e.target.value)} placeholder="001" /></label>
            <label style={labelStyle}>Variant label<input style={inputStyle} value={draft.variantLabel} onChange={e => update('variantLabel', e.target.value)} /></label>
            <label style={labelStyle}>Rarity<select style={inputStyle} value={draft.rarity} onChange={e => update('rarity', e.target.value as Draft['rarity'])}><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="legendary">Legendary</option></select></label>
            <label style={labelStyle}>Content rating<select style={inputStyle} value={draft.rating} onChange={e => update('rating', e.target.value as Draft['rating'])}><option value="sfw">SFW</option><option value="adult">Adult / Premium</option></select></label>
          </div>

          <label style={{ ...labelStyle, marginTop: 14 }}>Description *<textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} value={draft.description} onChange={e => update('description', e.target.value)} placeholder="Short card/character description" /></label>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', marginBottom: 10 }}>
              <div><strong style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 400 }}>Card art</strong><div style={{ color: '#8f9888', fontSize: 11 }}>JPG, PNG, or WebP · max 20 MB each</div></div>
              {(frontFile || backFile) && <button className="text-link" type="button" onClick={() => editing ? restoreExistingArt() : clearArt()} disabled={busy}>{editing ? 'Undo art changes' : 'Clear art'}</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={artBoxStyle}>
                <span style={{ fontSize: 12, color: '#c7cdbd' }}>Front card art</span>
                {frontPreview ? <img src={frontPreview} alt="Front card preview" style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'contain', borderRadius: 6, background: '#0f120f' }} /> : <div style={{ aspectRatio: '2 / 3', border: '1px dashed #3a4234', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#707a6b', fontSize: 12 }}>No front image yet</div>}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => chooseArt('front', e)} disabled={busy} />
                <small style={{ color: '#889181' }}>{frontFile ? frontFile.name : editing?.assets.front ? 'Existing front art — choose a file to replace it' : 'Choose front art'}</small>
              </label>
              <label style={artBoxStyle}>
                <span style={{ fontSize: 12, color: '#c7cdbd' }}>Back / profile art</span>
                {backPreview ? <img src={backPreview} alt="Back card preview" style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'contain', borderRadius: 6, background: '#0f120f' }} /> : <div style={{ aspectRatio: '2 / 3', border: '1px dashed #3a4234', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#707a6b', fontSize: 12 }}>No back image yet</div>}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => chooseArt('back', e)} disabled={busy} />
                <small style={{ color: '#889181' }}>{backFile ? backFile.name : editing?.assets.back ? 'Existing back art — choose a file to replace it' : 'Choose back art'}</small>
              </label>
            </div>
          </div>

          <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 16, fontSize: 12, color: '#aeb6a4' }}>
            <input type="checkbox" checked={draft.published} onChange={e => update('published', e.target.checked)} /> Publish immediately
          </label>

          {error && <p style={{ color: '#e6a6a6', marginTop: 16, marginBottom: 0 }}>{error}</p>}
          {message && <p style={{ color: '#b9d8ae', marginTop: 16, marginBottom: 0 }}>{message}</p>}

          <div className="button-row" style={{ marginTop: 20 }}>
            <button className="button gold" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update live card' : 'Save to live catalog'}</button>
            {!editing && <button className="button outline" type="button" disabled={busy} onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraft(EMPTY); clearArt(); setError(''); setMessage('') }}>Clear draft</button>}
          </div>
        </form>

        <section style={{ border: '1px solid #30362d', background: '#191c18', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div><p className="eyebrow" style={{ marginBottom: 6 }}>LIVE CATALOG</p><h2 style={{ fontSize: 24, margin: 0 }}>Recent cards</h2></div>
            <button className="button outline" type="button" onClick={() => void refreshCards()} disabled={loading || busy} style={{ minHeight: 34, padding: '7px 10px' }}>Refresh</button>
          </div>
          {loading ? <p>Loading catalog…</p> : rows.length === 0 ? <p>No live cards yet.</p> : (
            <div style={{ display: 'grid', gap: 9 }}>
              {rows.map(row => (
                <div key={row.id} style={{ border: editing?.cardId === row.id ? '1px solid #81744d' : '1px solid #2d342a', borderRadius: 7, padding: '11px 12px', background: '#151914' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <div>
                      <strong style={{ display: 'block', fontFamily: 'Georgia, serif', fontSize: 17 }}>{row.characters?.name || 'Unnamed character'}</strong>
                      <span style={{ display: 'block', color: '#919b89', fontSize: 11 }}>{row.characters?.series?.title || 'Series'} · {row.card_sets?.code || row.card_sets?.title || 'Set'} {row.number ? `· #${row.number}` : ''}</span>
                      <span style={{ display: 'block', color: row.published ? '#a8c99f' : '#c9bc91', fontSize: 10, marginTop: 4 }}>{row.published ? 'Published' : 'Draft'}{row.variants?.[0]?.rarity ? ` · ${row.variants[0].rarity}` : ''}</span>
                    </div>
                    <button className="button outline" type="button" disabled={busy} onClick={() => void editCard(row.id)} style={{ minHeight: 32, padding: '6px 10px', fontSize: 11 }}>{editing?.cardId === row.id ? 'Editing' : 'Edit'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`@media (max-width: 820px){div:has(> form + section){grid-template-columns:1fr!important} form > div{grid-template-columns:1fr!important}}`}</style>
    </main>
  )
}
