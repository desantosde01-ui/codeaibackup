const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn('WARNING: OPENROUTER_API_KEY not set');
}
if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set');
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* =========================================================
   NICHE DETECTION
========================================================= */

function detectNiche(text) {
  const t = (text || '').toLowerCase();

  const rules = [
    { key: 'pilates', words: ['pilates'] },
    { key: 'estetica', words: ['estetica', 'estética', 'harmonizacao', 'harmonização', 'botox', 'preenchimento'] },
    { key: 'psicologia', words: ['psicologia', 'terapia', 'ansiedade', 'depressao', 'depressão'] },
    { key: 'nutricao', words: ['nutricao', 'nutrição', 'dieta', 'emagrecimento'] },
    { key: 'veterinaria', words: ['veterinaria', 'veterinária', 'pet', 'cachorro', 'gato'] },
    { key: 'restaurante', words: ['restaurante', 'cardapio', 'cardápio'] },
    { key: 'chacara', words: ['chacara', 'chácara', 'eventos', 'festa', 'casamento'] },
    { key: 'marketing', words: ['marketing', 'trafego', 'tráfego', 'social media'] },
    { key: 'tech', words: ['software', 'app', 'site', 'startup', 'tecnologia'] },
    { key: 'law', words: ['advogado', 'advocacia', 'juridico', 'jurídico'] },
    { key: 'realestate', words: ['imobiliaria', 'imobiliária', 'corretor', 'imovel', 'imóvel'] },
    { key: 'fitness', words: ['academia', 'personal trainer', 'treino'] },
  ];

  for (const rule of rules) {
    if (rule.words.some(w => t.includes(w))) return rule.key;
  }

  return 'default';
}

/* =========================================================
   FONT CONFIG
========================================================= */

const FONT_PAIRS = {
  pilates: { heading: 'Playfair Display', body: 'Inter', url: 'Playfair+Display:wght@600;700|Inter:wght@400;500;600' },
  estetica: { heading: 'Bodoni Moda', body: 'Jost', url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  restaurante: { heading: 'Cormorant Garamond', body: 'Nunito', url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  tech: { heading: 'Space Grotesk', body: 'DM Sans', url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  law: { heading: 'Playfair Display', body: 'Lato', url: 'Playfair+Display:wght@600;700|Lato:wght@400;700' },
  default: { heading: 'Plus Jakarta Sans', body: 'Inter', url: 'Plus+Jakarta+Sans:wght@600;700|Inter:wght@400;500;600' }
};

/* =========================================================
   UNSPLASH IMAGES
========================================================= */

const UNSPLASH_IMAGES = {
  pilates: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80'
  ],
  default: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a7db3?w=800&q=80'
  ]
};

/* =========================================================
   SANITIZE
========================================================= */

function sanitizeCode(code) {
  code = (code || '').trim();

  code = code.replace(/^\s*```[a-zA-Z]*\s*/m, '');
  code = code.replace(/\s*```\s*$/m, '');

  const idx = code.search(/\bimport\s+React\b/);
  if (idx > 0) code = code.slice(idx);

  code = code
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ');

  return code.trim();
}

/* =========================================================
   TIMEOUT FETCH
========================================================= */

async function fetchWithTimeout(url, options, timeout = 90000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/* =========================================================
   BUILD PROMPT
========================================================= */

function buildPrompt(userRequest, currentAppCode, chatHistory) {
  const isModify = !!currentAppCode;

  const rules = `
- Return ONLY raw TSX
- Start with: import React from "react"
- Export: export default function App()
- Tailwind CSS only
- lucide-react allowed
- ASCII only
- Properly closed JSX
`;

  if (isModify) {
    return `
You are editing an existing React project.

${rules}

CURRENT CODE:
${currentAppCode}

USER REQUEST:
${userRequest}

Return the complete updated App.tsx.
`;
  }

  const niche = detectNiche(userRequest);
  const fonts = FONT_PAIRS[niche] || FONT_PAIRS.default;
  const images = UNSPLASH_IMAGES[niche] || UNSPLASH_IMAGES.default;

  return `
You are a world-class UI/UX designer.

${rules}

FONTS:
Load Google Fonts:
https://fonts.googleapis.com/css2?family=${fonts.url}&display=swap

IMAGES:
Hero background: ${images[0]}

Create a premium React landing page for:
${userRequest}

Include:
- Full hero with overlay
- Sections
- Cards with hover
- CTA
- Footer

Return only App.tsx
`;
}

/* =========================================================
   OPENROUTER
========================================================= */

async function callOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + OPENROUTER_API_KEY
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'OpenRouter error');
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

/* =========================================================
   ROUTES
========================================================= */

app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode, chatHistory } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const appCode = await callOpenRouter(
      buildPrompt(prompt, currentAppCode, chatHistory)
    );

    res.json({ appCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('CodeAI running on port ' + PORT);
});
