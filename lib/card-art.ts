/** Stable URLs contain the immutable object revision, never an expiring signature. */
export function cardArtUrl(id: string, path: string, size: 'original' | 'browse' = 'original') {
  return `/api/card-art/${encodeURIComponent(id)}?${new URLSearchParams({v: path, size})}`;
}

export function browseArtUrl(url: string) {
  if (!url.startsWith('/api/card-art/')) return url;
  const parsed = new URL(url, 'https://local.invalid');
  parsed.searchParams.set('size', 'browse');
  return parsed.pathname + parsed.search;
}

/** Retain the live Storage policy's UUID/UUID-side.ext shape for every revision. */
export function newCardArtPath(rating: 'sfw' | 'adult', cardId: string, side: 'front' | 'back', extension: string) {
  return `${rating}/${cardId}/${crypto.randomUUID()}-${side}.${extension}`;
}
