import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems } from "@/lib/db/schema";
import {
  applyStatusTransition,
  type PostStatus,
} from "@/lib/posts/transitions";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

const BodySchema = z.object({
  xPostId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const body = BodySchema.parse(json);

  return withDb(() => {
    const db = getDb();
    const post = db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .get();
    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (post.status === "posted" || post.xPostId) {
      return NextResponse.json(
        { error: "X_ALREADY_POSTED", post },
        { status: 409 }
      );
    }

    const result = applyStatusTransition({
      from: post.status as PostStatus,
      to: "posted",
      scheduledFor: post.scheduledFor,
      postedAt: nowDate(),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.error },
        { status: 400 }
      );
    }

    db.update(contentItems)
      .set({
        status: "posted",
        postedAt: result.postedAt,
        xPostId: body.xPostId ?? post.xPostId,
        updatedAt: nowDate(),
      })
      .where(eq(contentItems.id, id))
      .run();

    const updated = db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .get();
    return NextResponse.json({ post: updated });
  });
}
