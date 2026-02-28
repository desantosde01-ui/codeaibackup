const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // opcional (rota /api/image)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // obrigatório para /api/generate

app.use(cors());
app.use(express.json({ limit: '25mb' }));
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

// Tenta extrair JSON mesmo que o modelo envie texto junto
function extractJsonObject(text) {
  const s = sanitizeText(stripMarkdownFences(text));
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = s.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // tentativa extra: remover trailing commas
    const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Base project files (Vite + React + TS + Tailwind)
// ─────────────────────────────────────────────────────────────────────────────

function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'lucide-react': '^0.263.1'
      },
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

    'src/App.tsx': appCode
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter calls
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenRouterRaw(prompt) {
  assertOpenRouterKey();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    let err;
    try { err = await response.json(); } catch (_) {}
    const msg = err && err.error && err.error.message
      ? err.error.message
      : ('OpenRouter error ' + response.status);
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
// Pollinations image generator (server-side) -> base64 data URI
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPollinationsAsDataUri(prompt, width, height, seed) {
  const safePrompt = sanitizeText(prompt).slice(0, 500); // limita o texto
  const w = Math.max(256, Math.min(Number(width) || 1200, 1600));
  const h = Math.max(256, Math.min(Number(height) || 900, 1600));
  const s = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 2_000_000_000);

  const url =
    'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(safePrompt) +
    `?width=${w}&height=${h}&seed=${s}&nologo=true`;

  // timeout simples
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error('Pollinations error ' + resp.status);

    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const buf = await resp.buffer();
    const b64 = buf.toString('base64');
    return `data:${contentType};base64,${b64}`;
  } finally {
    clearTimeout(t);
  }
}

async function injectImagesIntoAppCode(appCode, images) {
  let code = String(appCode || '');

  if (!Array.isArray(images) || images.length === 0) return code;

  // gera em série pra evitar rate-limit; se quiser, dá pra paralelizar com limite
  for (let i = 0; i < images.length; i++) {
    const img = images[i] || {};
    const key = String(img.key || '').trim();
    const prompt = String(img.prompt || '').trim();

    if (!key || !prompt) continue;

    const dataUri = await fetchPollinationsAsDataUri(
      prompt,
      img.width || 1200,
      img.height || 900,
      img.seed
    );

    // placeholder padrão: __IMG_<KEY>__
    const placeholder = `__IMG_${key}__`;
    code = code.split(placeholder).join(dataUri);

    // pequena pausa entre imagens pra reduzir chance de bloqueio
    if (i < images.length - 1) await sleep(150);
  }

  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder (robusto): MODELO DEVOLVE JSON com App.tsx + prompts de imagem
// ─────────────────────────────────────────────────────────────────────────────

function buildPlanPrompt(userRequest, currentAppCode) {
  const isModify = !!currentAppCode;

  const rules = [
    'Return ONLY valid JSON. No markdown. No comments.',
    'JSON schema must be exactly: {"appCode":"...","images":[{"key":"HERO","prompt":"...","width":1200,"height":900,"seed":123}]}',
    'appCode must be COMPLETE TSX for src/App.tsx',
    'Start appCode with: import React from "react"',
    'Export default: export default function App()',
    'Use Tailwind CSS only for styling',
    'Use lucide-react for icons (already installed)',
    'No external imports besides react and lucide-react',
    'No splitting into multiple files (everything stays in App.tsx)',
    'If you include images, you MUST reference placeholders in the TSX exactly like: "__IMG_HERO__", "__IMG_GALLERY1__", "__IMG_GALLERY2__", etc.',
    'Do NOT put real URLs in the TSX for those images — only placeholders.',
    'Keep number of images small: 1 hero + up to 5 gallery images max.'
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
    'DESIGN REQUIREMENTS:',
    '- Hero full-screen, premium typography, clear CTA',
    '- Sections with generous spacing (py-24), premium cards and hover',
    '- Mobile responsive',
    '- If user asks for special effects (cursor, canvas, parallax), implement carefully and keep it smooth',
    '',
    'IMAGE PROMPT REQUIREMENTS:',
    '- Produce photorealistic, premium commercial photography prompts (no text in image, no logos, no watermarks)',
    '- Respect the niche (e.g. pilates studio, clinic, restaurant, etc.)',
    '- Use consistent art direction across images',
    '',
    'User request: ' + String(userRequest),
    '',
    'Return JSON now.'
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// (Opcional) Anthropic Vision (se você usar /api/image)
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
    const msg = err && err.error && err.error.message
      ? err.error.message
      : ('Anthropic error ' + response.status);
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
    // 1) Modelo gera JSON: { appCode, images[] }
    const plan = await callOpenRouterJson(buildPlanPrompt(prompt, currentAppCode));

    if (!plan || typeof plan.appCode !== 'string') {
      throw new Error('Plan JSON missing "appCode".');
    }

    const images = Array.isArray(plan.images) ? plan.images : [];

    // 2) Injeta imagens base64 nos placeholders
    const finalAppCode = await injectImagesIntoAppCode(plan.appCode, images);

    // 3) Monta projeto Vite certinho
    const files = getBaseFiles(finalAppCode);

    res.json({ files, appCode: finalAppCode });
  } catch (err) {
    console.error('/api/generate error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message || 'Unknown error' });
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
    console.error('/api/image error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message || 'Unknown error' });
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
    console.error('/api/chat error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

app.listen(PORT, function () {
  console.log('CodeAI running on port ' + PORT);
});
