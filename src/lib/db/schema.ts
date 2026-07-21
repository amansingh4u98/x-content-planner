import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  blob,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const xAccounts = sqliteTable("x_accounts", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  xUserId: text("x_user_id").notNull(),
  username: text("username").notNull(),
  name: text("name"),
  bio: text("bio"),
  accessTokenEnc: blob("access_token_enc", { mode: "buffer" }).notNull(),
  refreshTokenEnc: blob("refresh_token_enc", { mode: "buffer" }),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }),
  scopes: text("scopes").notNull().default(""),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  lastSyncAttemptAt: integer("last_sync_attempt_at", { mode: "timestamp" }),
  syncStateJson: text("sync_state_json").default("{}"),
});

export const voiceProfiles = sqliteTable("voice_profiles", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().unique(),
  summary: text("summary").notNull().default(""),
  styleNotes: text("style_notes"),
  fewShotJson: text("few_shot_json").notNull().default("[]"),
  modelUsed: text("model_used"),
  rebuiltAt: integer("rebuilt_at", { mode: "timestamp" }),
});

export const cachedTweets = sqliteTable(
  "cached_tweets",
  {
    id: text("id").primaryKey(),
    xAccountId: text("x_account_id").notNull(),
    text: text("text").notNull(),
    createdAtX: integer("created_at_x", { mode: "timestamp" }),
    metricsJson: text("metrics_json"),
    rawJson: text("raw_json"),
  },
  (t) => [index("cached_tweets_account_idx").on(t.xAccountId)]
);

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    anglesJson: text("angles_json").default("[]"),
    notes: text("notes"),
    color: text("color"),
    sortOrder: integer("sort_order").default(0),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("topics_profile_slug_uidx").on(t.profileId, t.slug)]
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    topicId: text("topic_id"),
    status: text("status").notNull(),
    title: text("title"),
    body: text("body").notNull().default(""),
    threadJson: text("thread_json"),
    citationsJson: text("citations_json").default("[]"),
    format: text("format").default("single"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    xPostId: text("x_post_id"),
    source: text("source").default("manual"),
    metaJson: text("meta_json").default("{}"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("content_status_idx").on(t.profileId, t.status),
    index("content_topic_idx").on(t.profileId, t.topicId),
    index("content_sched_idx").on(t.profileId, t.scheduledFor),
  ]
);

export const contentVariants = sqliteTable(
  "content_variants",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    threadJson: text("thread_json"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("variants_content_idx").on(t.contentItemId)]
);
