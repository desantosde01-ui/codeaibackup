const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   NICHE DETECTION
========================= */

function detectNiche(text) {
  const t = (text || '').toLowerCase();

  if (t.includes('pilates')) return 'pilates';
  if (t.includes('estetica') || t.includes('estética')) return 'estetica';

  return 'default';
}

/* =========================
   FONT CONFIG
========================= */

const FONT_PAIRS = {
  pilates: {
    heading: 'Playfair Display',
    body: 'Inter',
    url: 'Playfair+Display:wght@600;700|Inter:wght@400;500;600'
  },
  default: {
    heading: 'Plus Jakarta Sans',
    body: 'Inter',
    url: 'Plus+Jakarta+Sans:wght@600;700|Inter:wght@400;500;600'
  }
};

/* =========================
   IMAGES
========================= */

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

/* =========================
   SANITIZE
========================= */

function sanitizeCode(code) {
  code = (code || '').trim();
  code = code.replace(/^\s*```[a-zA-Z]*\s*/m, '');
  code = code.replace(/\s*```\s*$/m, '');
  return code.trim();
}

/* =========================
   BASE FILES (STACKBLITZ)
========================= */

function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'lucide-react': '^0.263.1'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.0.0',
        tailwindcss: '^3.3.3',
        postcss: '^8.4.27',
        autoprefixer: '^10.4.14',
        typescript: '^5.0.2',
        vite: '^4.4.5'
      }
    }, null, 2),

    'vite.config.ts': `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
`,

    'index.html': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CodeAI</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
`,

    'src/main.tsx': `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,

    'src/index.css': `
@tailwind base;
@tailwind components;
@tailwind utilities;
body { margin: 0; }
`,

    'src/App.tsx': appCode
  };
}

/* =========================
   BUILD PROMPT
========================= */

function buildPrompt(userRequest, currentAppCode) {
  const niche = detectNiche(userRequest);
  const fonts = FONT_PAIRS[niche] || FONT_PAIRS.default;
  const images = UNSPLASH_IMAGES[niche] || UNSPLASH_IMAGES.default;

  return `
Return ONLY raw TSX code.
Start with: import React from "react"
Export: export default function App()

Use Tailwind CSS only.

Load Google Fonts:
https://fonts.googleapis.com/css2?family=${fonts.url}&display=swap

Hero background image:
${images[0]}

Create a premium landing page for:
${userRequest}
`;
}

/* =========================
   OPENROUTER
========================= */

async function callOpenRouter(prompt) {
  const response = await fetch(
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

/* =========================
   ROUTE
========================= */

app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body;

  try {
    const appCode = await callOpenRouter(
      buildPrompt(prompt, currentAppCode)
    );

    const files = getBaseFiles(appCode);

    res.json({ files, appCode });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('CodeAI running on port ' + PORT);
});
