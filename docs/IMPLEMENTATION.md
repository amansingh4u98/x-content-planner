# Current Implementation

**As of:** 2026-07-22  

This document is the source of truth for **what ships today**. Architecture intent and the original PR plan live in [DESIGN.md](./DESIGN.md). User-facing quick start lives in [README.md](../README.md).

---

## Product summary

**X Content Planner** (“Content Studio” in the UI) is a local-first Next.js + SQLite app for planning and shipping X posts in the user’s voice.

| Layer | Stack |
|-------|--------|
| App | Next.js App Router (Node runtime only) |
| UI | React, Tailwind v4, shared primitives in `src/components/ui.tsx` |
| DB | SQLite via `better-sqlite3` + Drizzle schema; bootstrap `CREATE IF NOT EXISTS` |
| AI | xAI Grok (`grok-4.5`): Chat Completions for structured JSON; Responses + `web_search` for research |
| X | OAuth 2.0 PKCE (confidential), encrypted tokens, timeline sync, optional single-tweet publish |

---

## End-to-end workflow

1. **Capture** — Dashboard quick capture or Board **+ Idea**.  
2. **Topic context** — On Topics, set **notes** and **angles** (one per line). Optional seed direction for this run.  
3. **Research (optional)** — **Research latest** calls Grok with web search, **grounded on notes + angles + seed**, stores a brief + citations.  
4. **Ideas** — **Generate ideas** uses the same context (and auto-saves the form first).  
5. **Draft** — Draft from an idea; if a brief is active, its summary and citations attach to the new post.  
6. **Edit / polish** — Post editor: polish, hot take, educational, as thread.  
7. **Pipeline** — Board statuses: `idea → drafting → ready → scheduled | posted` (+ `archived`).  
8. **Ship** — Copy / Open Intent, **Mark posted**, or **Post to X now** (singles only, flag + scopes).

---

## Topic context (notes & angles)

### Problem fixed (2026-07-22)

Research previously searched only the **topic name** (+ optional seed). Ideas used **DB notes only** and **ignored angles**. Form fields that were not yet saved were dropped.

### Current behavior

| Action | Context used |
|--------|----------------|
| Research | `notes`, `angles[]`, `direction` (seed), topic name |
| Generate ideas | `notes`, `angles[]`, `seed`, topic name |
| Draft | `notes`, `angles[]`, idea, format, optional research brief |

**UI (`/topics`):**

- Before Research / Generate ideas / Draft, the page **auto-saves** notes and angles via `PATCH /api/topics/:id`.  
- The same live values are sent in the request body so unsaved typing is never ignored.  
- Helper copy on the form explains this.

**API body extras** (all optional; when omitted, server falls back to DB):

```json
{
  "topicId": "…",
  "direction": "optional seed",
  "notes": "free-form notes",
  "angles": ["angle one", "angle two"]
}
```

Same shape for ideas (`seed` instead of `direction`) and draft (`idea`, `format`, `researchBriefId`, `notes`, `angles`).

**Research prompt rules:**

- Must not treat the run as a generic overview of the topic name alone.  
- Must prioritize user notes, angles, and seed.  
- Web search should target people, products, teams, events, etc. mentioned in that context.  
- Output sections: What changed, Verified facts, Post angles, Watchouts (≤ ~350 words).

Stored research `query` is built from seed + up to five angles (fallback: topic name).

---

## Research briefs

| Piece | Detail |
|-------|--------|
| Route | `POST /api/research` |
| Implementation | `src/lib/research/brief.ts` → Grok **Responses** API + `web_search` |
| Storage | `research_briefs` table (`id`, `profileId`, `topicId`, `query`, `summary`, `citationsJson`, `modelUsed`, `createdAt`) |
| Timeout | `XAI_RESEARCH_TIMEOUT_MS` (default 90s); **maxRetries: 0** (no duplicate paid search) |
| Draft link | `POST /api/ai/draft` with `researchBriefId` injects brief text and copies citations onto the post |

Review briefs before publishing; web sources can include noise or commentary.

---

## AI provider behavior

| Concern | Behavior |
|---------|----------|
| Not configured | `503` `{ error: "AI_NOT_CONFIGURED" }`; UI disables AI actions |
| Rate limit (app) | Token bucket ~20 / 5 min → `429` `AI_RATE_LIMIT` |
| No credits / billing | Mapped to `402` `AI_NO_CREDITS` with provider message |
| Unauthorized key | `401` `AI_UNAUTHORIZED` |
| Upstream rate limit | `429` `AI_UPSTREAM_RATE_LIMIT` |
| JSON repair | One retry only for parse/schema failures — **not** for billing/auth errors |

Helpers: `AiProviderError`, `toAiProviderError`, `aiErrorJson` in `src/lib/ai/client.ts`.

Normal drafting uses Chat Completions + `response_format: json_object`. Research uses Responses + tools.

---

## X integration

| Capability | Status |
|------------|--------|
| OAuth connect / disconnect | Implemented |
| Token encrypt/decrypt | AES-GCM; required when using X sync |
| Timeline sync + partial 429 | Implemented |
| Voice rebuild (manual + after first sync) | Implemented |
| Web Intent + clipboard | Implemented (MVP ship path) |
| `POST /api/posts/:id/publish` | Implemented for **non-thread** singles |
| Thread API publish | **Not supported** (`X_THREAD_PUBLISH_NOT_SUPPORTED`) |
| Auto-post on schedule | **Not implemented** (`scheduledFor` is planning only) |

**Publish gates:**

1. UI confirmation  
2. `ENABLE_X_POSTING=true`  
3. Account scopes include `tweet.write` (`canPost`)  
4. Body non-empty, not already posted, no thread JSON  

Settings: **Connect X**, **Sync timeline**, **Reconnect with posting**, **Disconnect**.

---

## UI / UX (Content Studio)

Implemented across all main routes (2026-07-22 pass on Codex shell + full refresh):

| Area | Behavior |
|------|----------|
| Branding | “Content Studio” in nav; product name remains x-content-planner in repo |
| Shell | Sticky glass header; **mobile bottom tab bar**; main padding for safe area |
| Design tokens | Dark ambient gradients, status colors, custom selects, scrollbars (`globals.css`) |
| Primitives | `Button` (loading), `Select`, `StatusBadge`, `PageHeader`, `StatCard`, `EmptyState`, `Alert`, `Spinner` |
| Dashboard | Connection/AI/pipeline stats, capture with alerts, ready list, workflow steps |
| Board | Column accents, inline quick-add (no `window.prompt`), topic filter, status menus |
| Topics | Active list selection, research + ideas panel, context helper text |
| Calendar | Week controls, today highlight, unscheduled ready toggle |
| Editor | Char counter, thread part cards, publish/export section |
| Settings | Section cards, flag badges, OAuth alerts |

---

## HTTP API map

### System

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/health` | `features.ai`, `xSync`, `xPosting` |

### Topics

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/topics` | List |
| `POST` | `/api/topics` | Create |
| `PATCH` | `/api/topics/:id` | Update notes, angles, etc. |

### Content

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/posts` | Optional `includeArchived` |
| `POST` | `/api/posts` | Create |
| `GET` | `/api/posts/:id` | Detail (+ variants if any) |
| `PATCH` | `/api/posts/:id` | Status via transition helper |
| `POST` | `/api/posts/:id/mark-posted` | Manual posted |
| `POST` | `/api/posts/:id/publish` | X API single post |

### AI & research

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/ai/ideas` | Optional `notes`, `angles`, `seed` |
| `POST` | `/api/ai/draft` | Optional `notes`, `angles`, `researchBriefId` |
| `POST` | `/api/ai/rewrite` | Variants |
| `POST` | `/api/ai/polish` | Tighten |
| `POST` | `/api/ai/rebuild-voice` | From cached tweets |
| `POST` | `/api/research` | Optional `notes`, `angles`, `direction` |

### X & voice

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/auth/x/start` | OAuth begin (`intent=posting` optional) |
| `GET` | `/api/auth/x/callback` | OAuth callback |
| `POST` | `/api/auth/x/disconnect` | Clear tokens + cache |
| `GET` | `/api/x/status` | Connection + voice snippet |
| `POST` | `/api/x/sync` | Timeline pull |
| `PATCH` | `/api/voice` | Manual voice notes |

---

## Data model (implemented tables)

- `profiles`  
- `x_accounts` (encrypted tokens, scopes, sync state)  
- `voice_profiles`  
- `cached_tweets`  
- `topics` (`notes`, `anglesJson`, …)  
- `content_items` (`citationsJson`, `threadJson`, `xPostId`, …)  
- `content_variants` (schema present; limited UX)  
- `research_briefs`  

Bootstrap: `src/lib/db/client.ts` / `bootstrap.ts`. Default profile id: `default`. Seed topics: AI, Software Engineering, Cricket, Football.

---

## Configuration reference

See `.env.example` and README. Important flags:

| Variable | Default | Role |
|----------|---------|------|
| `ENABLE_X_SYNC` | `false` in example | OAuth + sync |
| `ENABLE_X_POSTING` | `false` | Direct publish |
| `XAI_TIMEOUT_MS` | `20000` | Draft/ideas/etc. |
| `XAI_RESEARCH_TIMEOUT_MS` | `90000` | Research only |

---

## Safety & limits

- Research is a **decision aid**, not a publishable article.  
- Direct publish cannot fire from schedule alone.  
- Threads: copy / Intent-per-part only for API path.  
- Single Node process owns the SQLite file.  
- AI credits must exist on the xAI team linked to the API key (billing 403s map to `AI_NO_CREDITS`).

---

## Testing & quality

| Check | Status |
|-------|--------|
| `npm run test:transitions` | Passes (status machine) |
| `npm run build` | Expected to pass on clean tree |
| `npm run lint` | May fail on existing React hook dependency rules on client pages — not a functional gate yet |
| Crypto / API integration tests | Not yet automated |

---

## Implemented vs design roadmap

| Design item | Status |
|-------------|--------|
| MVP PR 1–11 (shell → polish) | **Shipped** (monolithic commits; not separate PR history) |
| PR 12 single publish | **Shipped** (`/publish` + Settings reconnect) |
| Research / web-grounded briefs | **Shipped** (ahead of original Phase 3 “trends”) |
| Topic notes/angles grounding | **Shipped** (2026-07-22) |
| UI design system pass | **Shipped** (2026-07-22) |
| PR 13 Markdown export | **Not started** |
| Drag-and-drop board | Deferred (menu status change) |
| Thread API publish | Out of scope for Phase 2 |
| Scheduled auto-post worker | Not started |
| Citations editor UI | Partial (citations on posts via research; no full free-form citations UI) |

---

## Changelog (docs-relevant)

### 2026-07-22

- Content Studio UI system (nav, pages, primitives).  
- Research/ideas/draft grounded on live **notes + angles + seed**; Topics auto-save before AI.  
- AI error mapping (`AI_NO_CREDITS`, etc.).  

### 2026-07-21

- MVP pipeline, X OAuth/sync, Grok drafts, research briefs table + route, single-post publish flag.  
- Initial DESIGN + IMPLEMENTATION docs.  
