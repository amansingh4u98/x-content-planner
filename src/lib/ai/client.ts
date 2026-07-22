import OpenAI from "openai";
import { z } from "zod";
import { config } from "@/lib/config";

/**
 * xAI client via OpenAI-compatible SDK.
 * Prefer chat.completions; fall back messaging documented in README if needed.
 * Spike note: xAI also exposes responses.create — we use chat.completions first
 * for structured JSON via response_format.
 */
export function getXaiClient(opts?: { timeoutMs?: number; maxRetries?: number }): OpenAI {
  if (!config.xai.apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  return new OpenAI({
    apiKey: config.xai.apiKey,
    baseURL: config.xai.baseUrl,
    timeout: opts?.timeoutMs ?? config.xai.timeoutMs,
    maxRetries: opts?.maxRetries ?? 1,
  });
}

export function isAiConfigured(): boolean {
  return Boolean(config.xai.apiKey);
}

/** Structured AI failure for route handlers (billing, auth, rate limits, etc.). */
export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

function providerMessage(e: unknown): string {
  if (!e || typeof e !== "object") return String(e);
  const any = e as {
    error?: unknown;
    message?: string;
  };
  if (typeof any.error === "string" && any.error) return any.error;
  if (any.error && typeof any.error === "object") {
    const nested = any.error as { message?: string };
    if (nested.message) return nested.message;
  }
  if (typeof any.message === "string" && any.message) return any.message;
  return "AI request failed";
}

/** Map OpenAI/xAI SDK errors into AiProviderError when possible. */
export function toAiProviderError(e: unknown): AiProviderError | null {
  if (e instanceof AiProviderError) return e;
  const status =
    e && typeof e === "object" && "status" in e
      ? Number((e as { status: number }).status)
      : undefined;
  const msg = providerMessage(e);
  const lower = msg.toLowerCase();

  if (
    status === 403 ||
    /credits|licenses|billing|purchase those on|insufficient/i.test(lower)
  ) {
    return new AiProviderError(
      msg.includes("console.x.ai")
        ? msg
        : `${msg} Add credits at https://console.x.ai`,
      "AI_NO_CREDITS",
      402
    );
  }
  if (status === 401 || /invalid.*api.?key|unauthorized|authentication/i.test(lower)) {
    return new AiProviderError(msg, "AI_UNAUTHORIZED", 401);
  }
  if (status === 429 || /rate limit/i.test(lower)) {
    return new AiProviderError(msg, "AI_UPSTREAM_RATE_LIMIT", 429);
  }
  if (status === 400) {
    return new AiProviderError(msg, "AI_BAD_REQUEST", 400);
  }
  if (/request timed out|timed out|timeout/i.test(lower)) {
    return new AiProviderError(
      "Research took too long. Try a narrower topic or try again in a moment.",
      "AI_TIMEOUT",
      504
    );
  }
  if (status && status >= 400) {
    return new AiProviderError(msg, "AI_PROVIDER_ERROR", status >= 500 ? 502 : status);
  }
  return null;
}

export function aiErrorJson(e: unknown): {
  body: { error: string; message: string };
  status: number;
} {
  const mapped = toAiProviderError(e);
  if (mapped) {
    return {
      body: { error: mapped.code, message: mapped.message },
      status: mapped.status,
    };
  }
  return {
    body: {
      error: "AI_FAILED",
      message: e instanceof Error ? e.message : "AI request failed",
    },
    status: 500,
  };
}

export const DraftResultSchema = z.object({
  body: z.string(),
  thread: z.array(z.string()).nullable().optional(),
  notes: z.string().optional(),
});

export const IdeasResultSchema = z.object({
  ideas: z.array(z.string()).min(1),
});

export const VoiceResultSchema = z.object({
  summary: z.string(),
  styleNotes: z.string().optional(),
  fewShotIds: z.array(z.string()).optional(),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse JSON from model");
  }
}

function isRetryableParseError(e: unknown): boolean {
  if (toAiProviderError(e)) return false;
  if (e instanceof z.ZodError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /json|parse|schema/i.test(msg);
}

export async function chatJson<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const client = getXaiClient();
  const model = config.xai.model;

  const run = async (extra?: string) => {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: extra ? `${opts.user}\n\n${extra}` : opts.user,
          },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0]?.message?.content ?? "";
      const parsed = extractJson(content);
      return opts.schema.parse(parsed);
    } catch (e) {
      const mapped = toAiProviderError(e);
      if (mapped) throw mapped;
      throw e;
    }
  };

  try {
    return await run();
  } catch (e) {
    // Repair retry only for bad model JSON — not for billing/auth/rate errors.
    if (!isRetryableParseError(e)) throw e;
    return await run(
      "Your previous response was invalid. Return ONLY valid JSON matching the requested schema."
    );
  }
}
