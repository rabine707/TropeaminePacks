/** Stable URLs contain the immutable object revision, never an expiring signature. */
export type CardArtSize = 'original' | 'browse' | 'reveal';

export function cardArtUrl(id: string, path: string, size: CardArtSize = 'original') {
  return `/api/card-art/${encodeURIComponent(id)}?${new URLSearchParams({v: path, size})}`;
}

function sizedArtUrl(url: string, size: Exclude<CardArtSize, 'original'>) {
  if (!url.startsWith('/api/card-art/')) return url;
  const parsed = new URL(url, 'https://local.invalid');
  parsed.searchParams.set('size', size);
  return parsed.pathname + parsed.search;
}

export function browseArtUrl(url: string) {
  return sizedArtUrl(url, 'browse');
}

/** Pack reveals get a much sharper derivative without pulling the full source PNG/JPEG. */
export function revealArtUrl(url: string) {
  return sizedArtUrl(url, 'reveal');
}

/** Retain the live Storage policy's UUID/UUID-side.ext shape for every revision. */
export function newCardArtPath(rating: 'sfw' | 'adult', cardId: string, side: 'front' | 'back', extension: string) {
  return `${rating}/${cardId}/${crypto.randomUUID()}-${side}.${extension}`;
}
