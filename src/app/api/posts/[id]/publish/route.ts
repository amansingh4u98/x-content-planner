import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withDb } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { contentItems, xAccounts } from "@/lib/db/schema";
import { applyStatusTransition, type PostStatus } from "@/lib/posts/transitions";
import { canPostFromScopes, createPost, getValidAccessToken } from "@/lib/x/client";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withDb(async () => {
    const db = getDb();
    const post = db.select().from(contentItems).where(eq(contentItems.id, id)).get();
    if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (post.status === "posted" || post.xPostId) return NextResponse.json({ error: "X_ALREADY_POSTED" }, { status: 409 });
    if (post.threadJson) return NextResponse.json({ error: "X_THREAD_PUBLISH_NOT_SUPPORTED" }, { status: 400 });
    if (!post.body.trim()) return NextResponse.json({ error: "X_POST_EMPTY" }, { status: 400 });

    const account = db.select().from(xAccounts).all()[0];
    if (!account) return NextResponse.json({ error: "X_NOT_CONNECTED" }, { status: 401 });
    if (!canPostFromScopes(account.scopes)) return NextResponse.json({ error: "X_POST_NOT_AUTHORIZED" }, { status: 403 });
    try {
      const token = await getValidAccessToken(account.id);
      const created = await createPost({ accessToken: token, text: post.body });
      const transition = applyStatusTransition({ from: post.status as PostStatus, to: "posted", scheduledFor: post.scheduledFor, postedAt: nowDate() });
      if (!transition.ok) return NextResponse.json({ error: transition.code, message: transition.error }, { status: 400 });
      db.update(contentItems).set({ status: "posted", postedAt: transition.postedAt, xPostId: created.id, updatedAt: nowDate() }).where(eq(contentItems.id, id)).run();
      const updated = db.select().from(contentItems).where(eq(contentItems.id, id)).get();
      return NextResponse.json({ post: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : "X publish failed";
      const status = message === "X_UNAUTHORIZED" ? 401 : message.includes("RATE_LIMIT") ? 429 : message.includes("FORBIDDEN") ? 403 : 502;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
