import OpenAI from "openai";
import { z } from "zod";
import { config } from "@/lib/config";

/**
 * xAI client via OpenAI-compatible SDK.
 * Prefer chat.completions; fall back messaging documented in README if needed.
 * Spike note: xAI also exposes responses.create — we use chat.completions first
 * for structured JSON via response_format.
 */
export function getXaiClient(): OpenAI {
  if (!config.xai.apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  return new OpenAI({
    apiKey: config.xai.apiKey,
    baseURL: config.xai.baseUrl,
    timeout: config.xai.timeoutMs,
    maxRetries: 1,
  });
}

export function isAiConfigured(): boolean {
  return Boolean(config.xai.apiKey);
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
  };

  try {
    return await run();
  } catch (e) {
    // one repair retry
    return await run(
      "Your previous response was invalid. Return ONLY valid JSON matching the requested schema."
    );
  }
}
