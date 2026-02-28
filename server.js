const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function sanitizeCode(code) {
  if (!code) return '';
  code = code.trim();
  code = code.replace(/^```[a-zA-Z]*\n/, '');
  code = code.replace(/\n```$/, '');
  code = code.trim();
  return code;
}

function generateTestImage(prompt) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}`;
}

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

    'vite.config.ts': `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
`,

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

    'postcss.config.js': `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,

    'tailwind.config.js': `
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
`,

    'index.html': `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CodeAI App</title>
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
  </React.StrictMode>,
)
`,

    'src/index.css': `
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; }
`,

    'src/App.tsx': appCode
  };
}

function buildPrompt(userRequest) {
  return `
You are a world-class React + TypeScript + Tailwind developer.

Return STRICT JSON in this format:

{
  "appCode": "complete TSX code here",
  "imagePrompts": {
    "hero": "image prompt in english",
    "image1": "image prompt in english",
    "image2": "image prompt in english"
  }
}

RULES:

- appCode must start with: import React from "react"
- Export default function App()
- Use Tailwind only
- NO markdown
- NO backticks
- Use placeholders exactly:
  "__HERO_IMAGE__"
  "__IMAGE_1__"
  "__IMAGE_2__"
- Hero section must use __HERO_IMAGE__
- Other sections must use __IMAGE_1__ and __IMAGE_2__
- imagePrompts must be professional photography prompts in English
- Include lighting, mood and style in image prompts
- Return ONLY JSON

Create a premium website for:

${userRequest}
`;
}

async function callOpenRouter(prompt) {
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
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const raw = await callOpenRouter(buildPrompt(prompt));

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('Model did not return valid JSON.');
    }

    let { appCode, imagePrompts } = parsed;

    if (!appCode || !imagePrompts) {
      throw new Error('Invalid model response structure.');
    }

    const heroUrl = generateTestImage(imagePrompts.hero);
    const image1Url = generateTestImage(imagePrompts.image1);
    const image2Url = generateTestImage(imagePrompts.image2);

    appCode = appCode
      .replace(/__HERO_IMAGE__/g, heroUrl)
      .replace(/__IMAGE_1__/g, image1Url)
      .replace(/__IMAGE_2__/g, image2Url);

    const files = getBaseFiles(appCode);

    res.json({ files, appCode });

  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('CodeAI running on port ' + PORT);
});
