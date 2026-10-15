import {hasRecentAuthentication, sameOrigin} from './account-policy.ts';

type Result = {error: unknown};
export type DeletionServices = {
  verifiedAccount: () => Promise<{id: string; accessToken: string; claims: Record<string, unknown>} | null>;
  preflight: () => Promise<Result>;
  revokeSessions: (accessToken: string) => Promise<Result>;
  deleteUser: (id: string) => Promise<Result>;
  clearCookies: () => Promise<void>;
};

export async function deleteAccount(request: Request, services: DeletionServices): Promise<Response> {
  const reply = (error: string, status: number) => Response.json({error}, {status, headers: {'Cache-Control': 'no-store'}});
  if (!sameOrigin(request)) return reply('Request origin is not allowed.', 403);
  if (Number(request.headers.get('content-length') || 0) > 1024) return reply('Request too large.', 413);
  try {
    const input = await request.json();
    // Never accept a target ID from the browser, even for an administrator.
    if (input.confirmation !== 'DELETE' || Object.keys(input).some(key => key !== 'confirmation')) return reply('Type DELETE to confirm account deletion.', 400);
    const account = await services.verifiedAccount();
    if (!account) return reply('Sign in required.', 401);
    if (!hasRecentAuthentication(account.claims)) return reply('Sign in again before deleting your account. A refreshed session does not count as a new sign-in.', 428);
    const preflight = await services.preflight();
    if (preflight.error) return reply('Deletion needs support review or database setup. Catalog uploads and the last creator account must be transferred safely first.', 409);
    const revoked = await services.revokeSessions(account.accessToken);
    if (revoked.error) return reply('Could not revoke your sessions. Your account has not been deleted.', 503);
    // The Auth deletion transaction runs the reviewed cleanup trigger. Failure rolls back data cleanup.
    const deleted = await services.deleteUser(account.id);
    if (deleted.error) return reply('Your sessions were signed out, but your account was not deleted. Sign in again or contact support.', 503);
    await services.clearCookies();
    return Response.json({deleted: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch { return reply('Deletion could not be completed. Please contact support.', 503); }
}
