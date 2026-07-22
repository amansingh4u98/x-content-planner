import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  aiErrorJson,
  chatJson,
  DraftResultSchema,
  isAiConfigured,
} from "@/lib/ai/client";
import { draftUserPrompt } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems, researchBriefs, topics } from "@/lib/db/schema";
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
  researchBriefId: z.string().optional(),
  /** Live form notes (preferred over DB when provided). */
  notes: z.string().max(8000).optional(),
  /** Live form angles (preferred over DB when provided). */
  angles: z.array(z.string().max(500)).max(30).optional(),
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
      let dbAngles: string[] = [];
      try {
        const parsed = JSON.parse(topic.anglesJson ?? "[]");
        dbAngles = Array.isArray(parsed)
          ? parsed.filter((x): x is string => typeof x === "string")
          : [];
      } catch {
        dbAngles = [];
      }
      const angles = body.angles !== undefined ? body.angles : dbAngles;
      const notes =
        body.notes !== undefined ? body.notes : (topic.notes ?? "");

      const voice = loadVoiceContext();
      const research = body.researchBriefId
        ? db.select().from(researchBriefs).where(eq(researchBriefs.id, body.researchBriefId)).get()
        : null;
      if (body.researchBriefId && (!research || research.topicId !== topic.id)) {
        return NextResponse.json({ error: "RESEARCH_BRIEF_NOT_FOUND" }, { status: 404 });
      }
      const result = await chatJson({
        system: buildSystemPrompt(voice),
        user: `${draftUserPrompt({
          topicName: topic.name,
          topicNotes: notes,
          idea: body.idea,
          format: body.format,
          angles,
        })}${research ? `\n\nCurrent research brief (treat claims carefully and retain source URLs where useful):\n${research.summary}` : ""}`,
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
            citationsJson: research?.citationsJson ?? "[]",
            metaJson: JSON.stringify({ notes: result.notes ?? "", researchBriefId: research?.id ?? null }),
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
    const { body, status } = aiErrorJson(e);
    return NextResponse.json(body, { status });
  }
}
