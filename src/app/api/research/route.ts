import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { aiErrorJson, isAiConfigured } from "@/lib/ai/client";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { researchBriefs, topics } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { createResearchBrief } from "@/lib/research/brief";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

const BodySchema = z.object({
  topicId: z.string(),
  direction: z.string().max(500).optional(),
  /** Live form notes (preferred over DB when provided). */
  notes: z.string().max(8000).optional(),
  /** Live form angles (preferred over DB when provided). */
  angles: z.array(z.string().max(500)).max(30).optional(),
});

function parseAnglesJson(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  try {
    const body = BodySchema.parse(await req.json());
    return await withDb(async () => {
      const db = getDb();
      const topic = db.select().from(topics).where(eq(topics.id, body.topicId)).get();
      if (!topic) return NextResponse.json({ error: "TOPIC_NOT_FOUND" }, { status: 404 });

      const notes =
        body.notes !== undefined ? body.notes : (topic.notes ?? "");
      const angles =
        body.angles !== undefined
          ? body.angles
          : parseAnglesJson(topic.anglesJson);

      const result = await createResearchBrief({
        topic: topic.name,
        direction: body.direction,
        notes,
        angles,
      });

      const queryParts = [
        body.direction?.trim(),
        ...angles.slice(0, 5).map((a) => a.trim()),
      ].filter(Boolean);
      const query =
        queryParts.length > 0
          ? queryParts.join(" · ").slice(0, 500)
          : topic.name;

      const id = newId();
      const now = nowDate();
      db.insert(researchBriefs).values({
        id,
        profileId: DEFAULT_PROFILE_ID,
        topicId: topic.id,
        query,
        summary: result.summary,
        citationsJson: JSON.stringify(result.citations),
        modelUsed: "grok-4.5",
        createdAt: now,
      }).run();
      const brief = db.select().from(researchBriefs).where(eq(researchBriefs.id, id)).get();
      return NextResponse.json({ brief }, { status: 201 });
    });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.flatten() }, { status: 400 });
    const { body, status } = aiErrorJson(e);
    return NextResponse.json(body, { status });
  }
}
