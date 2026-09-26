'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function continueWithGoogle() {
    setBusy(true)
    setError('')

    const next = new URLSearchParams(window.location.search).get('next') || '/'
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <main className="empty">
      <p className="eyebrow">TROPEAMINE PACKS</p>
      <h1>Welcome to your collection.</h1>
      <p>Sign in to start syncing your binder across devices.</p>
      <button className="button gold" onClick={continueWithGoogle} disabled={busy}>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && <p>{error}</p>}
      <Link className="text-link" href="/">Back to the collection</Link>
    </main>
  )
}
