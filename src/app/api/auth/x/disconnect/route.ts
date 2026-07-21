import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canEncrypt, decryptToken } from "@/lib/crypto/tokens";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { cachedTweets, voiceProfiles, xAccounts } from "@/lib/db/schema";
import { revokeToken } from "@/lib/x/oauth";

export const runtime = "nodejs";

export async function POST() {
  return withDb(async () => {
    const db = getDb();
    const accounts = db.select().from(xAccounts).all();
    for (const account of accounts) {
      if (canEncrypt()) {
        try {
          const access = decryptToken(Buffer.from(account.accessTokenEnc));
          await revokeToken(access);
        } catch {
          /* best-effort */
        }
      }
      db.delete(cachedTweets)
        .where(eq(cachedTweets.xAccountId, account.id))
        .run();
      db.delete(xAccounts).where(eq(xAccounts.id, account.id)).run();
    }

    // keep voice summary; clear few-shots (tweet bodies)
    const voice = db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
      .get();
    if (voice) {
      db.update(voiceProfiles)
        .set({ fewShotJson: "[]" })
        .where(eq(voiceProfiles.id, voice.id))
        .run();
    }

    return NextResponse.json({ ok: true });
  });
}
