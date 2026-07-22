# X Content Planner (Content Studio)

Personal content OS for planning and drafting posts on X that sound like **you**.

The app UI brands the product as **Content Studio** — same codebase, local-first workflow.

## Features

- **Local-first** Next.js app + SQLite on your machine  
- **Topic library** (seeded: AI, Software Engineering, Cricket, Football) with **notes** and **angles**  
- **Kanban pipeline**: idea → drafting → ready → scheduled → posted  
- **AI drafts** via [xAI Grok](https://docs.x.ai) (`grok-4.5`) in your voice  
- **Grounded research & ideas**: web-backed research and idea generation use the topic’s **notes, angles, and seed direction** (not just the topic name)  
- **X OAuth** (optional): sync recent tweets to build a voice profile  
- **Draft-first posting**: copy + [Web Intent](https://developer.x.com/en/docs/twitter-for-websites/web-intents/overview); optional **direct single-post publish** behind a flag  
- **Modern dark UI**: glass surfaces, status badges, mobile bottom nav, empty/loading states  

Design doc (architecture / PR plan): [`docs/DESIGN.md`](./docs/DESIGN.md)  

Current shipped behavior & API notes: [`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md)

## Quick start

```bash
cd x-content-planner
cp .env.example .env
# optional: add XAI_API_KEY for Grok (and research)
# optional: X_CLIENT_ID / X_CLIENT_SECRET + TOKEN_ENCRYPTION_KEY for X connect
npm install
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Purpose |
|----------|---------|
| `XAI_API_KEY` | Grok drafts, polish, rewrite, voice rebuild, research (server-only) |
| `XAI_BASE_URL` | Default `https://api.x.ai/v1` |
| `XAI_MODEL` | Default `grok-4.5` |
| `XAI_TIMEOUT_MS` | Normal AI requests; default `20000` |
| `XAI_RESEARCH_TIMEOUT_MS` | Web-backed research; default `90000`; **no automatic retry** |
| `TOKEN_ENCRYPTION_KEY` | AES-GCM for OAuth tokens — `openssl rand -base64 32` |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X developer app (confidential web app) |
| `X_SCOPES_READ` | Default `tweet.read users.read offline.access` |
| `X_SCOPES_POSTING` | Adds `tweet.write` for reconnect-with-posting |
| `APP_URL` | Default `http://localhost:3000` |
| `ENABLE_X_SYNC` | OAuth + timeline sync; requires encryption key when true |
| `ENABLE_X_POSTING` | Direct single-post API publish; default `false` |
| `DEFAULT_CHAR_LIMIT` | Soft limit for singles; default `280` |

**Never** prefix secrets with `NEXT_PUBLIC_`.

### First-run paths

| Path | What you need |
|------|----------------|
| **Offline** | Nothing — capture ideas, board, copy/Intent, manual voice notes |
| **AI** | `XAI_API_KEY` + credits on your [xAI team](https://console.x.ai) |
| **X sync** | Developer app + `X_CLIENT_*` + `TOKEN_ENCRYPTION_KEY` + `ENABLE_X_SYNC=true` |
| **API publish** | Above + `ENABLE_X_POSTING=true` + **Reconnect with posting** (`tweet.write`) |

### X developer portal

1. Create an app at [developer.x.com](https://developer.x.com)  
2. OAuth 2.0, type **Web App** (confidential)  
3. Callback URL (exact): `http://localhost:3000/api/auth/x/callback`  
4. Put client id/secret in `.env`, set `TOKEN_ENCRYPTION_KEY`, set `ENABLE_X_SYNC=true`, restart  
5. Settings → **Connect X** → **Sync timeline**  
6. To publish directly: `ENABLE_X_POSTING=true`, restart, Settings → **Reconnect with posting**

### Scripts

```bash
npm run dev              # localhost:3000
npm run db:init          # create SQLite + seed topics
npm run db:backup        # copy DB to data/backups/
npm run test:transitions # status machine unit checks
npm run build
```

Runtime is **Node only** (`better-sqlite3` is not Edge-compatible). One process → one DB file.

## App map

| Route | Purpose |
|-------|---------|
| `/` | Dashboard, status cards, quick capture |
| `/topics` | Topics, notes/angles, research brief, AI ideas → draft |
| `/board` | Kanban by status (menu-driven transitions) |
| `/posts/[id]` | Editor, polish/rewrite, Intent/copy, optional Post to X |
| `/calendar` | Week schedule + unscheduled ready list |
| `/settings` | X connect/sync, voice profile, feature flags |

## Topics → research → draft

1. Select a topic; enter **notes** and **angles** (one angle per line).  
2. Optional seed direction in the AI box.  
3. **Research latest** or **Generate ideas** — the UI **auto-saves** notes/angles and sends them with the request so research is not a generic topic search.  
4. Review the brief (What changed / Verified facts / Post angles / Watchouts + source links).  
5. **Draft** an idea; optional active brief is attached as context and citations.  
6. Polish on the board/editor → Ready → copy, Intent, or Post to X.

## Security notes

- OAuth tokens encrypted at rest when a key is set  
- Disconnect deletes tokens + cached tweets; keeps content; clears few-shot tweet bodies  
- Encryption protects against DB-only copies, not full home-directory compromise  
- Direct publish always requires explicit UI confirmation  

## License

Private / personal use unless you add one.
