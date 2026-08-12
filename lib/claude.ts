import 'server-only';

/**
 * Minimal Claude API client for the Story Draft Engine — SERVER ONLY.
 * Plain fetch (no SDK dependency). Lazily gated on ANTHROPIC_API_KEY like the
 * Stripe/Resend helpers: callers degrade gracefully when the key isn't set.
 *
 * Model notes (learned on princess-capital): no `temperature` param on
 * claude-sonnet-5, and responses may contain MULTIPLE text content blocks —
 * always join them all.
 */

const MODEL = process.env.DRAFT_ENGINE_MODEL ?? 'claude-sonnet-5';

export function isClaudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function claudeComplete(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY is not configured.' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: params.maxTokens ?? 4000,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[claudeComplete]', res.status, detail.slice(0, 500));
      return { ok: false, error: `Claude API error (${res.status}).` };
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
    if (!text.trim()) return { ok: false, error: 'Claude returned no text.' };
    return { ok: true, text };
  } catch (err) {
    console.error('[claudeComplete]', err);
    return { ok: false, error: 'Could not reach the Claude API.' };
  }
}
