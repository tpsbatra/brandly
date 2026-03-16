# Brandly — AI Marketing Studio

A Pomelli-inspired AI marketing tool built by DataOwl. Powered by Claude AI + Ideogram V3 + Nano Banana (Google Gemini). Hosted on GitHub Pages with a secure Cloudflare Worker backend.

---

## Features

- **Website URL scraping** — paste your URL and Brandly auto-extracts your brand identity
- **Brand DNA** — Claude builds a full brand profile: tagline, voice, USP, keywords, fonts, colour palette
- **Logo / image upload** — Claude Vision analyses your visuals and feeds them into the DNA
- **Campaign generator** — 4 tailored AI campaign ideas, or write your own
- **Multi-platform copy** — on-brand captions for Instagram, Facebook, LinkedIn, Twitter/X, Email (editable inline)
- **Visual post generation** — choose your image engine:
  - **Ideogram V3** — great for bold text overlays (~$0.08/image)
  - **Nano Banana 2** — Google's model, same engine as Pomelli (~$0.05/image)
- **Image editing** — replace background or restyle any image using Ideogram
- **Photo remix** — upload a product/team photo and restyle it into a branded marketing visual
- **Password protected** — access code gates the tool (client-side, session-based)
- **DataOwl branded** — full white-label with DataOwl logo and "Powered by DataOwl" footer

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | Single `index.html` — vanilla HTML, CSS, JS — GitHub Pages |
| Text & Vision AI | Claude Sonnet via Anthropic API |
| Image AI (default) | Ideogram V3 API |
| Image AI (optional) | Nano Banana 2 (`gemini-3.1-flash-image-preview`) via Gemini API |
| Secure API proxy | Cloudflare Worker — API keys never exposed to the browser |

---

## Quick Setup

See **SETUP.md** for the full step-by-step guide. In short:

```bash
# 1. Deploy the Cloudflare Worker
cd worker
wrangler secret put CLAUDE_API_KEY
wrangler secret put IDEOGRAM_API_KEY
wrangler secret put GEMINI_API_KEY   # optional — only needed for Nano Banana
wrangler deploy

# 2. Update two lines in the code
# index.html      → WORKER_URL = 'https://your-worker.workers.dev'
# worker/index.js → ALLOWED_ORIGINS = ['https://your-username.github.io']

# 3. Push to GitHub, enable GitHub Pages
git add . && git commit -m "configure" && git push
```

---

## Project Structure

```
brandly/
├── index.html               ← Full frontend (password + landing page + 4-step app)
├── dataowl-logo.png         ← DataOwl logo (add manually to repo root)
├── README.md                ← This file
├── SETUP.md                 ← Detailed step-by-step deployment guide
├── BRANDLY-CONTEXT.md       ← Paste into new AI chats for instant context
└── worker/
    ├── index.js             ← Cloudflare Worker (10 API routes)
    └── wrangler.toml        ← Worker config
```

---

## API Routes (Worker) — 10 total

| Route | Description |
|---|---|
| `POST /claude` | Text generation — DNA, campaigns, copy |
| `POST /claude-vision` | Image analysis — brand identity from uploaded image |
| `POST /scrape` | Website scraper — URL → brand profile via Claude |
| `POST /ideogram/generate` | Text-to-image visual post (Ideogram V3) |
| `POST /ideogram/remix` | Image-to-image restyle (Ideogram) |
| `POST /ideogram/replace-bg` | Replace image background (Ideogram) |
| `POST /ideogram/edit` | Inpainting / masked edit (Ideogram) |
| `POST /ideogram/describe` | Describe an uploaded image |
| `POST /gemini-image` | Text-to-image (Nano Banana 2 / Gemini API) |
| `POST /gemini-image-remix` | Image-to-image (Nano Banana 2 / Gemini API) |

---

## Secrets Required

| Secret | Required | Where to get it |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | console.anthropic.com |
| `IDEOGRAM_API_KEY` | Yes | ideogram.ai → Profile → API Beta |
| `GEMINI_API_KEY` | Optional | aistudio.google.com (needs billing enabled) |

---

## Security

- All API keys stored as encrypted Cloudflare Worker Secrets — never in code or browser
- CORS locked to your GitHub Pages domain
- Password screen (client-side) gates access — pair with Cloudflare Access for production

---

## Credits

Built with [Claude](https://anthropic.com) · [Ideogram](https://ideogram.ai) · [Gemini API](https://aistudio.google.com) · [Cloudflare Workers](https://workers.cloudflare.com)  
Inspired by [Pomelli](https://labs.google/pomelli) by Google Labs · Built by [DataOwl](https://dataowl.com)
