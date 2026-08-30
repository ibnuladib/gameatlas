/**
 * Cookie-header hardening. The app stores Steam ID in localStorage, not cookies,
 * but we still reject malformed Cookie headers to block injection/smuggling.
 */

const MAX_COOKIE_HEADER_BYTES = 4096;

/** Reject cookie headers that could smuggle headers or blow parser limits. */
export function isCookieHeaderSafe(cookieHeader: string | null): boolean {
  if (!cookieHeader) return true;
  if (cookieHeader.length > MAX_COOKIE_HEADER_BYTES) return false;
  // CR/LF/null in Cookie can inject extra headers in some stacks.
  if (/[\0\r\n]/.test(cookieHeader)) return false;
  return true;
}
