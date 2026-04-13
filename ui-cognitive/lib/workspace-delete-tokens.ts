/**
 * In-memory token store for pending workspace delete confirmations.
 * Tokens are issued by the Python workspace_delete tool and consumed here
 * after PIN validation.
 */

const TOKEN_TTL_MS = 300_000; // 5 minutes

interface PendingDelete {
  path: string;
  size_mb: number;
  location: string;
  target: string;
  expiresAt: number;
}

const _store = new Map<string, PendingDelete>();

export function registerDeleteToken(
  data: Omit<PendingDelete, "expiresAt">,
  expiresAt: number = Date.now() + TOKEN_TTL_MS,
): string {
  const token = crypto.randomUUID();
  _store.set(token, { ...data, expiresAt });
  return token;
}

export function registerDeleteTokenWithId(
  token: string,
  data: Omit<PendingDelete, "expiresAt">,
  expiresAt: number = Date.now() + TOKEN_TTL_MS,
): void {
  _store.set(token, { ...data, expiresAt });
}

export type TokenStatus = "valid" | "expired" | "not_found";

export function checkTokenStatus(token: string): TokenStatus {
  const entry = _store.get(token);
  if (!entry) return "not_found";
  if (Date.now() > entry.expiresAt) return "expired";
  return "valid";
}

export function lookupDeleteToken(token: string): PendingDelete | null {
  const entry = _store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(token);
    return null;
  }
  return entry;
}

export function consumeDeleteToken(token: string): PendingDelete | null {
  const entry = lookupDeleteToken(token);
  if (entry) _store.delete(token);
  return entry;
}

/** Exposed for tests only — check if a token is still in the store. */
export function _tokenExists(token: string): boolean {
  return _store.has(token);
}

/** Exposed for tests — check if a token is expired (regardless of existence). */
export function _isExpired(token: string): boolean {
  const entry = _store.get(token);
  if (!entry) return true;
  return Date.now() > entry.expiresAt;
}
