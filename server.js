const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // opcional (/api/image)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // obrigatório (/api/generate)

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeText(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u2013/g, '-').replace(/\u2014/g, '-')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function stripMarkdownFences(s) {
  if (typeof s !== 'string') return '';
  let out = s.trim();
  out = out.replace(/^```[a-zA-Z]*\s*/m, '');
  out = out.replace(/```$/m, '');
  return out.trim();
}

function extractJsonObject(text) {
  const s = sanitizeText(stripMarkdownFences(text));
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = s.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      return null;
    }
  }
}

function assertOpenRouterKey() {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('Missing OPENROUTER_API_KEY env var');
    err.statusCode = 500;
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function svgFallbackDataUri(label, bg = '#f0ece3', fg = '#5a6e3a') {
  const safe = String(label || 'Image').slice(0, 28);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="${bg}"/>
    <circle cx="600" cy="360" r="140" fill="${fg}" opacity="0.12"/>
    <path d="M600 220 L635 360 L600 500 L565 360 Z" fill="${fg}" opacity="0.22"/>
    <text x="600" y="650" font-family="Arial" font-size="44" fill="${fg}" text-anchor="middle" opacity="0.72">${safe}</text>
  </svg>`;
  const b64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

function stableHash(str) {
  // hash simples e determinístico pra cache
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Vite project (sempre com pastas corretas)
// ─────────────────────────────────────────────────────────────────────────────

function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'lucide-react': '^0.263.1' },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0',
        autoprefixer: '^10.4.14',
        postcss: '^8.4.27',
        tailwindcss: '^3.3.3',
        typescript: '^5.0.2',
        vite: '^4.4.5'
      }
    }, null, 2),

    'vite.config.ts':
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: false
      },
      include: ['src']
    }, null, 2),

    'tsconfig.node.json': JSON.stringify({
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true
      },
      include: ['vite.config.ts']
    }, null, 2),

    'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    'tailwind.config.js': `export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }`,

    'index.html':
`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CodeAI App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    'src/main.tsx':
`import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

    'src/index.css':
`@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; }`,

    'src/App.tsx': String(appCode || '')
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenRouterRaw(prompt) {
  assertOpenRouterKey();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_API_KEY },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    let err;
    try { err = await response.json(); } catch (_) {}
    const msg = err?.error?.message ? err.error.message : ('OpenRouter error ' + response.status);
    throw new Error(msg);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return sanitizeText(typeof content === 'string' ? content : '');
}

async function callOpenRouterJson(prompt) {
  const raw = await callOpenRouterRaw(prompt);
  const obj = extractJsonObject(raw);
  if (!obj) {
    const e = new Error('Model did not return valid JSON.');
    e.raw = raw;
    throw e;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pollinations -> base64 (offline) com CACHE + RETRY + FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

const POLL_CACHE = new Map(); // key -> dataUri
const POLL_CACHE_MAX = 80;

function cacheGet(key) {
  if (!POLL_CACHE.has(key)) return null;
  const v = POLL_CACHE.get(key);
  // move pra fim (LRU simples)
  POLL_CACHE.delete(key);
  POLL_CACHE.set(key, v);
  return v;
}

function cacheSet(key, value) {
  POLL_CACHE.set(key, value);
  if (POLL_CACHE.size > POLL_CACHE_MAX) {
    const firstKey = POLL_CACHE.keys().next().value;
    if (firstKey) POLL_CACHE.delete(firstKey);
  }
}

async function fetchPollinationsAsDataUriSafe(prompt, width, height, seed) {
  const safePrompt = sanitizeText(prompt).slice(0, 650);
  const w = clamp(width || 1200, 256, 1600);
  const h = clamp(height || 800, 256, 1600);
  const s = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 2_000_000_000);

  const cacheKey = stableHash(`${safePrompt}|${w}x${h}|${s}`);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(safePrompt) +
    `?width=${w}&height=${h}&seed=${s}&nologo=true`;

  // retries com backoff (530/429/5xx)
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 25000);

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          // alguns CDNs ficam mais estáveis com user-agent
          'User-Agent': 'CodeAI/1.0 (+image fetch)'
        }
      });

      // se foi ok, converte
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || 'image/jpeg';
        const buf = await resp.buffer();

        // sanity check: evita salvar html como "imagem"
        if (buf.length < 5000 && /text\/html/i.test(ct)) {
          throw new Error('Pollinations returned HTML');
        }

        const dataUri = `data:${ct};base64,${buf.toString('base64')}`;
        cacheSet(cacheKey, dataUri);
        return dataUri;
      }

      // se falhou, decide retry
      const status = resp.status;
      const retryable = status === 429 || status === 530 || (status >= 500 && status <= 599);

      if (!retryable) {
        // não retrya 4xx "definitivos"
        return null;
      }

      // backoff exponencial + jitter
      const base = 350 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(base + jitter);
    } catch (e) {
      // timeout / network -> retry
      const base = 350 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(base + jitter);
    } finally {
      clearTimeout(t);
    }
  }

  return null; // depois de tudo, fallback
}

const REQUIRED_IMAGE_KEYS = ['HERO', 'STUDIO1', 'STUDIO2', 'STUDIO3', 'STUDIO4', 'STUDIO5'];

function buildDefaultImagePrompts(userRequest) {
  const base = sanitizeText(userRequest);
  const art = 'photorealistic premium commercial photography, sophisticated editorial style, soft natural light, olive green and warm beige accents, clean minimal luxury, no text, no logos, no watermark';
  return {
    HERO:    `${base}. wide hero photo, upscale pilates studio interior, elegant daylight, calm atmosphere, ${art}`,
    STUDIO1: `${base}. pilates reformer equipment close-up, premium studio, shallow depth of field, ${art}`,
    STUDIO2: `${base}. pilates class scene, instructor assisting, tasteful luxury studio, ${art}`,
    STUDIO3: `${base}. physiotherapy consultation in a modern clinic corner, premium, ${art}`,
    STUDIO4: `${base}. pilates mats area, minimal decor, olive accents, ${art}`,
    STUDIO5: `${base}. reception / waiting area of the studio, high-end, ${art}`,
  };
}

function normalizeImages(planImages, userRequest) {
  const arr = Array.isArray(planImages) ? planImages : [];
  const map = new Map();

  for (const it of arr) {
    if (!it) continue;
    const key = String(it.key || '').trim().toUpperCase();
    const prompt = String(it.prompt || '').trim();
    if (!key || !prompt) continue;

    map.set(key, {
      key,
      prompt,
      width: clamp(it.width || 1200, 256, 1600),
      height: clamp(it.height || 800, 256, 1600),
      seed: Number.isFinite(Number(it.seed)) ? Number(it.seed) : undefined
    });
  }

  const defaults = buildDefaultImagePrompts(userRequest);
  for (const k of REQUIRED_IMAGE_KEYS) {
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        prompt: defaults[k],
        width: k === 'HERO' ? 1400 : 900,
        height: k === 'HERO' ? 900 : 900,
        seed: undefined
      });
    }
  }

  return Array.from(map.values());
}

async function injectImagesIntoAppCode(appCode, images) {
  let code = String(appCode || '');

  for (let i = 0; i < images.length; i++) {
    const img = images[i] || {};
    const key = String(img.key || '').trim().toUpperCase();
    const prompt = String(img.prompt || '').trim();
    if (!key || !prompt) continue;

    const placeholder = `__IMG_${key}__`;

    // se não existe no TSX, não gera (evita request inútil)
    if (!code.includes(placeholder)) continue;

    const dataUri = await fetchPollinationsAsDataUriSafe(prompt, img.width, img.height, img.seed);
    if (dataUri) {
      code = code.split(placeholder).join(dataUri);
    } else {
      code = code.split(placeholder).join(svgFallbackDataUri(key));
    }

    if (i < images.length - 1) await sleep(120);
  }

  // fallback final: nenhum placeholder pode sobrar
  for (const k of REQUIRED_IMAGE_KEYS) {
    const ph = `__IMG_${k}__`;
    if (code.includes(ph)) {
      code = code.split(ph).join(svgFallbackDataUri(k));
    }
  }

  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt: modelo devolve JSON com appCode + images (keys fixas)
// ─────────────────────────────────────────────────────────────────────────────

function buildPlanPrompt(userRequest, currentAppCode) {
  const isModify = !!currentAppCode;

  const rules = [
    'Return ONLY valid JSON. No markdown. No comments.',
    'JSON schema must be exactly: {"appCode":"...","images":[{"key":"HERO","prompt":"...","width":1400,"height":900,"seed":123}]}',
    'appCode must be COMPLETE TSX for src/App.tsx',
    'Start appCode with: import React from "react"',
    'Export default: export default function App()',
    'Use Tailwind CSS only for styling',
    'Use lucide-react for icons (already installed)',
    'No external imports besides react and lucide-react',
    'You MUST use ONLY these image keys: HERO, STUDIO1, STUDIO2, STUDIO3, STUDIO4, STUDIO5',
    'In the TSX, you MUST reference placeholders exactly like: "__IMG_HERO__", "__IMG_STUDIO1__", ... "__IMG_STUDIO5__"',
    'Do NOT put any real image URLs in TSX — only placeholders',
    'Never output undefined/null in JSON values'
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      '',
      'You are EDITING an existing project. Keep structure and style. Make ONLY requested change.',
      '',
      'RULES:\n- ' + rules,
      '',
      '=== CURRENT App.tsx ===',
      String(currentAppCode),
      '=== END ===',
      '',
      'USER REQUEST: ' + String(userRequest),
      '',
      'Return JSON now.'
    ].join('\n');
  }

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality landing pages.',
    '',
    'RULES:\n- ' + rules,
    '',
    'IMAGE PROMPTS (IMPORTANT):',
    '- Photorealistic premium commercial photography',
    '- Sophisticated editorial feel, calm luxury',
    '- No text, no logos, no watermark',
    '- Consistent art direction across all images',
    '',
    'USER REQUEST:',
    String(userRequest),
    '',
    'Return JSON now.'
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// (Opcional) Anthropic Vision
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropicVision(image, mediaType, prompt) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY env var (needed for /api/image)');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    let err;
    try { err = await response.json(); } catch (_) {}
    const msg = err?.error?.message ? err.error.message : ('Anthropic error ' + response.status);
    throw new Error(msg);
  }

  const data = await response.json();
  const txt = data?.content?.[0]?.text;
  return sanitizeText(stripMarkdownFences(typeof txt === 'string' ? txt : ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const plan = await callOpenRouterJson(buildPlanPrompt(prompt, currentAppCode));

    if (!plan || typeof plan.appCode !== 'string') {
      throw new Error('Plan JSON missing "appCode".');
    }

    const normalizedImages = normalizeImages(plan.images, prompt);

    // IMPORTANT: nunca deixa 530 derrubar o fluxo
    const finalAppCode = await injectImagesIntoAppCode(plan.appCode, normalizedImages);
    const files = getBaseFiles(finalAppCode);

    res.json({ files, appCode: finalAppCode });
  } catch (err) {
    console.error('/api/generate error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Image required' });

  const visionPrompt = [
    'You are a senior React + TypeScript + Tailwind CSS expert.',
    'Analyze this design and recreate it as a React App.tsx with Tailwind.',
    prompt ? 'Additional instructions: ' + String(prompt) : '',
    '',
    'RULES:',
    '- Return ONLY raw TSX code, no markdown fences',
    '- Start with: import React from "react"',
    '- Export: export default function App()',
    '- Use Tailwind CSS only',
    '- Use lucide-react for icons if needed'
  ].join('\n');

  try {
    const appCode = await callAnthropicVision(image, mediaType || 'image/png', visionPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/image error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const fullPrompt =
      'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' +
      (code ? ('Current code:\n' + code + '\n\nRequest: ' + prompt) : prompt);

    const result = await callOpenRouterRaw(fullPrompt);
    res.json({ result: stripMarkdownFences(result) });
  } catch (err) {
    console.error('/api/chat error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

app.listen(PORT, function () {
  console.log('CodeAI running on port ' + PORT);
});
