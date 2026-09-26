'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
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

const EMPTY: Draft = {
  seriesTitle: '',
  author: '',
  characterName: '',
  setTitle: '',
  setCode: '',
  cardNumber: '',
  bookRange: '',
  description: '',
  variantLabel: 'Standard',
  rarity: 'common',
  rating: 'sfw',
  published: false,
}

const DRAFT_KEY = 'tropeamine-admin-card-draft-v1'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function CardManager({ email }: { email: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) setDraft({ ...EMPTY, ...JSON.parse(saved) })
    } catch {}
    void refreshCards()
  }, [])

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
  }, [draft])

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

  async function findOrCreateSeries() {
    const slug = slugify(draft.seriesTitle)
    let { data } = await supabase.from('series').select('id').eq('slug', slug).maybeSingle()
    if (data?.id) return data.id as string

    const inserted = await supabase.from('series').insert({
      slug,
      title: draft.seriesTitle.trim(),
      author: draft.author.trim(),
      published: draft.published,
    }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function findOrCreateCharacter(seriesId: string) {
    let { data } = await supabase.from('characters').select('id').eq('series_id', seriesId).eq('name', draft.characterName.trim()).maybeSingle()
    if (data?.id) return data.id as string

    const inserted = await supabase.from('characters').insert({
      series_id: seriesId,
      name: draft.characterName.trim(),
      lore: {},
    }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function findOrCreateSet(seriesId: string) {
    const code = draft.setCode.trim().toUpperCase()
    let { data } = await supabase.from('card_sets').select('id').eq('code', code).maybeSingle()
    if (data?.id) return data.id as string

    const inserted = await supabase.from('card_sets').insert({
      series_id: seriesId,
      title: draft.setTitle.trim(),
      code,
      featured: false,
      published: draft.published,
    }).select('id').single()
    if (inserted.error) throw inserted.error
    return inserted.data.id as string
  }

  async function saveCard(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!draft.seriesTitle.trim() || !draft.author.trim() || !draft.characterName.trim() || !draft.setTitle.trim() || !draft.setCode.trim() || !draft.bookRange.trim() || !draft.description.trim()) {
      setError('Fill in the required fields before saving.')
      return
    }

    setBusy(true)
    try {
      const seriesId = await findOrCreateSeries()
      const characterId = await findOrCreateCharacter(seriesId)
      const setId = await findOrCreateSet(seriesId)

      const cardResult = await supabase.from('cards').insert({
        character_id: characterId,
        set_id: setId,
        number: draft.cardNumber.trim() || null,
        book_range: draft.bookRange.trim(),
        description: draft.description.trim(),
        published: draft.published,
      }).select('id').single()
      if (cardResult.error) throw cardResult.error

      const variantResult = await supabase.from('variants').insert({
        card_id: cardResult.data.id,
        label: draft.variantLabel.trim() || 'Standard',
        rarity: draft.rarity,
        rating: draft.rating,
        premium: draft.rating === 'adult',
        foil: false,
        available: draft.published,
        craft_cost: 30,
        duplicate_shards: 10,
      })
      if (variantResult.error) throw variantResult.error

      localStorage.removeItem(DRAFT_KEY)
      setDraft(EMPTY)
      setMessage(`${draft.characterName.trim()} was added to the live catalog.`)
      await refreshCards()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the card.')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = { width: '100%', background: '#151914', border: '1px solid #3a4234', color: '#eeeede', borderRadius: 6, padding: '11px 12px' }
  const labelStyle = { display: 'grid', gap: 6, fontSize: 12, color: '#aeb6a4' }

  return (
    <main style={{ maxWidth: 1180, paddingTop: 36, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <p className="eyebrow">TROPEAMINE PACKS · ADMIN</p>
          <h1 style={{ marginBottom: 8 }}>Card Manager</h1>
          <p style={{ marginBottom: 0 }}>Create catalog entries directly in the live Supabase database.</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#8f9888' }}>
          <div>{email}</div>
          <Link className="text-link" href="/">Back to site</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, .75fr)', gap: 24, alignItems: 'start' }}>
        <form onSubmit={saveCard} style={{ border: '1px solid #30362d', background: '#191c18', borderRadius: 10, padding: 24 }}>
          <h2 style={{ fontSize: 28 }}>New card</h2>
          <p style={{ fontSize: 12 }}>Your unfinished form is saved in this browser automatically.</p>

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

          <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 16, fontSize: 12, color: '#aeb6a4' }}>
            <input type="checkbox" checked={draft.published} onChange={e => update('published', e.target.checked)} />
            Publish immediately
          </label>

          {error && <p style={{ color: '#e6a6a6', marginTop: 16, marginBottom: 0 }}>{error}</p>}
          {message && <p style={{ color: '#b9d8ae', marginTop: 16, marginBottom: 0 }}>{message}</p>}

          <div className="button-row" style={{ marginTop: 20 }}>
            <button className="button gold" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save to live catalog'}</button>
            <button className="button outline" type="button" disabled={busy} onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraft(EMPTY); setError(''); setMessage('') }}>Clear draft</button>
          </div>
        </form>

        <section style={{ border: '1px solid #30362d', background: '#191c18', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div><p className="eyebrow" style={{ marginBottom: 6 }}>LIVE CATALOG</p><h2 style={{ fontSize: 24, margin: 0 }}>Recent cards</h2></div>
            <button className="button outline" type="button" onClick={() => void refreshCards()} disabled={loading} style={{ minHeight: 34, padding: '7px 10px' }}>Refresh</button>
          </div>
          {loading ? <p>Loading catalog…</p> : rows.length === 0 ? <p>No live cards yet.</p> : (
            <div style={{ display: 'grid', gap: 9 }}>
              {rows.map(row => (
                <div key={row.id} style={{ border: '1px solid #2d342a', borderRadius: 7, padding: '11px 12px', background: '#151914' }}>
                  <strong style={{ display: 'block', fontFamily: 'Georgia, serif', fontSize: 17 }}>{row.characters?.name || 'Unnamed character'}</strong>
                  <span style={{ display: 'block', color: '#919b89', fontSize: 11 }}>{row.characters?.series?.title || 'Series'} · {row.card_sets?.code || row.card_sets?.title || 'Set'} {row.number ? `· #${row.number}` : ''}</span>
                  <span style={{ display: 'block', color: row.published ? '#a8c99f' : '#c9bc91', fontSize: 10, marginTop: 4 }}>{row.published ? 'Published' : 'Draft'}{row.variants?.[0]?.rarity ? ` · ${row.variants[0].rarity}` : ''}</span>
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
