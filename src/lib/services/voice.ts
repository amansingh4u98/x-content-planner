import { eq } from "drizzle-orm";
import {
  chatJson,
  isAiConfigured,
  VoiceResultSchema,
} from "@/lib/ai/client";
import {
  buildSystemPrompt,
  voiceRebuildUserPrompt,
  type VoiceContext,
} from "@/lib/ai/prompts";
import { DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import {
  cachedTweets,
  profiles,
  voiceProfiles,
  xAccounts,
} from "@/lib/db/schema";
import { nowDate } from "@/lib/utils";
import { config } from "@/lib/config";

export function loadVoiceContext(): VoiceContext {
  const db = getDb();
  const voice = db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
    .get();
  const account = db.select().from(xAccounts).all()[0];
  const profile = db
    .select()
    .from(profiles)
    .where(eq(profiles.id, DEFAULT_PROFILE_ID))
    .get();

  let fewShots: { id: string; text: string }[] = [];
  try {
    fewShots = JSON.parse(voice?.fewShotJson ?? "[]");
  } catch {
    fewShots = [];
  }

  let preferences: Record<string, unknown> = {};
  try {
    preferences = JSON.parse(profile?.preferencesJson ?? "{}");
  } catch {
    preferences = {};
  }

  return {
    username: account?.username,
    summary: voice?.summary ?? "",
    styleNotes: voice?.styleNotes ?? "",
    fewShots,
    preferences,
  };
}

export async function rebuildVoiceFromCache(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isAiConfigured()) {
    return { ok: false, error: "AI_NOT_CONFIGURED" };
  }
  const db = getDb();
  const account = db.select().from(xAccounts).all()[0];
  const tweets = account
    ? db
        .select()
        .from(cachedTweets)
        .where(eq(cachedTweets.xAccountId, account.id))
        .all()
    : [];

  const result = await chatJson({
    system:
      "You analyze social media writing voice. Return JSON only. Be specific and actionable.",
    user: voiceRebuildUserPrompt({
      bio: account?.bio ?? "",
      tweets: tweets.map((t) => ({ id: t.id, text: t.text })),
    }),
    schema: VoiceResultSchema,
    temperature: 0.3,
    maxTokens: 2048,
  });

  const idToText = new Map(tweets.map((t) => [t.id, t.text]));
  const fewShot = (result.fewShotIds ?? [])
    .map((id) => ({ id, text: idToText.get(id) ?? "" }))
    .filter((x) => x.text)
    .slice(0, 8);

  if (fewShot.length < 3) {
    for (const t of tweets.slice(0, 8)) {
      if (!fewShot.find((f) => f.id === t.id)) {
        fewShot.push({ id: t.id, text: t.text });
      }
      if (fewShot.length >= 8) break;
    }
  }

  const existing = db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
    .get();

  if (existing) {
    db.update(voiceProfiles)
      .set({
        summary: result.summary,
        styleNotes: result.styleNotes ?? existing.styleNotes,
        fewShotJson: JSON.stringify(fewShot),
        modelUsed: config.xai.model,
        rebuiltAt: nowDate(),
      })
      .where(eq(voiceProfiles.id, existing.id))
      .run();
  }

  return { ok: true };
}

export { buildSystemPrompt };
