/** Keep post-authentication navigation on this app, including query strings. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const base = 'https://tropeamine.invalid';
    const target = new URL(value, base);
    if (target.origin !== base) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return '/'; }
}
