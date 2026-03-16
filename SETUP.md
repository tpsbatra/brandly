# Brandly — Step-by-Step Setup Guide

Follow these steps in order. The whole setup takes about 15–20 minutes.

---

## What you'll need before starting

- A [GitHub](https://github.com) account
- A [Cloudflare](https://cloudflare.com) account (free)
- Your **Anthropic (Claude) API key** → https://console.anthropic.com/settings/keys
- Your **Ideogram API key** → https://ideogram.ai (Profile → API Beta)
- Your **Google Gemini API key** (optional, for Nano Banana image engine) → https://aistudio.google.com
- [Node.js](https://nodejs.org) installed (v18 or higher)
- Basic comfort using Terminal / Command Prompt

---

## Step 1 — Create your GitHub repository

1. Go to https://github.com/new
2. Name the repository `brandly`
3. Set it to **Public** (required for free GitHub Pages)
4. Do NOT check "Add a README" — we already have one
5. Click **Create repository**

---

## Step 2 — Put the project files on your computer

Create this folder structure and copy the downloaded files in:

```
brandly/
├── index.html               ← root folder
├── dataowl-logo.png         ← root folder (your DataOwl logo)
├── README.md                ← root folder
├── SETUP.md                 ← root folder
├── BRANDLY-CONTEXT.md       ← root folder
└── worker/
    ├── index.js             ← inside worker folder
    └── wrangler.toml        ← inside worker folder
```

---

## Step 3 — Push files to GitHub

```bash
cd path/to/brandly

git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/brandly.git
git branch -M main
git push -u origin main
```

✅ Refresh your GitHub repo — you should see all files there.

---

## Step 4 — Enable GitHub Pages

1. Go to your repo: `https://github.com/YOUR_USERNAME/brandly`
2. Click **Settings → Pages**
3. Under Source: **Deploy from a branch**
4. Branch: **main**, folder: **/ (root)**
5. Click **Save**
6. Wait ~2 minutes → live at `https://YOUR_USERNAME.github.io/brandly`

📌 **Write down your GitHub Pages URL** — you'll need it in Step 6.

---

## Step 5 — Deploy the Cloudflare Worker

### 5a — Install Wrangler

```bash
npm install -g wrangler
wrangler --version   # should show 3.x.x
```

### 5b — Log in to Cloudflare

```bash
wrangler login
```

A browser window will open — log in and click **Allow**.

### 5c — Go into the worker folder

```bash
cd path/to/brandly/worker
```

### 5d — Add your API key secrets

Each command will prompt you to paste the key. Keys are stored encrypted — never in any file.

```bash
# Required
wrangler secret put CLAUDE_API_KEY
wrangler secret put IDEOGRAM_API_KEY

# Optional — only needed if you want to use Nano Banana (Google's image engine)
# Get your key from https://aistudio.google.com — requires billing enabled
wrangler secret put GEMINI_API_KEY
```

### 5e — Deploy the worker

```bash
wrangler deploy
```

You'll see output like:
```
Published brandly-worker (1.23 sec)
  https://brandly-worker.YOUR_SUBDOMAIN.workers.dev
```

📌 **Copy that Worker URL** — you need it in the next step.

---

## Step 6 — Update the two config values

### 6a — Worker URL in index.html

Open `index.html`, find this line near the bottom in the `<script>` section:

```js
const WORKER_URL = 'https://brandly-worker.YOUR_SUBDOMAIN.workers.dev'; // ← CHANGE THIS
```

Replace `YOUR_SUBDOMAIN` with your actual subdomain:
```js
const WORKER_URL = 'https://brandly-worker.johnsmith.workers.dev';
```

### 6b — CORS in worker/index.js

Open `worker/index.js`, find the top section:

```js
const ALLOWED_ORIGINS = [
  'https://YOUR_GITHUB_USERNAME.github.io',  // <- CHANGE THIS
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];
```

Replace `YOUR_GITHUB_USERNAME`:
```js
const ALLOWED_ORIGINS = [
  'https://johnsmith.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];
```

---

## Step 7 — Redeploy worker with updated CORS

```bash
cd path/to/brandly/worker
wrangler deploy
```

---

## Step 8 — Push config changes to GitHub

```bash
cd path/to/brandly
git add .
git commit -m "configure worker url and cors"
git push
```

GitHub Pages will redeploy in ~1–2 minutes.

---

## Step 9 — Test it

1. Go to `https://YOUR_USERNAME.github.io/brandly`
2. Enter password `2905`
3. You should see the landing page
4. Click **Open Studio** — the header should show a green dot and **"Worker connected"**

---

## Troubleshooting

**Red dot / "Worker offline"**
- Confirm you ran `wrangler deploy` from inside the `worker/` folder
- Check the `WORKER_URL` in `index.html` matches exactly what Wrangler printed

**"Worker error" on requests**
- Go to Cloudflare Dashboard → Workers → `brandly-worker` → Logs
- Most common cause: API key not set. Re-run `wrangler secret put CLAUDE_API_KEY`

**Images not generating with Ideogram**
- Check your Ideogram key has credits: ideogram.ai → Profile → API Beta → balance
- Make sure `IDEOGRAM_API_KEY` secret is set in the Worker

**Nano Banana images not generating**
- The Worker will return: `GEMINI_API_KEY not configured` if the secret isn't set
- Run `wrangler secret put GEMINI_API_KEY` from the worker folder, then `wrangler deploy`
- Make sure billing is enabled on your Google Cloud / AI Studio account

**CORS errors in browser console**
- The GitHub Pages URL in `ALLOWED_ORIGINS` must match exactly (no trailing slash)
- Redeploy the worker after any changes to `worker/index.js`

**GitHub Pages not showing latest changes**
- Wait 2–3 minutes after pushing
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

**"Permission denied" running wrangler**
- Mac/Linux: `sudo npm install -g wrangler`
- Or use: `npx wrangler deploy` instead of `wrangler deploy`

---

## Local Development

```bash
# In the brandly root folder
npx serve .
# Open http://localhost:3000
```

The Worker already allows `localhost:3000` in CORS.

---

## Updating Brandly in the future

Changes to `index.html` only:
```bash
git add . && git commit -m "update" && git push
```

Changes to `worker/index.js`:
```bash
cd worker && wrangler deploy
cd .. && git add . && git commit -m "update worker" && git push
```

Adding or changing API key secrets:
```bash
cd worker
wrangler secret put GEMINI_API_KEY   # or any other secret
wrangler deploy
```

---

## Your URLs

| | URL |
|---|---|
| Live site | `https://YOUR_USERNAME.github.io/brandly` |
| Cloudflare Worker | `https://brandly-worker.YOUR_SUBDOMAIN.workers.dev` |
| GitHub repo | `https://github.com/YOUR_USERNAME/brandly` |
| Cloudflare Dashboard | https://dash.cloudflare.com → Workers → brandly-worker |
| Anthropic Console | https://console.anthropic.com |
| Ideogram API | https://ideogram.ai → Profile → API Beta |
| Google AI Studio | https://aistudio.google.com |

---

That's it! Your Brandly instance is live, secure, and ready to use. 🎉
