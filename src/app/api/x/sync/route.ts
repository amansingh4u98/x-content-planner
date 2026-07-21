import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { cachedTweets, voiceProfiles, xAccounts } from "@/lib/db/schema";
import { fetchUserTweets, getValidAccessToken } from "@/lib/x/client";
import { rebuildVoiceFromCache } from "@/lib/services/voice";
import { nowDate } from "@/lib/utils";
import { isAiConfigured } from "@/lib/ai/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";

  return withDb(async () => {
    const db = getDb();
    const account = db.select().from(xAccounts).all()[0];
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "X_NOT_CONNECTED", tweetsStored: 0, partial: false },
        { status: 400 }
      );
    }

    // debounce 15 min unless force
    if (
      !force &&
      account.lastSyncAt &&
      Date.now() - account.lastSyncAt.getTime() < 15 * 60 * 1000
    ) {
      return NextResponse.json({
        ok: true,
        tweetsStored: 0,
        partial: false,
        skipped: true,
        message: "Synced recently; pass ?force=1 to override",
      });
    }

    db.update(xAccounts)
      .set({ lastSyncAttemptAt: nowDate() })
      .where(eq(xAccounts.id, account.id))
      .run();

    try {
      const token = await getValidAccessToken(account.id);
      const { tweets, partial, nextRetryAt } = await fetchUserTweets({
        accessToken: token,
        userId: account.xUserId,
      });

      for (const t of tweets) {
        db.insert(cachedTweets)
          .values({
            id: t.id,
            xAccountId: account.id,
            text: t.text,
            createdAtX: t.createdAt,
            metricsJson: t.metricsJson,
          })
          .onConflictDoUpdate({
            target: cachedTweets.id,
            set: {
              text: t.text,
              createdAtX: t.createdAt,
              metricsJson: t.metricsJson,
            },
          })
          .run();
      }

      db.update(xAccounts)
        .set({
          lastSyncAt: partial ? account.lastSyncAt : nowDate(),
          syncStateJson: JSON.stringify(
            partial
              ? { status: "partial", nextRetryAt, count: tweets.length }
              : { status: "ok", count: tweets.length }
          ),
        })
        .where(eq(xAccounts.id, account.id))
        .run();

      // first successful sync with enough tweets → auto voice rebuild once
      let voiceRebuildTriggered = false;
      const voice = db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
        .get();
      const neverRebuilt = !voice?.rebuiltAt;
      if (
        !partial &&
        tweets.length >= 5 &&
        neverRebuilt &&
        isAiConfigured()
      ) {
        const r = await rebuildVoiceFromCache();
        voiceRebuildTriggered = r.ok;
      }

      return NextResponse.json({
        ok: true,
        tweetsStored: tweets.length,
        partial,
        nextRetryAt,
        voiceRebuildTriggered,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "X_TIER_FORBIDDEN" || msg === "X_REFRESH_FAILED") {
        return NextResponse.json(
          {
            ok: false,
            error: msg,
            tweetsStored: 0,
            partial: false,
          },
          { status: msg === "X_TIER_FORBIDDEN" ? 403 : 401 }
        );
      }
      console.error("x/sync", e);
      return NextResponse.json(
        {
          ok: false,
          error: "X_SYNC_FAILED",
          message: msg,
          tweetsStored: 0,
          partial: false,
        },
        { status: 500 }
      );
    }
  });
}
