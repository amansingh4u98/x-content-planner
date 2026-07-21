import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  __xplannerSqlite?: Database.Database;
  __xplannerDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function openSqlite(): Database.Database {
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(config.dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export function getSqlite(): Database.Database {
  if (!globalForDb.__xplannerSqlite) {
    globalForDb.__xplannerSqlite = openSqlite();
  }
  return globalForDb.__xplannerSqlite;
}

export function getDb() {
  if (!globalForDb.__xplannerDb) {
    globalForDb.__xplannerDb = drizzle(getSqlite(), { schema });
  }
  return globalForDb.__xplannerDb;
}

/** Create tables if missing (MVP bootstrap without separate migrate step). */
export function ensureSchema(): void {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      preferences_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS x_accounts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      x_user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      name TEXT,
      bio TEXT,
      access_token_enc BLOB NOT NULL,
      refresh_token_enc BLOB,
      token_expires_at INTEGER,
      scopes TEXT NOT NULL DEFAULT '',
      last_sync_at INTEGER,
      last_sync_attempt_at INTEGER,
      sync_state_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL DEFAULT '',
      style_notes TEXT,
      few_shot_json TEXT NOT NULL DEFAULT '[]',
      model_used TEXT,
      rebuilt_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS cached_tweets (
      id TEXT PRIMARY KEY,
      x_account_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at_x INTEGER,
      metrics_json TEXT,
      raw_json TEXT
    );
    CREATE INDEX IF NOT EXISTS cached_tweets_account_idx ON cached_tweets(x_account_id);

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      angles_json TEXT DEFAULT '[]',
      notes TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS topics_profile_slug_uidx ON topics(profile_id, slug);

    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      topic_id TEXT,
      status TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL DEFAULT '',
      thread_json TEXT,
      citations_json TEXT DEFAULT '[]',
      format TEXT DEFAULT 'single',
      scheduled_for INTEGER,
      posted_at INTEGER,
      x_post_id TEXT,
      source TEXT DEFAULT 'manual',
      meta_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS content_status_idx ON content_items(profile_id, status);
    CREATE INDEX IF NOT EXISTS content_topic_idx ON content_items(profile_id, topic_id);
    CREATE INDEX IF NOT EXISTS content_sched_idx ON content_items(profile_id, scheduled_for);

    CREATE TABLE IF NOT EXISTS content_variants (
      id TEXT PRIMARY KEY,
      content_item_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      thread_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS variants_content_idx ON content_variants(content_item_id);
  `);
}
