import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  chatJson,
  DraftResultSchema,
  isAiConfigured,
} from "@/lib/ai/client";
import { draftUserPrompt } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems, topics } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { buildSystemPrompt, loadVoiceContext } from "@/lib/services/voice";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

const BodySchema = z.object({
  topicId: z.string(),
  idea: z.string().min(1).max(1000),
  format: z
    .enum(["single", "thread", "hot_take", "educational", "question", "listicle"])
    .default("single"),
  save: z.boolean().default(true),
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
      const db = getDb();
      const topic = db
        .select()
        .from(topics)
        .where(eq(topics.id, body.topicId))
        .get();
      if (!topic) {
        return NextResponse.json({ error: "TOPIC_NOT_FOUND" }, { status: 404 });
      }
      let angles: string[] = [];
      try {
        angles = JSON.parse(topic.anglesJson ?? "[]");
      } catch {
        angles = [];
      }

      const voice = loadVoiceContext();
      const result = await chatJson({
        system: buildSystemPrompt(voice),
        user: draftUserPrompt({
          topicName: topic.name,
          topicNotes: topic.notes ?? "",
          idea: body.idea,
          format: body.format,
          angles,
        }),
        schema: DraftResultSchema,
        temperature: 0.7,
        maxTokens: body.format === "thread" ? 2048 : 1024,
      });

      let post = null;
      if (body.save) {
        const id = newId();
        const now = nowDate();
        const thread =
          result.thread && result.thread.length > 0 ? result.thread : null;
        db.insert(contentItems)
          .values({
            id,
            profileId: DEFAULT_PROFILE_ID,
            topicId: topic.id,
            status: "drafting",
            title: body.idea.slice(0, 120),
            body: result.body,
            threadJson: thread ? JSON.stringify(thread) : null,
            format: body.format,
            source: "ai",
            metaJson: JSON.stringify({ notes: result.notes ?? "" }),
            createdAt: now,
            updatedAt: now,
          })
          .run();
        post = db
          .select()
          .from(contentItems)
          .where(eq(contentItems.id, id))
          .get();
      }

      return NextResponse.json({ draft: result, post });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error("ai/draft", e);
    return NextResponse.json(
      { error: "AI_FAILED", message: (e as Error).message },
      { status: 500 }
    );
  }
}
