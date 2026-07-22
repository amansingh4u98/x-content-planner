import path from "node:path";

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const config = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  dataDir: process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
  get dbPath() {
    return process.env.DATABASE_PATH ?? path.join(this.dataDir, "planner.db");
  },
  enableXSync: envBool("ENABLE_X_SYNC", false),
  enableXPosting: envBool("ENABLE_X_POSTING", false),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  xai: {
    apiKey: process.env.XAI_API_KEY ?? "",
    baseUrl: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    model: process.env.XAI_MODEL ?? "grok-4.5",
    timeoutMs: Number(process.env.XAI_TIMEOUT_MS ?? 20_000),
    researchTimeoutMs: Number(process.env.XAI_RESEARCH_TIMEOUT_MS ?? 90_000),
  },
  x: {
    clientId: process.env.X_CLIENT_ID ?? "",
    clientSecret: process.env.X_CLIENT_SECRET ?? "",
    scopesRead:
      process.env.X_SCOPES_READ ?? "tweet.read users.read offline.access",
    scopesPosting:
      process.env.X_SCOPES_POSTING ??
      "tweet.read users.read offline.access tweet.write",
    callbackPath: "/api/auth/x/callback",
  },
  defaultCharLimit: Number(process.env.DEFAULT_CHAR_LIMIT ?? 280),
  aiRateLimit: {
    maxRequests: 20,
    windowMs: 5 * 60 * 1000,
  },
};

export function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

export function requireTokenKeyIfSyncEnabled(): void {
  if (config.enableXSync && !config.tokenEncryptionKey) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required when ENABLE_X_SYNC=true. Generate with: openssl rand -base64 32"
    );
  }
}
