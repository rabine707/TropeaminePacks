import type {SupabaseClient} from '@supabase/supabase-js';

const fail = (status: number) => new Response('Artwork unavailable', {
  status, headers: {'Cache-Control': 'no-store'},
});

/** Only anonymous-readable, published SFW artwork may enter the shared cache. */
export async function deliverCardArt(request: Request, id: string, client: SupabaseClient, fetchImage: typeof fetch = fetch) {
  const params = new URL(request.url).searchParams;
  const revision = params.get('v');
  const size = params.get('size');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !revision?.startsWith('sfw/') ||
      !['original', 'browse'].includes(size ?? '') ||
      [...params.keys()].some(key => !['v', 'size'].includes(key)) ||
      params.getAll('v').length !== 1 || params.getAll('size').length !== 1) return fail(400);

  try {
    const {data: asset, error} = await client.from('card_assets').select(`
      storage_path, variants!inner(rating,available,cards!inner(published,
        characters!inner(series!inner(published)),card_sets!inner(published)))
    `).eq('id', id).eq('storage_path', revision)
      .eq('variants.rating', 'sfw').eq('variants.available', true)
      .eq('variants.cards.published', true)
      .eq('variants.cards.characters.series.published', true)
      .eq('variants.cards.card_sets.published', true).maybeSingle();
    if (error) return fail(502);
    if (!asset) return fail(404);

    const options = size === 'browse' ? {transform: {width: 560, height: 840, resize: 'contain' as const, quality: 32}} : undefined;
    const signed = await client.storage.from('card-art').createSignedUrl(asset.storage_path, 120, options);
    if (signed.error || !signed.data?.signedUrl) return fail(502);
    // Normalize browse format so the CDN cache does not vary by the visitor's Accept header.
    // Original responses are copied byte-for-byte, with no image transformation.
    const image = await fetchImage(signed.data.signedUrl, {
      cache: 'no-store', headers: {Accept: size === 'browse' ? 'image/webp' : '*/*'},
      signal: AbortSignal.timeout(20_000),
    });
    const type = image.headers.get('content-type')?.split(';')[0] ?? '';
    if (!image.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
      await image.body?.cancel();
      return fail(502);
    }
    return new Response(image.body, {headers: {
      'Content-Type': type,
      // Keep browser caching conservative so unpublishing propagates quickly, while
      // letting Vercel's shared CDN retain revisioned artwork long enough to avoid
      // repeated Supabase DB + Storage work for popular cards.
      'Cache-Control': 'public, max-age=3600',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    }});
  } catch {
    return fail(502);
  }
}
