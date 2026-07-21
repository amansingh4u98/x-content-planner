import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { topics } from "@/lib/db/schema";
import { nowDate, slugify } from "@/lib/utils";

export const runtime = "nodejs";

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  angles: z.array(z.string()).optional(),
  color: z.string().max(32).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const body = PatchSchema.parse(await req.json());
    return withDb(() => {
      const db = getDb();
      const row = db.select().from(topics).where(eq(topics.id, id)).get();
      if (!row) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      db.update(topics)
        .set({
          name: body.name ?? row.name,
          slug: body.slug ? slugify(body.slug) : row.slug,
          description: body.description ?? row.description,
          notes: body.notes ?? row.notes,
          anglesJson:
            body.angles !== undefined
              ? JSON.stringify(body.angles)
              : row.anglesJson,
          color: body.color ?? row.color,
          sortOrder: body.sortOrder ?? row.sortOrder,
          updatedAt: nowDate(),
        })
        .where(eq(topics.id, id))
        .run();
      const updated = db.select().from(topics).where(eq(topics.id, id)).get();
      return NextResponse.json({ topic: updated });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withDb(() => {
    const db = getDb();
    const row = db.select().from(topics).where(eq(topics.id, id)).get();
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    db.update(topics)
      .set({ archivedAt: nowDate(), updatedAt: nowDate() })
      .where(eq(topics.id, id))
      .run();
    return NextResponse.json({ ok: true });
  });
}
