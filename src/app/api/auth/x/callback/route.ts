import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { config } from "@/lib/config";
import { encryptToken } from "@/lib/crypto/tokens";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { xAccounts } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { fetchMe } from "@/lib/x/client";
import { exchangeCode } from "@/lib/x/oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const err = sp.get("error");
  if (err === "access_denied") {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=access_denied", config.appUrl)
    );
  }
  if (err) {
    return NextResponse.redirect(
      new URL(`/settings?oauth_error=${encodeURIComponent(err)}`, config.appUrl)
    );
  }

  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;
  const verifier = req.cookies.get("oauth_code_verifier")?.value;

  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=state_mismatch", config.appUrl)
    );
  }

  try {
    const tokens = await exchangeCode({ code, verifier });
    const me = await fetchMe(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await withDb(async () => {
      const db = getDb();
      // single account MVP: clear previous
      const existing = db.select().from(xAccounts).all();
      for (const row of existing) {
        db.delete(xAccounts).where(eq(xAccounts.id, row.id)).run();
      }
      db.insert(xAccounts)
        .values({
          id: newId(),
          profileId: DEFAULT_PROFILE_ID,
          xUserId: me.id,
          username: me.username,
          name: me.name,
          bio: me.description ?? "",
          accessTokenEnc: encryptToken(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token
            ? encryptToken(tokens.refresh_token)
            : null,
          tokenExpiresAt: expiresAt,
          scopes: tokens.scope ?? "",
        })
        .run();
    });

    const res = NextResponse.redirect(
      new URL("/settings?oauth=connected", config.appUrl)
    );
    res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    res.cookies.set("oauth_code_verifier", "", { maxAge: 0, path: "/" });
    res.cookies.set("oauth_intent", "", { maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    console.error("oauth callback", e);
    return NextResponse.redirect(
      new URL("/settings?oauth_error=exchange_failed", config.appUrl)
    );
  }
}
