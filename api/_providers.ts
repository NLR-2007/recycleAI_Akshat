/**
 * Thin adapter over the two OpenAI-compatible chat-completion providers used by
 * RecycleVision AI. Keys never leave the server.
 *
 *   groq   -> https://api.groq.com/openai/v1   (primary, very fast)
 *   nvidia -> https://integrate.api.nvidia.com/v1 (fallback)
 */

export type ProviderId = 'groq' | 'nvidia';

export interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatTextPart {
  type: 'text';
  text: string;
}
export interface ChatImagePart {
  type: 'image_url';
  image_url: { url: string };
}
export type ChatContent = string | Array<ChatTextPart | ChatImagePart>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

const DEFAULTS: Record<ProviderId, { baseUrl: string; model: string }> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-4-maverick-17b-128e-instruct',
  },
};

/** Reads provider configuration from server env vars, in the configured order. */
export function resolveProviders(): ProviderConfig[] {
  const order = (process.env.AI_PROVIDER_ORDER ?? 'groq,nvidia')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ProviderId => v === 'groq' || v === 'nvidia');

  const unique = [...new Set(order.length ? order : (['groq', 'nvidia'] as ProviderId[]))];

  const configs: ProviderConfig[] = [];
  for (const id of unique) {
    if (id === 'groq') {
      const apiKey = process.env.GROQ_API_KEY?.trim();
      if (!apiKey) continue;
      configs.push({
        id,
        apiKey,
        baseUrl: (process.env.GROQ_BASE_URL?.trim() || DEFAULTS.groq.baseUrl).replace(/\/+$/, ''),
        model: process.env.GROQ_MODEL?.trim() || DEFAULTS.groq.model,
      });
    } else {
      const apiKey = process.env.NVIDIA_NIM_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim();
      if (!apiKey) continue;
      configs.push({
        id,
        apiKey,
        baseUrl: (process.env.NVIDIA_NIM_BASE_URL?.trim() || DEFAULTS.nvidia.baseUrl).replace(/\/+$/, ''),
        model: process.env.NVIDIA_NIM_MODEL?.trim() || DEFAULTS.nvidia.model,
      });
    }
  }
  return configs;
}

/** Calls one provider's /chat/completions endpoint and returns the raw assistant text. */
export async function chatCompletion(
  provider: ProviderConfig,
  messages: ChatMessage[],
  options: { timeoutMs?: number; maxTokens?: number; temperature?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const { timeoutMs = 45_000, maxTokens = 4096, temperature = 0.4, jsonMode = true } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
        stream: false,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Read a bounded amount of the error body; never surface provider internals verbatim.
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        `${provider.id} responded ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
        retryable,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
      throw new ProviderError(`${provider.id} returned an empty completion`, 502, true);
    }
    return text;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError(`${provider.id} request timed out`, 504, true);
    }
    throw new ProviderError(
      `${provider.id} request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      502,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
