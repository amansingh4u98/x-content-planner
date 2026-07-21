import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems, contentVariants } from "@/lib/db/schema";
import {
  applyStatusTransition,
  PostStatusSchema,
  type PostStatus,
} from "@/lib/posts/transitions";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
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
    const variants = db
      .select()
      .from(contentVariants)
      .where(eq(contentVariants.contentItemId, id))
      .all();
    return NextResponse.json({ post, variants });
  });
}

const PatchSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional(),
  topicId: z.string().optional().nullable(),
  status: PostStatusSchema.optional(),
  format: z.string().optional(),
  thread: z.array(z.string()).optional().nullable(),
  citations: z
    .array(z.object({ url: z.string(), label: z.string().optional() }))
    .optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
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
      const post = db
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .get();
      if (!post) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }

      let status = post.status as PostStatus;
      let scheduledFor = post.scheduledFor;
      let postedAt = post.postedAt;

      if (body.scheduledFor !== undefined) {
        scheduledFor =
          body.scheduledFor === null ? null : new Date(body.scheduledFor);
      }

      if (body.status && body.status !== post.status) {
        const result = applyStatusTransition({
          from: post.status as PostStatus,
          to: body.status,
          scheduledFor:
            body.scheduledFor !== undefined
              ? scheduledFor
              : post.scheduledFor,
          postedAt: post.postedAt,
        });
        if (!result.ok) {
          return NextResponse.json(
            { error: result.code, message: result.error },
            { status: 400 }
          );
        }
        status = result.status;
        scheduledFor = result.scheduledFor;
        postedAt = result.postedAt;
      } else if (status === "scheduled" && !scheduledFor) {
        return NextResponse.json(
          {
            error: "SCHEDULE_DATE_REQUIRED",
            message: "scheduled status requires scheduledFor",
          },
          { status: 400 }
        );
      }

      db.update(contentItems)
        .set({
          title: body.title !== undefined ? body.title : post.title,
          body: body.body ?? post.body,
          topicId: body.topicId !== undefined ? body.topicId : post.topicId,
          status,
          format: body.format ?? post.format,
          threadJson:
            body.thread !== undefined
              ? body.thread
                ? JSON.stringify(body.thread)
                : null
              : post.threadJson,
          citationsJson:
            body.citations !== undefined
              ? JSON.stringify(body.citations)
              : post.citationsJson,
          scheduledFor,
          postedAt,
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
    const post = db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .get();
    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    db.delete(contentVariants)
      .where(eq(contentVariants.contentItemId, id))
      .run();
    db.delete(contentItems).where(eq(contentItems.id, id)).run();
    return NextResponse.json({ ok: true });
  });
}
