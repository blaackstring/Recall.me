# Recall.me

Recall.me is a Chrome extension + backend service that captures screenshots, runs AI analysis, stores embeddings, and lets you search previous captures semantically.

## What This Project Does

1. Capture current browser tab (button, context menu, or hotkey).
2. Upload image to backend.
3. Backend uploads image to S3.
4. Backend uses Gemini to generate:
   - summary
   - tags
   - embedding vector (768 dims)
5. Backend stores metadata + embedding in Supabase.
6. Search uses embedding similarity (`match_screenshots` RPC) to return relevant memories.

## Repository Structure

```
Recall.me/
  extension/            # Chrome extension (React + Vite + MV3)
  server/               # Express + TypeScript backend
  supabase_setup.sql    # DB schema + vector search function
```

## Tech Stack

- Extension: React, TypeScript, Vite, Chrome Extension Manifest V3
- Backend: Node.js, Express, TypeScript, Multer
- AI: Google Gemini (`gemini-2.5-flash`, `gemini-embedding-001`)
- Storage: AWS S3 (+ optional CloudFront URL)
- Database: Supabase Postgres + pgvector

## Prerequisites

- Node.js `20.19+` recommended (Vite 7 warns on lower versions)
- npm
- Chrome/Edge (for extension testing)
- Supabase project with SQL access
- AWS S3 bucket credentials
- Gemini API key

## Environment Variables

### Backend (`server/.env`)

Create `server/.env`:

```env
PORT=3001
SUPABASE_URL=
SUPABASE_ANON_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=
GEMINI_API_KEY=
CLOUDFRONT_URL=
```

Notes:
- `CLOUDFRONT_URL` is optional. If empty, direct S3 URL is returned.
- `SUPABASE_ANON_KEY` and `SUPABASE_URL` are required for DB operations.

### Extension (`extension/.env`)

Current UI code in `extension/src/App.tsx` uses hardcoded Supabase values.
`extension/.env` exists but is not currently wired into `App.tsx`.

If you want to use env values, migrate to:
- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_ANON_KEY`

## Supabase Setup

Run `supabase_setup.sql` in Supabase SQL editor:

- enables `pgvector`
- creates `screenshots` table
- enables RLS policies
- creates `match_screenshots(...)` vector search function

Important:
- Table currently references `auth.users(id)`.
- If you use the hardcoded guest user id (`00000000-0000-0000-0000-000000000000`), inserts can fail unless that user exists or you relax schema/policies for local testing.

## Local Development

## 1) Install dependencies

```bash
cd server
npm install

cd ../extension
npm install
```

## 2) Start backend

```bash
cd server
npm run dev
```

Backend endpoints:
- `POST /process-screenshot`
- `POST /search`
- `GET /health`

## 3) Build extension

```bash
cd extension
npm run build
```

## 4) Load extension in Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select `extension/dist`
5. Optional: open `chrome://extensions/shortcuts` and set `capture-memory`

## Usage

### Capture

You can capture by:
- Extension UI button (`Capture This Tab`)
- Context menu (`Recall This Page`)
- Command shortcut (`capture-memory`, default `Ctrl+Shift+S`)
- Content script fallback hotkeys on normal pages
- Paste image into page (`Ctrl+V`) to upload clipboard image


## Search fails with `TypeError: fetch failed` / timeout

Likely cause:
- network or DNS issue reaching Supabase

Checks:
1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. Test domain reachability from your machine
3. Retry on different network or DNS resolver

## Useful Commands

```bash
# backend
cd server
npm run dev

# extension build
cd extension
npm run build
```

## Future Improvements

- Move extension Supabase config fully to env vars
- Add proper authenticated user flow end-to-end (no guest UUID fallback)
- Add tests (API + extension message flow)
- Add retry/backoff for backend network calls
