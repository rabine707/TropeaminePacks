export const POLICY_VERSION = '2026-10-14';
export const SUPPORT_EMAIL = 'RSI.projects707@gmail.com';
export const CONTENT_NOTICE = 'Inspired by books with mature themes, including sexual references, violence, and strong language. This beta offers non-explicit cards.';
export type AgeBand = '13_17' | '18_plus';
export const POLICY_COOKIE = 'tp-account-policy';
export const AGE_BLOCK_COOKIE = 'tp-age-block';
export const POLICY_TTL_SECONDS = 900;

export function eligibleAge(value: unknown): value is AgeBand {
  return value === '13_17' || value === '18_plus';
}

export function validatePolicy(input: unknown): AgeBand {
  const value = input as Record<string, unknown> | null;
  if (!value || !eligibleAge(value.ageBand)) throw new Error('Accounts are available to people aged 13 and older.');
  if (value.acceptTerms !== true || value.version !== POLICY_VERSION) throw new Error('Please accept the current Terms and acknowledge the Privacy Policy.');
  return value.ageBand;
}

/** A token refresh is not reauthentication. Only a recent verified AMR counts. */
export function hasRecentAuthentication(claims: Record<string, unknown> | null, nowSeconds = Date.now() / 1000): boolean {
  if (!claims || !Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry: unknown) => {
    const item = entry as {method?: unknown; timestamp?: unknown};
    return ['password', 'oauth', 'otp', 'totp', 'webauthn'].includes(String(item?.method)) &&
      typeof item?.timestamp === 'number' && item.timestamp <= nowSeconds + 30 && nowSeconds - item.timestamp <= POLICY_TTL_SECONDS;
  });
}

/** Next may use an internal hostname in request.url; compare the browser Origin to Host. */
export function publicRequestOrigin(request: Request): string {
  const internal = new URL(request.url);
  const host = request.headers.get('host') || internal.host;
  const hostname = new URL(`https://${host}`).hostname;
  const local = ['localhost','127.0.0.1','[::1]'].includes(hostname);
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwarded === 'https' || internal.protocol === 'https:' || !local ? 'https' : 'http';
  return new URL(`${protocol}://${host}`).origin;
}
export function sameOrigin(request: Request): boolean {
  try {return request.headers.get('origin') === publicRequestOrigin(request);} catch {return false;}
}

/** Remove only Tropeamine data, including Supabase session keys; never clear unrelated storage. */
export function clearAccountStorage(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && (/^tropeamine/i.test(key) || /^tp-(?:studio|showcase|account)/.test(key) || /^sb-.*-auth-token/.test(key))) keys.push(key);
  }
  keys.forEach(key => storage.removeItem(key));
}
