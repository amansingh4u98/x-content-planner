import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  chatJson,
  DraftResultSchema,
  isAiConfigured,
} from "@/lib/ai/client";
import { rewriteUserPrompt } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { withDb } from "@/lib/db/bootstrap";
import { buildSystemPrompt, loadVoiceContext } from "@/lib/services/voice";

export const runtime = "nodejs";

const BodySchema = z.object({
  body: z.string().min(1).max(4000),
  kind: z
    .enum(["single", "thread", "hot_take", "educational", "question", "listicle"])
    .default("single"),
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
      const voice = loadVoiceContext();
      const result = await chatJson({
        system: buildSystemPrompt(voice),
        user: rewriteUserPrompt({ body: body.body, kind: body.kind }),
        schema: DraftResultSchema,
        temperature: 0.7,
        maxTokens: 1024,
      });
      return NextResponse.json({ draft: result });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error("ai/rewrite", e);
    return NextResponse.json(
      { error: "AI_FAILED", message: (e as Error).message },
      { status: 500 }
    );
  }
}
