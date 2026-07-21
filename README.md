# X Content Planner

Personal content OS for planning and drafting posts on X that sound like **you**.

- **Local-first** Next.js app + SQLite on your machine  
- **Topic library** (seeded: AI, Software Engineering, Cricket, Football)  
- **Kanban pipeline**: idea → drafting → ready → scheduled → posted  
- **AI drafts** via [xAI Grok](https://docs.x.ai) (`grok-4.5`) in your voice  
- **X OAuth** (optional): sync recent tweets to build a voice profile  
- **Draft-first posting**: copy + [Web Intent](https://developer.x.com/en/docs/twitter-for-websites/web-intents/overview) (`intent/tweet`); API publish is Phase 2  

Design doc: [`docs/DESIGN.md`](./docs/DESIGN.md)

## Quick start

```bash
cd Projects/x-content-planner
cp .env.example .env
# optional: add XAI_API_KEY for Grok
# optional: X_CLIENT_ID / X_CLIENT_SECRET + TOKEN_ENCRYPTION_KEY for X connect
npm install
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Purpose |
|----------|---------|
| `XAI_API_KEY` | Grok drafts (server-only) |
| `TOKEN_ENCRYPTION_KEY` | AES-GCM for OAuth tokens — `openssl rand -base64 32` |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X developer app (confidential) |
| `APP_URL` | Default `http://localhost:3000` |
| `ENABLE_X_SYNC` | Require encryption key when true |
| `ENABLE_X_POSTING` | Phase 2 API post gate |

**Never** prefix secrets with `NEXT_PUBLIC_`.

### X developer portal (when ready)

1. Create an app at [developer.x.com](https://developer.x.com)  
2. OAuth 2.0, type **Web App** (confidential)  
3. Callback URL: `http://localhost:3000/api/auth/x/callback`  
4. Put client id/secret in `.env`, set `TOKEN_ENCRYPTION_KEY`, restart  
5. Settings → **Connect X** → **Sync timeline**

Without X credentials you can still capture ideas, manage topics, and draft with AI + manual voice notes.

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
| `/` | Dashboard, quick capture |
| `/topics` | Topics + AI ideas → draft |
| `/board` | Kanban by status |
| `/posts/[id]` | Editor, polish, Intent/copy |
| `/calendar` | Week schedule |
| `/settings` | X connect, voice, flags |

## Security notes

- OAuth tokens encrypted at rest when a key is set  
- Disconnect deletes tokens + cached tweets; keeps content; clears few-shot tweet bodies  
- Encryption protects against DB-only copies, not full home-directory compromise  

## License

Private / personal use unless you add one.
