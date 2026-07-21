import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import {
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  oauthCookieOptions,
} from "@/lib/x/oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!config.x.clientId || !config.x.clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=x_not_configured", config.appUrl)
    );
  }
  if (!config.tokenEncryptionKey) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=missing_encryption_key", config.appUrl)
    );
  }

  const intent =
    req.nextUrl.searchParams.get("intent") === "posting"
      ? "posting"
      : "read";
  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const url = buildAuthorizeUrl({ state, challenge, intent });

  const res = NextResponse.redirect(url);
  const cookieOpts = oauthCookieOptions(600);
  res.cookies.set("oauth_state", state, cookieOpts);
  res.cookies.set("oauth_code_verifier", verifier, cookieOpts);
  res.cookies.set("oauth_intent", intent, cookieOpts);
  return res;
}
