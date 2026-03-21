/**
 * BRANDLY — Cloudflare Worker API Proxy
 *
 * SETUP (run from the /worker folder in your terminal):
 *   1. wrangler secret put CLAUDE_API_KEY      <- paste your Anthropic key
 *   2. wrangler secret put IDEOGRAM_API_KEY    <- paste your Ideogram key
 *   3. wrangler secret put GEMINI_API_KEY      <- paste your Google AI Studio key (Nano Banana)
 *   4. Update ALLOWED_ORIGINS below with your GitHub Pages URL
 *   5. wrangler deploy
 *
 * GEMINI_API_KEY: get from https://aistudio.google.com — requires billing enabled
 * Routes (11 total): /claude, /claude-vision, /scrape, /ideogram/generate,
 *   /ideogram/remix, /ideogram/replace-bg, /ideogram/edit, /ideogram/describe,
 *   /gemini-image (Nano Banana 2 text-to-image), /gemini-image-remix (image-to-image),
 *   /proxy-image (CORS-safe image proxy for watermarking)
 *
 * See SETUP.md for full step-by-step instructions.
 */

// ── CONFIG: Replace YOUR_GITHUB_USERNAME with your actual GitHub username ──
const ALLOWED_ORIGINS = [
  'https://tpsbatra.github.io',
  'http://localhost:3000',                    // for local dev
  'http://127.0.0.1:5500',                   // for VS Code Live Server
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── Route: /claude ───────────────────────────────────────────────────
      if (path === '/claude') {
        const body = await request.json();

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            system: body.system || 'You are an expert marketing strategist. Respond ONLY with valid JSON. No markdown, no backticks, no explanation.',
            messages: body.messages,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /claude-vision ────────────────────────────────────────────
      if (path === '/claude-vision') {
        const body = await request.json();

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            system: 'You are a brand identity expert. Analyse images and respond ONLY with valid JSON. No markdown, no backticks.',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: body.mediaType || 'image/jpeg',
                    data: body.imageData,
                  },
                },
                { type: 'text', text: body.prompt },
              ],
            }],
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/generate ────────────────────────────────────────
      if (path === '/ideogram/generate') {
        const body = await request.json();

        const formData = new FormData();
        formData.append('prompt', body.prompt);
        formData.append('aspect_ratio', body.aspect_ratio || 'ASPECT_1_1');
        formData.append('rendering_speed', body.rendering_speed || 'DEFAULT');
        formData.append('style_type', body.style_type || 'DESIGN');
        formData.append('magic_prompt', 'OFF');
        if (body.negative_prompt) formData.append('negative_prompt', body.negative_prompt);

        const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/remix ───────────────────────────────────────────
      if (path === '/ideogram/remix') {
        const body = await request.json();

        const formData = new FormData();
        const imageBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: body.mediaType || 'image/jpeg' });
        formData.append('image_file', imageBlob, 'upload.jpg');

        const imageRequest = {
          prompt: body.prompt,
          aspect_ratio: body.aspect_ratio || 'ASPECT_1_1',
          model: 'V_3',
          rendering_speed: body.rendering_speed || 'BALANCED',
          style_type: body.style_type || 'DESIGN',
          image_weight: body.image_weight || 50,
          magic_prompt_option: 'OFF',
        };
        formData.append('image_request', JSON.stringify(imageRequest));

        const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/remix', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/describe ────────────────────────────────────────
      if (path === '/ideogram/describe') {
        const body = await request.json();

        const formData = new FormData();
        const imageBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: body.mediaType || 'image/jpeg' });
        formData.append('image_file', imageBlob, 'upload.jpg');

        const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/describe', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/replace-bg ─────────────────────────────────────
      if (path === '/ideogram/replace-bg') {
        const body = await request.json();

        const formData = new FormData();
        const imageBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: body.mediaType || 'image/jpeg' });
        formData.append('image_file', imageBlob, 'upload.jpg');

        const imageRequest = {
          prompt: body.prompt,
          model: 'V_3',
          magic_prompt_option: 'OFF',
        };
        formData.append('image_request', JSON.stringify(imageRequest));

        const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/replace-background', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/edit ────────────────────────────────────────────
      if (path === '/ideogram/edit') {
        const body = await request.json();

        const formData = new FormData();
        const imgBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        formData.append('image_file', new Blob([imgBytes], { type: body.mediaType || 'image/jpeg' }), 'image.jpg');

        const maskBytes = Uint8Array.from(atob(body.maskData), c => c.charCodeAt(0));
        formData.append('mask', new Blob([maskBytes], { type: 'image/png' }), 'mask.png');

        const imageRequest = {
          prompt: body.prompt,
          model: 'V_3',
          magic_prompt_option: 'OFF',
          style_type: body.style_type || 'DESIGN',
        };
        formData.append('image_request', JSON.stringify(imageRequest));

        const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/edit', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /scrape ───────────────────────────────────────────────────
      if (path === '/scrape') {
        const body = await request.json();
        const targetUrl = body.url;

        if (!targetUrl || !targetUrl.startsWith('http')) {
          return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers });
        }

        let html = '';
        try {
          const pageRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Brandly-Bot/1.0)',
              'Accept': 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            cf: { timeout: 10 },
          });
          html = await pageRes.text();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Could not fetch URL. The site may block scrapers or be unavailable.', detail: e.message }), { status: 422, headers });
        }

        const cleanText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<svg[\s\S]*?<\/svg>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);

        const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaOgDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1]
                       || (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
        const metaOgImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaKeywords = (html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';

        const googleFonts = [];
        const fontMatches = html.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^"'&|;]+)/gi);
        for (const m of fontMatches) {
          const families = decodeURIComponent(m[1]).split('|').map(f => f.split(':')[0].replace(/\+/g, ' ').trim());
          googleFonts.push(...families);
        }

        const cssFonts = [];
        const cssBlocks = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        for (const block of cssBlocks) {
          const fontFamilyMatches = block[1].matchAll(/font-family\s*:\s*([^;}{]+)/gi);
          for (const ff of fontFamilyMatches) {
            const first = ff[1].split(',')[0].replace(/['"]/g, '').trim();
            if (first && !first.toLowerCase().includes('sans-serif') && !first.toLowerCase().includes('serif') && !first.toLowerCase().includes('monospace') && !first.toLowerCase().includes('inherit') && !first.toLowerCase().includes('var(')) {
              cssFonts.push(first);
            }
          }
        }

        const allFonts = [...new Set([...googleFonts, ...cssFonts])].slice(0, 5);

        const colorMatches = html.matchAll(/#([0-9a-fA-F]{6})\b/g);
        const colorCounts = {};
        for (const m of colorMatches) {
          const c = '#' + m[1].toUpperCase();
          const r = parseInt(m[1].slice(0,2),16), g = parseInt(m[1].slice(2,4),16), b = parseInt(m[1].slice(4,6),16);
          const isGrey = Math.abs(r-g)<15 && Math.abs(g-b)<15 && Math.abs(r-b)<15;
          const isWhite = r>230 && g>230 && b>230;
          const isBlack = r<30 && g<30 && b<30;
          if (!isGrey && !isWhite && !isBlack) colorCounts[c] = (colorCounts[c]||0)+1;
        }
        const sortedColors = Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1200,
            system: 'You are a brand identity expert. Extract brand information from website content and respond ONLY with valid JSON. No markdown, no backticks.',
            messages: [{
              role: 'user',
              content: `Analyse this website content and extract brand identity.

Page title: ${metaTitle}
Meta description: ${metaDesc || metaOgDesc}
Meta keywords: ${metaKeywords}
Colours found in CSS: ${sortedColors.join(', ') || 'none detected'}
Fonts found: ${allFonts.join(', ') || 'none detected'}
Page text excerpt: ${cleanText.slice(0, 2000)}

Return JSON with these exact fields:
- business_name: the business name (string)
- description: what the business does in 2-3 sentences
- audience: who their likely target audience is (1 sentence)
- tone: one of [Friendly, Professional, Playful, Inspiring, Minimal, Bold, Luxurious]
- tagline: a short brand tagline (max 8 words)
- voice: brand voice description (2 sentences)
- usp: unique selling point (1 sentence)
- keywords: array of 5 brand keywords
- audience_insight: 1 sentence on the core audience motivation
- content_themes: array of 3 content theme names
- suggested_colors: array of 3 hex codes (use the CSS colours found if they look brand-relevant, otherwise infer)
- fonts: array of font names found (use the fonts detected, can be empty array)
- confidence: "high", "medium", or "low" based on how much brand info was available`,
            }],
          }),
        });

        const claudeData = await claudeRes.json();
        const claudeText = claudeData.content?.map(c => c.text || '').join('') || '';
        let brandData = {};
        try {
          brandData = JSON.parse(claudeText.replace(/```json|```/g, '').trim());
        } catch {
          return new Response(JSON.stringify({ error: 'Could not parse brand data from page' }), { status: 422, headers });
        }

        brandData.og_image = metaOgImage;
        brandData.fonts_detected = allFonts;

        return new Response(JSON.stringify({ success: true, brand: brandData }), { headers });
      }

      // ─── Route: /gemini-image ─────────────────────────────────────────────
      if (path === '/gemini-image') {
        const body = await request.json();

        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured. Run: wrangler secret put GEMINI_API_KEY' }), { status: 503, headers });
        }

        const sizeMap = {
          'ASPECT_1_1':  '1024x1024',
          'ASPECT_9_16': '768x1360',
          'ASPECT_16_9': '1360x768',
          'ASPECT_4_3':  '1024x768',
          'ASPECT_3_4':  '768x1024',
        };
        const imageSize = sizeMap[body.aspect_ratio] || '1024x1024';

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: body.prompt }] }],
              generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
                imagenConfig: { aspectRatio: imageSize },
              },
            }),
          }
        );

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          return new Response(JSON.stringify({ error: 'Gemini API error', detail: errText }), { status: geminiRes.status, headers });
        }

        const geminiData = await geminiRes.json();
        let imageBase64 = null;
        let mimeType = 'image/png';
        const parts = geminiData?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
            break;
          }
        }

        if (!imageBase64) {
          return new Response(JSON.stringify({ error: 'No image returned from Gemini', raw: geminiData }), { status: 422, headers });
        }

        return new Response(JSON.stringify({
          success: true,
          image_base64: imageBase64,
          mime_type: mimeType,
          engine: 'nano-banana-2',
        }), { headers });
      }

      // ─── Route: /gemini-image-remix ───────────────────────────────────────
      if (path === '/gemini-image-remix') {
        const body = await request.json();

        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured.' }), { status: 503, headers });
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType: body.mediaType || 'image/jpeg', data: body.imageData } },
                  { text: body.prompt },
                ],
              }],
              generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
              },
            }),
          }
        );

        const geminiData = await geminiRes.json();
        let imageBase64 = null;
        let mimeType = 'image/png';
        const parts = geminiData?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
            break;
          }
        }

        if (!imageBase64) {
          return new Response(JSON.stringify({ error: 'No image returned from Gemini', raw: geminiData }), { status: 422, headers });
        }

        return new Response(JSON.stringify({
          success: true,
          image_base64: imageBase64,
          mime_type: mimeType,
          engine: 'nano-banana-2',
        }), { headers });
      }

      // ─── Route: /proxy-image ──────────────────────────────────────────────
      // Fetches an external image server-side and returns it as base64 JSON.
      // Solves the canvas CORS taint problem: Ideogram CDN URLs cannot be drawn
      // onto an HTML Canvas from the browser (no CORS headers), so we proxy them
      // through the Worker. The frontend converts the base64 to a data URI,
      // which has no cross-origin restriction on canvas.
      //
      // Security: only proxies URLs from ideogram.ai domains — not an open proxy.
      if (path === '/proxy-image') {
        const body = await request.json();
        const imageUrl = body.url;

        // Validate and whitelist
        let parsedUrl;
        try { parsedUrl = new URL(imageUrl); } catch {
          return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers });
        }
        if (!parsedUrl.hostname.endsWith('ideogram.ai')) {
          return new Response(JSON.stringify({ error: 'URL not allowed — only ideogram.ai images can be proxied' }), { status: 403, headers });
        }

        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          return new Response(JSON.stringify({ error: 'Could not fetch image', status: imgRes.status }), { status: 502, headers });
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

        return new Response(JSON.stringify({
          success: true,
          image_base64: base64,
          mime_type: mimeType,
        }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },
};
