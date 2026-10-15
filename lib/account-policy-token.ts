import {createHmac, timingSafeEqual} from 'node:crypto';
import {eligibleAge, POLICY_TTL_SECONDS, POLICY_VERSION, type AgeBand} from './account-policy.ts';

function signature(value: string, secret: string) {
  if (secret.length < 32) throw new Error('Account policy signing is not configured.');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function signPolicy(ageBand: AgeBand, secret: string, now = Date.now() / 1000) {
  const value = Buffer.from(JSON.stringify({ageBand, version: POLICY_VERSION, expires: Math.floor(now) + POLICY_TTL_SECONDS})).toString('base64url');
  return `${value}.${signature(value, secret)}`;
}
export function readPolicy(token: string | undefined, secret: string, now = Date.now() / 1000): AgeBand | null {
  try {
    if (!token || token.length > 1024) return null;
    const [value, signed, extra] = token.split('.');
    if (!value || !signed || extra) return null;
    const expected = Buffer.from(signature(value, secret));
    const actual = Buffer.from(signed);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    return eligibleAge(data.ageBand) && data.version === POLICY_VERSION && typeof data.expires === 'number' &&
      data.expires > now && data.expires <= now + POLICY_TTL_SECONDS + 30 ? data.ageBand : null;
  } catch { return null; }
}
