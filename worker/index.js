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
 * Routes (10 total): /claude, /claude-vision, /scrape, /ideogram/generate,
 *   /ideogram/remix, /ideogram/replace-bg, /ideogram/edit, /ideogram/describe,
 *   /gemini-image (Nano Banana 2 text-to-image), /gemini-image-remix (image-to-image)
 *
 * See SETUP.md for full step-by-step instructions.
 */

// ── CONFIG: Replace YOUR_GITHUB_USERNAME with your actual GitHub username ──
constALLOWED_ORIGINS = [
  'https://tpsbatra.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
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
      // Accepts image as base64 for brand DNA extraction from uploaded images
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
      // Text-to-image: generate visual marketing posts
      if (path === '/ideogram/generate') {
        const body = await request.json();

        const response = await fetch('https://api.ideogram.ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': env.IDEOGRAM_API_KEY,
          },
          body: JSON.stringify({
            image_request: {
              prompt: body.prompt,
              aspect_ratio: body.aspect_ratio || 'ASPECT_1_1',
              model: 'V_3',
              rendering_speed: body.rendering_speed || 'BALANCED',
              style_type: body.style_type || 'DESIGN',
              negative_prompt: body.negative_prompt || '',
              magic_prompt_option: 'OFF',
            },
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/remix ───────────────────────────────────────────
      // Image-to-image: restyle uploaded photo into a marketing asset
      if (path === '/ideogram/remix') {
        const body = await request.json();

        // Ideogram remix uses multipart/form-data
        const formData = new FormData();
        
        // Convert base64 image to blob
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

        const response = await fetch('https://api.ideogram.ai/remix', {
          method: 'POST',
          headers: {
            'Api-Key': env.IDEOGRAM_API_KEY,
          },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/describe ────────────────────────────────────────
      // Describe an uploaded image (for brand visual extraction)
      if (path === '/ideogram/describe') {
        const body = await request.json();

        const formData = new FormData();
        const imageBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: body.mediaType || 'image/jpeg' });
        formData.append('image_file', imageBlob, 'upload.jpg');

        const response = await fetch('https://api.ideogram.ai/describe', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/replace-bg ─────────────────────────────────────
      // Replace background of an uploaded image using Ideogram
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

        const response = await fetch('https://api.ideogram.ai/replace-background', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /ideogram/edit ────────────────────────────────────────────
      // Edit an image with a mask (inpainting) — user draws mask on canvas
      if (path === '/ideogram/edit') {
        const body = await request.json();

        const formData = new FormData();

        // Original image
        const imgBytes = Uint8Array.from(atob(body.imageData), c => c.charCodeAt(0));
        formData.append('image_file', new Blob([imgBytes], { type: body.mediaType || 'image/jpeg' }), 'image.jpg');

        // Mask image (white = edit area, black = keep)
        const maskBytes = Uint8Array.from(atob(body.maskData), c => c.charCodeAt(0));
        formData.append('mask', new Blob([maskBytes], { type: 'image/png' }), 'mask.png');

        const imageRequest = {
          prompt: body.prompt,
          model: 'V_3',
          magic_prompt_option: 'OFF',
          style_type: body.style_type || 'DESIGN',
        };
        formData.append('image_request', JSON.stringify(imageRequest));

        const response = await fetch('https://api.ideogram.ai/edit', {
          method: 'POST',
          headers: { 'Api-Key': env.IDEOGRAM_API_KEY },
          body: formData,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers });
      }

      // ─── Route: /scrape ───────────────────────────────────────────────────
      // Fetch a website URL, extract brand signals, return structured brand data
      // The Worker fetches server-side so no CORS issues from the browser
      if (path === '/scrape') {
        const body = await request.json();
        const targetUrl = body.url;

        if (!targetUrl || !targetUrl.startsWith('http')) {
          return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers });
        }

        // ── Step 1: Fetch the page HTML ───────────────────────────────────
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

        // ── Step 2: Extract signals from HTML ─────────────────────────────
        // Strip scripts, styles, SVGs, and tags — keep meaningful text
        const cleanText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<svg[\s\S]*?<\/svg>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000); // cap at 4k chars for Claude context

        // Extract meta tags
        const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaOgDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1]
                       || (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
        const metaOgImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
        const metaKeywords = (html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';

        // Extract Google Fonts — e.g. fonts.googleapis.com/css?family=Playfair+Display
        const googleFonts = [];
        const fontMatches = html.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^"'&|;]+)/gi);
        for (const m of fontMatches) {
          const families = decodeURIComponent(m[1]).split('|').map(f => f.split(':')[0].replace(/\+/g, ' ').trim());
          googleFonts.push(...families);
        }

        // Extract CSS font-family declarations from inline styles and <style> blocks
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

        // Deduplicate fonts
        const allFonts = [...new Set([...googleFonts, ...cssFonts])].slice(0, 5);

        // Extract colour hints from CSS (very rough — hex colours in style blocks)
        const cssColors = [];
        const colorMatches = html.matchAll(/#([0-9a-fA-F]{6})\b/g);
        const colorCounts = {};
        for (const m of colorMatches) {
          const c = '#' + m[1].toUpperCase();
          // Skip near-white, near-black, pure greys
          const r = parseInt(m[1].slice(0,2),16), g = parseInt(m[1].slice(2,4),16), b = parseInt(m[1].slice(4,6),16);
          const isGrey = Math.abs(r-g)<15 && Math.abs(g-b)<15 && Math.abs(r-b)<15;
          const isWhite = r>230 && g>230 && b>230;
          const isBlack = r<30 && g<30 && b<30;
          if (!isGrey && !isWhite && !isBlack) colorCounts[c] = (colorCounts[c]||0)+1;
        }
        const sortedColors = Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);

        // ── Step 3: Ask Claude to synthesise brand identity ───────────────
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

        // Also return the raw og:image URL so the frontend can show a preview
        brandData.og_image = metaOgImage;
        brandData.fonts_detected = allFonts;

        return new Response(JSON.stringify({ success: true, brand: brandData }), { headers });
      }

      // ─── Route: /gemini-image ─────────────────────────────────────────────
      // Nano Banana 2 (gemini-3.1-flash-image-preview) — text-to-image
      // Requires GEMINI_API_KEY secret: wrangler secret put GEMINI_API_KEY
      if (path === '/gemini-image') {
        const body = await request.json();

        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured. Run: wrangler secret put GEMINI_API_KEY' }), { status: 503, headers });
        }

        // Map Ideogram aspect ratios to Gemini image sizes
        const sizeMap = {
          'ASPECT_1_1':  '1024x1024',
          'ASPECT_9_16': '768x1360',
          'ASPECT_16_9': '1360x768',
          'ASPECT_4_3':  '1024x768',
          'ASPECT_3_4':  '768x1024',
        };
        const imageSize = sizeMap[body.aspect_ratio] || '1024x1024';
        const [imgW, imgH] = imageSize.split('x').map(Number);

        // Gemini image generation via generateContent with responseModalities: ["IMAGE", "TEXT"]
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

        // Extract the inline base64 image from the response
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

        // Return in a normalised format the frontend can handle
        // We return base64 directly since Gemini doesn't give a URL
        return new Response(JSON.stringify({
          success: true,
          image_base64: imageBase64,
          mime_type: mimeType,
          engine: 'nano-banana-2',
        }), { headers });
      }

      // ─── Route: /gemini-image-remix ───────────────────────────────────────
      // Nano Banana 2 image-to-image — restyle an uploaded image
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

      return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },
};
