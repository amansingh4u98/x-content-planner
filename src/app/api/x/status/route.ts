import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { voiceProfiles, xAccounts } from "@/lib/db/schema";
import { canPostFromScopes } from "@/lib/x/client";

export const runtime = "nodejs";

export async function GET() {
  return withDb(() => {
    const db = getDb();
    const account = db.select().from(xAccounts).all()[0];
    const voice = db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
      .get();

    if (!account) {
      return NextResponse.json({
        connected: false,
        canPost: false,
        voice: {
          summary: voice?.summary ?? "",
          styleNotes: voice?.styleNotes ?? "",
          rebuiltAt: voice?.rebuiltAt ?? null,
        },
      });
    }

    let partialSync = false;
    try {
      const st = JSON.parse(account.syncStateJson ?? "{}");
      partialSync = st.status === "partial";
    } catch {
      partialSync = false;
    }

    return NextResponse.json({
      connected: true,
      username: account.username,
      name: account.name,
      scopes: account.scopes.split(/\s+/).filter(Boolean),
      canPost: canPostFromScopes(account.scopes),
      lastSyncAt: account.lastSyncAt,
      lastSyncAttemptAt: account.lastSyncAttemptAt,
      partialSync,
      voice: {
        summary: voice?.summary ?? "",
        styleNotes: voice?.styleNotes ?? "",
        rebuiltAt: voice?.rebuiltAt ?? null,
      },
    });
  });
}
