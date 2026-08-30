/** Strip control characters and normalize whitespace for untrusted text. */
export function sanitizeUserText(input: string, maxLen: number): string {
  return input
    .replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Remove ILIKE wildcards so user input cannot broaden a name search. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '');
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<\s*\/?\s*system\s*>/i,
  /<\s*\/?\s*assistant\s*>/i,
  /<\s*\/?\s*user\s*>/i,
  /```\s*system/i,
  /jailbreak/i,
  /do\s+not\s+follow/i,
  /override\s+(your\s+)?(rules|instructions|policy)/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /print\s+(your\s+)?(system\s+)?prompt/i,
];

/** True when the text looks like an attempt to hijack an LLM system prompt. */
export function looksLikePromptInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Remove obvious injection phrases before rule-based parsing or LLM rephrase.
 * The ranking engine never sees raw LLM output — this only guards Groq phrasing.
 */
export function stripPromptInjection(input: string): string {
  let out = input;
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, '');
  }
  return sanitizeUserText(out, input.length);
}

/** Safe error string for API responses — no stack traces or env details. */
export function sanitizeErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message.trim();
  if (!msg || msg.length > 200) return fallback;
  if (/secret|password|token|key|authorization/i.test(msg)) return fallback;
  return msg;
}
