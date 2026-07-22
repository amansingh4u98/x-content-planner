import { eq } from "drizzle-orm";
import { config } from "@/lib/config";
import { canEncrypt, decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { getDb } from "@/lib/db/client";
import { xAccounts } from "@/lib/db/schema";
import { refreshAccessToken } from "@/lib/x/oauth";

const API = "https://api.twitter.com/2";

type MeResponse = {
  data: {
    id: string;
    name: string;
    username: string;
    description?: string;
    location?: string;
    profile_image_url?: string;
  };
};

type TweetsResponse = {
  data?: Array<{
    id: string;
    text: string;
    created_at?: string;
    public_metrics?: Record<string, number>;
  }>;
  meta?: {
    result_count?: number;
    next_token?: string;
  };
  errors?: unknown;
};

const refreshLocks = new Map<string, Promise<string>>();

export async function getValidAccessToken(accountId: string): Promise<string> {
  if (!canEncrypt()) {
    throw new Error("TOKEN_ENCRYPTION_KEY required for X API calls");
  }
  const db = getDb();
  const account = db
    .select()
    .from(xAccounts)
    .where(eq(xAccounts.id, accountId))
    .get();
  if (!account) throw new Error("X_NOT_CONNECTED");

  const expires = account.tokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expires - Date.now() < 60_000;

  if (!needsRefresh) {
    return decryptToken(Buffer.from(account.accessTokenEnc));
  }

  if (!account.refreshTokenEnc) {
    throw new Error("X_REFRESH_FAILED");
  }

  let lock = refreshLocks.get(accountId);
  if (!lock) {
    lock = (async () => {
      try {
        const refresh = decryptToken(Buffer.from(account.refreshTokenEnc!));
        const tokens = await refreshAccessToken(refresh);
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null;
        db.update(xAccounts)
          .set({
            accessTokenEnc: encryptToken(tokens.access_token),
            refreshTokenEnc: tokens.refresh_token
              ? encryptToken(tokens.refresh_token)
              : account.refreshTokenEnc,
            tokenExpiresAt: expiresAt ?? account.tokenExpiresAt,
            scopes: tokens.scope ?? account.scopes,
          })
          .where(eq(xAccounts.id, accountId))
          .run();
        return tokens.access_token;
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        if (code === "invalid_grant") {
          db.delete(xAccounts).where(eq(xAccounts.id, accountId)).run();
          throw new Error("X_REFRESH_FAILED");
        }
        throw e;
      } finally {
        refreshLocks.delete(accountId);
      }
    })();
    refreshLocks.set(accountId, lock);
  }
  return lock;
}

export async function fetchMe(accessToken: string): Promise<MeResponse["data"]> {
  const url = new URL(`${API}/users/me`);
  url.searchParams.set(
    "user.fields",
    "id,name,username,description,location,profile_image_url,created_at,public_metrics"
  );
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) throw new Error("X_TIER_FORBIDDEN");
  if (res.status === 401) throw new Error("X_UNAUTHORIZED");
  if (!res.ok) throw new Error(`X users/me failed: ${res.status}`);
  const json = (await res.json()) as MeResponse;
  return json.data;
}

export async function fetchUserTweets(opts: {
  accessToken: string;
  userId: string;
  maxPages?: number;
  onPartial?: (info: { pages: number; count: number; reset?: string }) => void;
}): Promise<{
  tweets: Array<{
    id: string;
    text: string;
    createdAt?: Date;
    metricsJson?: string;
  }>;
  partial: boolean;
  nextRetryAt?: string;
}> {
  const maxPages = opts.maxPages ?? 2;
  const tweets: Array<{
    id: string;
    text: string;
    createdAt?: Date;
    metricsJson?: string;
  }> = [];
  let paginationToken: string | undefined;
  let partial = false;
  let nextRetryAt: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${API}/users/${opts.userId}/tweets`);
    url.searchParams.set("max_results", "50");
    url.searchParams.set("exclude", "retweets,replies");
    url.searchParams.set(
      "tweet.fields",
      "created_at,public_metrics,lang,possibly_sensitive"
    );
    if (paginationToken) {
      url.searchParams.set("pagination_token", paginationToken);
    }

    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });

    if (res.status === 429) {
      const reset = res.headers.get("x-rate-limit-reset");
      nextRetryAt = reset
        ? new Date(Number(reset) * 1000).toISOString()
        : new Date(Date.now() + 60_000).toISOString();
      partial = true;
      opts.onPartial?.({ pages: page, count: tweets.length, reset: nextRetryAt });
      break;
    }
    if (res.status === 403) throw new Error("X_TIER_FORBIDDEN");
    if (res.status === 401) throw new Error("X_UNAUTHORIZED");
    if (!res.ok) throw new Error(`X timeline failed: ${res.status}`);

    const json = (await res.json()) as TweetsResponse;
    for (const t of json.data ?? []) {
      tweets.push({
        id: t.id,
        text: t.text,
        createdAt: t.created_at ? new Date(t.created_at) : undefined,
        metricsJson: t.public_metrics
          ? JSON.stringify(t.public_metrics)
          : undefined,
      });
    }
    paginationToken = json.meta?.next_token;
    if (!paginationToken) break;
  }

  return { tweets, partial, nextRetryAt };
}

export function canPostFromScopes(scopes: string): boolean {
  const set = new Set(scopes.split(/\s+/).filter(Boolean));
  return config.enableXPosting && set.has("tweet.write");
}

export async function createPost(opts: { accessToken: string; text: string }): Promise<{ id: string }> {
  const res = await fetch(`${API}/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: opts.text }),
  });
  if (res.status === 403) throw new Error("X_POST_FORBIDDEN");
  if (res.status === 401) throw new Error("X_UNAUTHORIZED");
  if (res.status === 429) throw new Error("X_POST_RATE_LIMITED");
  if (!res.ok) throw new Error(`X post failed: ${res.status}`);
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) throw new Error("X_POST_FAILED");
  return { id: json.data.id };
}
