import { SECURITY_HEADERS } from './headers.constants.js';

export { SECURITY_HEADERS };

export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}
