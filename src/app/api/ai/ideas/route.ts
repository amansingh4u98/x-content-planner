import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  chatJson,
  IdeasResultSchema,
  isAiConfigured,
} from "@/lib/ai/client";
import { ideasUserPrompt } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { withDb } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { topics } from "@/lib/db/schema";
import { buildSystemPrompt, loadVoiceContext } from "@/lib/services/voice";

export const runtime = "nodejs";

const BodySchema = z.object({
  topicId: z.string(),
  count: z.number().int().min(1).max(10).default(5),
  seed: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }
  const limit = checkAiRateLimit();
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI_RATE_LIMIT", retryAfterMs: limit.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const body = BodySchema.parse(await req.json());
    return await withDb(async () => {
      const topic = getDb()
        .select()
        .from(topics)
        .where(eq(topics.id, body.topicId))
        .get();
      if (!topic) {
        return NextResponse.json({ error: "TOPIC_NOT_FOUND" }, { status: 404 });
      }
      const voice = loadVoiceContext();
      const result = await chatJson({
        system: buildSystemPrompt(voice),
        user: ideasUserPrompt({
          topicName: topic.name,
          topicNotes: topic.notes ?? "",
          count: body.count,
          seed: body.seed,
        }),
        schema: IdeasResultSchema,
        temperature: 0.8,
        maxTokens: 1024,
      });
      return NextResponse.json(result);
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error("ai/ideas", e);
    return NextResponse.json(
      { error: "AI_FAILED", message: (e as Error).message },
      { status: 500 }
    );
  }
}
