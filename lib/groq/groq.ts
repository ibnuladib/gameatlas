/**
 * Groq API client — uses the OpenAI-compatible /chat/completions endpoint.
 * Falls back gracefully when GROQ_API_KEY is not configured.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const TIMEOUT_MS = 8_000;

function getApiKey(): string | null {
  return process.env.GROQ_API_KEY ?? null;
}

function getModel(): string {
  return process.env.GROQ_MODEL ?? DEFAULT_MODEL;
}

export function isGroqConfigured(): boolean {
  return Boolean(getApiKey());
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

type GroqResponse = {
  choices?: { message?: { content?: string } }[];
};

/**
 * Send a chat completion request to Groq.
 * Returns the assistant's response text, or `null` on any failure.
 */
export async function groqChat(
  messages: Message[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        max_tokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const json = (await res.json()) as GroqResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Groq to rephrase a game recommendation explanation.
 * Returns the original `fallback` if Groq is not configured or fails.
 */
export async function groqRephrase(rawExplanation: string, fallback: string): Promise<string> {
  const result = await groqChat([
    {
      role: 'system',
      content:
        'You are GameAtlas, a concise game recommendation assistant. ' +
        'Rewrite the given recommendation explanation in 2 short, engaging sentences. ' +
        'Keep all game names exactly as given. Do NOT invent facts or features not mentioned. ' +
        'Be conversational and enthusiastic but brief.',
    },
    {
      role: 'user',
      content: rawExplanation,
    },
  ]);
  return result ?? fallback;
}
