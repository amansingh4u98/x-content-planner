import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { topics } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { nowDate, slugify } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  return withDb(() => {
    const rows = getDb()
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.profileId, DEFAULT_PROFILE_ID),
          isNull(topics.archivedAt)
        )
      )
      .all()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return NextResponse.json({ topics: rows });
  });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  angles: z.array(z.string()).optional(),
  color: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    return withDb(() => {
      const db = getDb();
      const slug = body.slug ? slugify(body.slug) : slugify(body.name);
      const existing = db
        .select()
        .from(topics)
        .where(
          and(
            eq(topics.profileId, DEFAULT_PROFILE_ID),
            eq(topics.slug, slug)
          )
        )
        .get();
      if (existing && !existing.archivedAt) {
        return NextResponse.json(
          { error: "SLUG_CONFLICT", message: "Topic slug already exists" },
          { status: 409 }
        );
      }
      const now = nowDate();
      const id = newId();
      db.insert(topics)
        .values({
          id,
          profileId: DEFAULT_PROFILE_ID,
          name: body.name,
          slug,
          description: body.description ?? "",
          notes: body.notes ?? "",
          anglesJson: JSON.stringify(body.angles ?? []),
          color: body.color ?? "#64748b",
          sortOrder: 99,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      const row = db.select().from(topics).where(eq(topics.id, id)).get();
      return NextResponse.json({ topic: row }, { status: 201 });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
