# Pinyin Paradise

A **personal** English UI web app to teach **one learner** Hanyu Pinyin: chart, listen & pick, tones, short stories, and three arcade mini-games. No accounts.

## Set the learner’s name

Edit `client/src/config.ts`:

```ts
export const LEARNER_NAME = 'Leyla';
```

Or when building:

```bash
VITE_LEARNER_NAME=Leyla npm run build --prefix client
```

## Features

| Area | Description |
|------|-------------|
| Pinyin chart | Tap cards to hear initials, finals, whole syllables |
| Listen & pick | Hear a character, choose the correct pinyin |
| Tone practice | Pick the tone for a syllable |
| Short stories | Chinese + pinyin lines, tap to listen |
| **Arcade** | Bubble Pop, Snap Judge, Tone Climb (no match-3 / old tile games) |

## Run locally

```bash
npm install
npm run install:all
npm run dev
```

Open http://localhost:5173 (API/static on port **3010** when using the full dev script).

## Audio (pinyin chart + stories + quiz chars)

```bash
npm run generate:audio
```

Downloads MP3s into `client/public/audio`. Requires Python 3 + `edge-tts` and internet.

## Production build

```bash
npm run build
cd server && PORT=3010 node index.js
```

Health check: `http://localhost:3010/api/health` → `{ "ok": true, "app": "pinyin-paradise" }`.

## Deploy (leylish.work)

See `deploy/DEPLOY.md`. After `git pull` on the server, always run `npm run build` and restart PM2 (`pinyin-paradise`). Hard-refresh the browser if you still see an old game UI.
