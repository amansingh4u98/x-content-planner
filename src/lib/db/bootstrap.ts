import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/lib/db/client";
import {
  profiles,
  topics,
  voiceProfiles,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { nowDate } from "@/lib/utils";

export const DEFAULT_PROFILE_ID = "default";

const SEED_TOPICS = [
  {
    name: "AI",
    slug: "ai",
    description: "AI models, product AI, evals, agents",
    color: "#8b5cf6",
    angles: ["practical evals", "shipping LLM features", "tooling"],
  },
  {
    name: "Software Engineering",
    slug: "software-engineering",
    description: "Architecture, DX, systems, craft",
    color: "#3b82f6",
    angles: ["deep modules", "debugging", "shipping"],
  },
  {
    name: "Cricket",
    slug: "cricket",
    description: "Matches, tactics, player form",
    color: "#22c55e",
    angles: ["match reaction", "tactics", "stats"],
  },
  {
    name: "Football",
    slug: "football",
    description: "Football (soccer) news and analysis",
    color: "#f59e0b",
    angles: ["tactics", "transfer talk", "match takes"],
  },
];

export function bootstrapDb(): void {
  ensureSchema();
  const db = getDb();
  const now = nowDate();

  const existing = db
    .select()
    .from(profiles)
    .where(eq(profiles.id, DEFAULT_PROFILE_ID))
    .get();

  if (!existing) {
    db.insert(profiles)
      .values({
        id: DEFAULT_PROFILE_ID,
        displayName: "Aman",
        preferencesJson: JSON.stringify({
          defaultCharLimit: 280,
          emoji: "sparingly",
          hashtags: "rare",
          toneOverrides: ["technical but accessible", "dry humor ok"],
          avoid: ["engagement bait", "excessive emojis", "corporate buzzwords"],
          defaultTopics: SEED_TOPICS.map((t) => t.slug),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  const voice = db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
    .get();

  if (!voice) {
    db.insert(voiceProfiles)
      .values({
        id: newId(),
        profileId: DEFAULT_PROFILE_ID,
        summary: "",
        styleNotes: "",
        fewShotJson: "[]",
      })
      .run();
  }

  const topicCount = db
    .select()
    .from(topics)
    .where(eq(topics.profileId, DEFAULT_PROFILE_ID))
    .all().length;

  if (topicCount === 0) {
    SEED_TOPICS.forEach((t, i) => {
      db.insert(topics)
        .values({
          id: newId(),
          profileId: DEFAULT_PROFILE_ID,
          name: t.name,
          slug: t.slug,
          description: t.description,
          anglesJson: JSON.stringify(t.angles),
          notes: "",
          color: t.color,
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });
  }
}

export function withDb<T>(fn: () => T): T {
  bootstrapDb();
  return fn();
}
