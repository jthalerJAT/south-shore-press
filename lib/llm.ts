import 'server-only';

/**
 * Multi-provider LLM client for the Story Draft Engine — SERVER ONLY.
 * The model is chosen per writer (writers.model); the provider is inferred
 * from the model name:
 *   claude-*  → Anthropic Messages API (ANTHROPIC_API_KEY)
 *   grok-*    → xAI chat completions, OpenAI format (XAI_API_KEY)
 * Callers degrade gracefully when the needed key isn't set.
 */

export const DEFAULT_MODEL = process.env.DRAFT_ENGINE_MODEL ?? 'claude-sonnet-5';

type Provider = 'anthropic' | 'xai';

function providerFor(model: string): Provider {
  return model.toLowerCase().startsWith('grok') ? 'xai' : 'anthropic';
}

export function isModelEnabled(model: string): { ok: boolean; error?: string } {
  const p = providerFor(model);
  if (p === 'xai' && !process.env.XAI_API_KEY) {
    return { ok: false, error: `Model ${model} needs XAI_API_KEY in the environment.` };
  }
  if (p === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: `Model ${model} needs ANTHROPIC_API_KEY in the environment.` };
  }
  return { ok: true };
}

export async function llmComplete(params: {
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const model = params.model?.trim() || DEFAULT_MODEL;
  const gate = isModelEnabled(model);
  if (!gate.ok) return { ok: false, error: gate.error! };

  try {
    if (providerFor(model) === 'xai') {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: params.maxTokens ?? 4000,
          messages: [
            { role: 'system', content: params.system },
            { role: 'user', content: params.user },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[llmComplete:xai]', res.status, detail.slice(0, 500));
        return { ok: false, error: `xAI API error (${res.status}).` };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) return { ok: false, error: 'The model returned no text.' };
      return { ok: true, text };
    }

    // Anthropic. Notes learned on princess-capital: no `temperature` param on
    // claude-sonnet-5, and responses may contain multiple text blocks — join all.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 4000,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[llmComplete:anthropic]', res.status, detail.slice(0, 500));
      return { ok: false, error: `Claude API error (${res.status}).` };
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
    if (!text.trim()) return { ok: false, error: 'The model returned no text.' };
    return { ok: true, text };
  } catch (err) {
    console.error('[llmComplete]', err);
    return { ok: false, error: 'Could not reach the model API.' };
  }
}
