import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { PostStatusSchema } from "@/lib/posts/transitions";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const topicId = sp.get("topicId");
  const from = sp.get("scheduledFrom");
  const to = sp.get("scheduledTo");
  const includeArchived = sp.get("includeArchived") === "1";

  return withDb(() => {
    let rows = getDb()
      .select()
      .from(contentItems)
      .where(eq(contentItems.profileId, DEFAULT_PROFILE_ID))
      .all();

    if (!includeArchived) {
      rows = rows.filter((r) => r.status !== "archived");
    }
    if (status) {
      rows = rows.filter((r) => r.status === status);
    }
    if (topicId) {
      rows = rows.filter((r) => r.topicId === topicId);
    }
    if (from) {
      const d = new Date(from);
      rows = rows.filter(
        (r) => r.scheduledFor && r.scheduledFor >= d
      );
    }
    if (to) {
      const d = new Date(to);
      rows = rows.filter(
        (r) => r.scheduledFor && r.scheduledFor <= d
      );
    }

    rows.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    return NextResponse.json({ posts: rows });
  });
}

const CreateSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(10000).optional(),
  topicId: z.string().optional().nullable(),
  status: PostStatusSchema.optional(),
  format: z.string().optional(),
  thread: z.array(z.string()).optional(),
  citations: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),
  source: z.enum(["manual", "ai"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    return withDb(() => {
      const db = getDb();
      const now = nowDate();
      const id = newId();
      const status = body.status ?? "idea";
      db.insert(contentItems)
        .values({
          id,
          profileId: DEFAULT_PROFILE_ID,
          topicId: body.topicId ?? null,
          status,
          title: body.title ?? null,
          body: body.body ?? "",
          threadJson: body.thread ? JSON.stringify(body.thread) : null,
          citationsJson: JSON.stringify(body.citations ?? []),
          format: body.format ?? "single",
          source: body.source ?? "manual",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      const row = db
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .get();
      return NextResponse.json({ post: row }, { status: 201 });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
