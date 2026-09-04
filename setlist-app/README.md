# Setlist

A live YouTube song queue for a party or event. One host screen plays the
video queue; guests scan a QR code to add songs from their phone without
needing an account. The host is exempt from the guest add-cooldown and
duplicate-song check.

## Run it locally

```
npm install
npm run dev
```

Open the printed `http://localhost:5173` link — that's the host view. This
works immediately with **no setup**, but the queue only lives on this one
browser (see below to make it work across devices).

## Cross-device syncing (so a phone can actually reach the queue)

Out of the box, the queue is stored in this browser's `localStorage`, so a
phone scanning the QR code won't see what the host adds, or vice versa. To
fix that, point the app at a free Firebase Realtime Database — no backend
code required, just a URL:

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   create a project (free tier is enough).
2. In the left sidebar, open **Build → Realtime Database**, click
   **Create Database**, and start it in **test mode** (allows open read/write —
   fine for a party queue, not for anything sensitive).
3. Copy the database URL shown at the top, something like
   `https://your-project-default-rtdb.firebaseio.com`.
4. Copy `.env.example` to `.env` and paste it in:
   ```
   VITE_FIREBASE_DB_URL=https://your-project-default-rtdb.firebaseio.com
   ```
5. Restart `npm run dev`. The "local-only mode" banner should disappear.

Test-mode database rules expire after 30 days — when that happens, open
**Realtime Database → Rules** in the Firebase console and set:
```json
{ "rules": { ".read": true, ".write": true } }
```

## Deploying

### GitHub Pages
```
npm run build
npm run deploy
```
This uses the `gh-pages` package (already in `package.json`) to push the
`dist` folder to a `gh-pages` branch. Then in your repo's Settings → Pages,
set the source to that branch. Your app will be live at
`https://yourusername.github.io/your-repo-name/`.

### Vercel / Netlify
Both auto-detect Vite. Push this folder to a GitHub repo, then "import
project" on either platform — no config needed. Add the
`VITE_FIREBASE_DB_URL` environment variable in their dashboard so the
deployed build has it too (`.env` files aren't committed to git).

## How the pieces fit together

- `src/components/Host.jsx` — the main screen: YouTube player, queue
  controls (reorder/remove/skip/clear), and the QR join card. No add
  restrictions apply here.
- `src/components/Guest.jsx` — the page the QR code links to
  (`?room=CODE`): a name field, a paste-a-link box with a 45-second
  cooldown, and a read-only view of the queue.
- `src/lib/storage.js` — reads/writes the shared queue, via Firebase if
  configured, otherwise `localStorage`.
- `src/lib/youtube.js` — pulls a video ID out of any YouTube URL format and
  fetches its title/thumbnail via YouTube's public oEmbed endpoint (no API
  key needed).

## Known limitations

- The player must be started once with the on-screen button — browsers
  block autoplaying audio before a click.
- Song titles come from YouTube's oEmbed endpoint rather than a search API,
  so guests need to paste a link rather than search by name.
- Firebase test-mode rules are open to anyone with your database URL —
  fine for a casual party queue, not for anything you need locked down.
