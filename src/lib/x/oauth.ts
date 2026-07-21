import { createHash, randomBytes } from "node:crypto";
import { config } from "@/lib/config";

const X_AUTH = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN = "https://api.twitter.com/2/oauth2/token";
const X_REVOKE = "https://api.twitter.com/2/oauth2/revoke";

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(opts: {
  state: string;
  challenge: string;
  intent: "read" | "posting";
}): string {
  const scopes =
    opts.intent === "posting"
      ? config.x.scopesPosting
      : config.x.scopesRead;
  const redirectUri = `${config.appUrl}${config.x.callbackPath}`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.x.clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTH}?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  verifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}> {
  const redirectUri = `${config.appUrl}${config.x.callbackPath}`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: redirectUri,
    code_verifier: opts.verifier,
    client_id: config.x.clientId,
  });

  const basic = Buffer.from(
    `${config.x.clientId}:${config.x.clientSecret}`
  ).toString("base64");

  const res = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.x.clientId,
  });
  const basic = Buffer.from(
    `${config.x.clientId}:${config.x.clientSecret}`
  ).toString("base64");

  const res = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Refresh failed: ${res.status} ${text}`);
    (err as Error & { code?: string }).code =
      res.status === 400 ? "invalid_grant" : "refresh_failed";
    throw err;
  }
  return res.json();
}

export async function revokeToken(token: string): Promise<void> {
  try {
    const body = new URLSearchParams({
      token,
      client_id: config.x.clientId,
    });
    const basic = Buffer.from(
      `${config.x.clientId}:${config.x.clientSecret}`
    ).toString("base64");
    await fetch(X_REVOKE, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body,
    });
  } catch {
    // best-effort
  }
}

export function oauthCookieOptions(maxAge = 600) {
  const secure = config.appUrl.startsWith("https");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure,
  };
}
