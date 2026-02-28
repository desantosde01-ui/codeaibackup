// server.js
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // required
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // optional (only for /api/image)

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ─────────────────────────────────────────────────────────────────────────────
   PLACEHOLDER CONTRACT (App.tsx MUST use these exact strings)
───────────────────────────────────────────────────────────────────────────── */
const PLACEHOLDERS = [
  "__IMG_HERO_BG__",
  "__IMG_ABOUT__",
  "__IMG_TEAM__",
  "__IMG_CTA_BG__",

  "__IMG_GALLERY_1__",
  "__IMG_GALLERY_2__",
  "__IMG_GALLERY_3__",
  "__IMG_GALLERY_4__",
  "__IMG_GALLERY_5__",

  "__IMG_BENEFIT_1__",
  "__IMG_BENEFIT_2__",
  "__IMG_BENEFIT_3__",
  "__IMG_BENEFIT_4__",
  "__IMG_BENEFIT_5__",

  "__IMG_EXERCISE_1__",
  "__IMG_EXERCISE_2__",
  "__IMG_EXERCISE_3__",
];

/* ─────────────────────────────────────────────────────────────────────────────
   Utilities
───────────────────────────────────────────────────────────────────────────── */
function sanitizeText(txt) {
  if (typeof txt !== "string") return "";
  let code = txt.trim();

  // remove fences if model ignores instruction
  code = code.replace(/^```[a-zA-Z]*\n/, "");
  code = code.replace(/\n```$/, "");
  code = code.trim();

  // normalize “smart quotes” and dashes
  code = code
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u00A0/g, " ");

  return code;
}

// Try hard to extract JSON object from a model response.
// If it fails, we throw and handle with fallback flow (non-JSON).
function extractJsonObject(raw) {
  const s = sanitizeText(raw);

  // direct parse
  try {
    return JSON.parse(s);
  } catch (_) {}

  // find a JSON-like block
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const slice = s.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch (_) {}
  }

  throw new Error("Model did not return valid JSON.");
}

// simple stable hash for seeds
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Build Pollinations image URL (free test)
function pollinationsUrl(prompt, opts = {}) {
  const width = Number(opts.width || 1400);
  const height = Number(opts.height || 900);
  const seed = Number.isFinite(opts.seed) ? opts.seed : hash32(String(prompt));
  const safePrompt = encodeURIComponent(String(prompt || "").slice(0, 800));
  return `https://image.pollinations.ai/prompt/${safePrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

function buildImageUrlMap(imagePrompts, userRequest) {
  const map = {};
  const prompts = imagePrompts && typeof imagePrompts === "object" ? imagePrompts : {};

  const baseStyle =
    "high-end premium realistic photo, cinematic lighting, natural colors, shallow depth of field, no text, no watermark, ultra detailed";

  const fallbackPromptFor = (ph) => {
    const theme = String(userRequest || "premium website").slice(0, 200);
    if (ph === "__IMG_HERO_BG__") return `${theme}. hero background scene. ${baseStyle}. wide angle.`;
    if (ph.startsWith("__IMG_GALLERY_")) return `${theme}. gallery photo. ${baseStyle}.`;
    if (ph.startsWith("__IMG_BENEFIT_")) return `${theme}. concept photo illustrating a key benefit. ${baseStyle}.`;
    if (ph.startsWith("__IMG_EXERCISE_")) return `${theme}. exercise demo action shot. ${baseStyle}.`;
    if (ph === "__IMG_ABOUT__") return `${theme}. about section photo, welcoming environment. ${baseStyle}.`;
    if (ph === "__IMG_TEAM__") return `${theme}. professional team portrait. ${baseStyle}.`;
    if (ph === "__IMG_CTA_BG__") return `${theme}. abstract soft background texture. ${baseStyle}.`;
    return `${theme}. ${baseStyle}.`;
  };

  for (const ph of PLACEHOLDERS) {
    const p = typeof prompts[ph] === "string" && prompts[ph].trim() ? prompts[ph].trim() : fallbackPromptFor(ph);

    let w = 1400, h = 900;
    if (ph === "__IMG_HERO_BG__") { w = 1800; h = 1100; }
    if (ph === "__IMG_CTA_BG__") { w = 1600; h = 900; }
    if (ph.startsWith("__IMG_GALLERY_")) { w = 1200; h = 900; }
    if (ph.startsWith("__IMG_BENEFIT_")) { w = 1200; h = 900; }
    if (ph.startsWith("__IMG_EXERCISE_")) { w = 1200; h = 800; }
    if (ph === "__IMG_TEAM__") { w = 1200; h = 900; }
    if (ph === "__IMG_ABOUT__") { w = 1400; h = 1000; }

    map[ph] = pollinationsUrl(p, { width: w, height: h, seed: hash32(ph + "|" + p) });
  }

  return map;
}

function injectImagesIntoAppCode(appCode, imageUrlMap) {
  let code = String(appCode || "");
  for (const [ph, url] of Object.entries(imageUrlMap || {})) {
    const safeUrl = String(url).replace(/"/g, "%22");
    code = code.split(ph).join(safeUrl);
  }
  return code;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Base Files (Vite + React + TS + Tailwind)
───────────────────────────────────────────────────────────────────────────── */
function getBaseFiles(appCode) {
  return {
    "package.json": JSON.stringify(
      {
        name: "codeai-project",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0", "lucide-react": "^0.263.1" },
        devDependencies: {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "@vitejs/plugin-react": "^4.0.0",
          autoprefixer: "^10.4.14",
          postcss: "^8.4.27",
          tailwindcss: "^3.3.3",
          typescript: "^5.0.2",
          vite: "^4.4.5",
        },
      },
      null,
      2
    ),
    "vite.config.ts":
      "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })",
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: false,
        },
        include: ["src"],
      },
      null,
      2
    ),
    "tsconfig.node.json": JSON.stringify(
      {
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: "ESNext",
          moduleResolution: "bundler",
          allowSyntheticDefaultImports: true,
        },
        include: ["vite.config.ts"],
      },
      null,
      2
    ),
    "postcss.config.js": "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }",
    "tailwind.config.js":
      "export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }",
    "index.html":
      "<!DOCTYPE html>\n<html lang='en'>\n  <head>\n    <meta charset='UTF-8' />\n    <meta name='viewport' content='width=device-width, initial-scale=1.0' />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id='root'></div>\n    <script type='module' src='/src/main.tsx'></script>\n  </body>\n</html>",
    "src/main.tsx":
      "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n",
    "src/index.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }",
    "src/App.tsx": appCode,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   OpenRouter Call
───────────────────────────────────────────────────────────────────────────── */
async function callOpenRouter(messages, maxTokens = 14000) {
  if (!OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY env var.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENROUTER_API_KEY,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    let errMsg = "OpenRouter error " + response.status;
    try {
      const err = await response.json();
      errMsg = err?.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return sanitizeText(content);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Anthropic Vision (optional)
───────────────────────────────────────────────────────────────────────────── */
async function callAnthropicVision(image, mediaType, prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY env var (required for /api/image).");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    let errMsg = "Anthropic error " + response.status;
    try {
      const err = await response.json();
      errMsg = err?.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const txt = data?.content?.[0]?.text || "";
  return sanitizeText(txt);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Prompt Builders (ROBUST: JSON-first, then fallback)
───────────────────────────────────────────────────────────────────────────── */
function placeholderContractText() {
  return [
    "IMAGE CONTRACT:",
    "- You MUST NOT use any http/https image URLs in App.tsx.",
    "- You MUST use ONLY these placeholders for images (exact strings):",
    "  " + PLACEHOLDERS.join(", "),
    "- Every visible image in the UI must use one of these placeholders.",
    "- Hero background MUST use __IMG_HERO_BG__.",
    "- Gallery uses __IMG_GALLERY_1__..__IMG_GALLERY_5__.",
    "- Benefit images use __IMG_BENEFIT_1__..__IMG_BENEFIT_5__.",
    "- Exercise images use __IMG_EXERCISE_1__..__IMG_EXERCISE_3__.",
    "- About/team/cta: __IMG_ABOUT__, __IMG_TEAM__, __IMG_CTA_BG__.",
  ].join("\n");
}

function appCodeRulesText() {
  return [
    "CODE RULES:",
    '- Start with: import React from "react"',
    "- Export: export default function App()",
    "- Use React + TypeScript + Tailwind classes only",
    "- No external imports besides react and lucide-react",
    "- No markdown fences/backticks",
    "- Use only ASCII characters in JSX text and strings",
    "- Close all strings and JSX tags properly",
  ].join("\n");
}

function buildGenerateJsonPrompt(userRequest, currentAppCode) {
  const isModify = !!(currentAppCode && String(currentAppCode).trim());

  const jsonRule = [
    "OUTPUT FORMAT (STRICT): Return ONE valid JSON object only. No markdown, no commentary.",
    "The JSON must have:",
    '- "appCode": a STRING with the complete App.tsx TSX code',
    '- "imagePrompts": an OBJECT mapping placeholder => prompt text',
    "Example:",
    '{ "appCode": "import React from \\"react\\"... ", "imagePrompts": { "__IMG_HERO_BG__": "..." } }',
  ].join("\n");

  if (isModify) {
    return [
      "You are a senior React + TypeScript + Tailwind expert.",
      jsonRule,
      appCodeRulesText(),
      placeholderContractText(),
      "",
      "IMPORTANT: You are EDITING an existing App.tsx. Keep structure and style unless requested.",
      "",
      "=== CURRENT App.tsx ===",
      String(currentAppCode),
      "=== END ===",
      "",
      "USER REQUEST:",
      String(userRequest || ""),
      "",
      "Return the JSON now.",
    ].join("\n");
  }

  return [
    "You are a world-class UI/UX designer and React developer creating agency-quality websites.",
    jsonRule,
    appCodeRulesText(),
    placeholderContractText(),
    "",
    "DESIGN REQUIREMENTS:",
    "- Hero: full-screen, strong typography, premium feel",
    "- Sections: generous spacing (py-24), smooth hover transitions",
    "- Cards: hover:scale-105 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300",
    "- Buttons: primary + outline with clear hover states",
    "- Make it look like a real premium website (no empty boxes)",
    "",
    "USER REQUEST:",
    String(userRequest || ""),
    "",
    "Return the JSON now.",
  ].join("\n");
}

// Fallback: ask ONLY for App.tsx (no JSON)
function buildAppOnlyPrompt(userRequest, currentAppCode) {
  const isModify = !!(currentAppCode && String(currentAppCode).trim());

  if (isModify) {
    return [
      "You are a senior React + TypeScript + Tailwind expert.",
      appCodeRulesText(),
      placeholderContractText(),
      "",
      "IMPORTANT: You are EDITING an existing App.tsx. Make ONLY the requested change and keep everything else intact.",
      "",
      "=== CURRENT App.tsx ===",
      String(currentAppCode),
      "=== END ===",
      "",
      "USER REQUEST:",
      String(userRequest || ""),
      "",
      "Return ONLY the complete App.tsx code. No markdown. No explanation.",
    ].join("\n");
  }

  return [
    "You are a world-class UI/UX designer and React developer creating agency-quality websites.",
    appCodeRulesText(),
    placeholderContractText(),
    "",
    "DESIGN REQUIREMENTS:",
    "- Hero: full-screen, strong typography, premium feel",
    "- Sections: generous spacing (py-24), smooth hover transitions",
    "- Cards: hover:scale-105 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300",
    "- Buttons: primary + outline with clear hover states",
    "- Make it look like a real premium website (no empty boxes)",
    "",
    "USER REQUEST:",
    String(userRequest || ""),
    "",
    "Return ONLY the complete App.tsx code. No markdown. No explanation.",
  ].join("\n");
}

// Fallback: ask ONLY for imagePrompts JSON mapping
function buildImagePromptsOnlyPrompt(userRequest, appCode) {
  const jsonOnly = [
    "OUTPUT FORMAT (STRICT): Return ONE valid JSON object only. No markdown, no commentary.",
    "Return an object mapping EACH placeholder to a concise image generation prompt:",
    "{",
    '  "__IMG_HERO_BG__": "...",',
    '  "__IMG_ABOUT__": "...",',
    "  ...",
    "}",
    "You MUST include ALL placeholders listed below (exact keys).",
    "Use realistic photography prompts, premium look, no text, no watermark.",
    "Placeholders:",
    PLACEHOLDERS.join(", "),
  ].join("\n");

  return [
    "You are an expert creative director and prompt engineer.",
    jsonOnly,
    "",
    "Context user request:",
    String(userRequest || ""),
    "",
    "Context App.tsx (for style):",
    String(appCode || "").slice(0, 6000),
    "",
    "Return the JSON now.",
  ].join("\n");
}

/* ─────────────────────────────────────────────────────────────────────────────
   Robust generator: JSON-first with retry, then fallback 2-step
───────────────────────────────────────────────────────────────────────────── */
async function robustGenerate(prompt, currentAppCode) {
  // 1) Try JSON approach twice (models sometimes comply on retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await callOpenRouter([{ role: "user", content: buildGenerateJsonPrompt(prompt, currentAppCode) }]);
    try {
      const parsed = extractJsonObject(raw);
      const appCodeRaw = typeof parsed.appCode === "string" ? parsed.appCode : "";
      if (!appCodeRaw.trim()) throw new Error('Invalid JSON: missing "appCode".');

      const imagePrompts = parsed.imagePrompts && typeof parsed.imagePrompts === "object" ? parsed.imagePrompts : {};
      return { appCodeRaw, imagePrompts, mode: "json" };
    } catch (e) {
      if (attempt === 2) break;
      // continue retry
    }
  }

  // 2) Fallback: ask for App.tsx only (no JSON)
  const appCodeRaw = await callOpenRouter([{ role: "user", content: buildAppOnlyPrompt(prompt, currentAppCode) }]);

  // 3) Fallback: ask for image prompts JSON only
  let imagePrompts = {};
  try {
    const imgRaw = await callOpenRouter([{ role: "user", content: buildImagePromptsOnlyPrompt(prompt, appCodeRaw) }], 4000);
    imagePrompts = extractJsonObject(imgRaw);
  } catch (_) {
    imagePrompts = {};
  }

  return { appCodeRaw, imagePrompts, mode: "fallback" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Routes
───────────────────────────────────────────────────────────────────────────── */
app.post("/api/generate", async (req, res) => {
  const { prompt, currentAppCode } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  try {
    const { appCodeRaw, imagePrompts, mode } = await robustGenerate(prompt, currentAppCode);

    const imageUrlMap = buildImageUrlMap(imagePrompts, prompt);
    const finalAppCode = injectImagesIntoAppCode(appCodeRaw, imageUrlMap);

    const files = getBaseFiles(finalAppCode);
    res.json({ files, appCode: finalAppCode, imageUrlMap, mode });
  } catch (err) {
    console.error("/api/generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/image", async (req, res) => {
  const { image, mediaType, prompt } = req.body || {};
  if (!image) return res.status(400).json({ error: "Image required" });

  const visionPrompt = [
    "You are a senior React + TypeScript + Tailwind CSS expert.",
    "Analyze this design and recreate it as a complete App.tsx.",
    "",
    appCodeRulesText(),
    "",
    placeholderContractText(),
    "",
    prompt ? "ADDITIONAL USER NOTES: " + String(prompt) : "",
    "",
    "Return ONLY the complete App.tsx code. No markdown. No explanation.",
  ].join("\n");

  try {
    const appCodeRaw = await callAnthropicVision(image, mediaType || "image/png", visionPrompt);

    // For vision route, we still build URL map from prompt (fallback prompts if missing)
    const imageUrlMap = buildImageUrlMap({}, prompt || "website design");
    const finalAppCode = injectImagesIntoAppCode(appCodeRaw, imageUrlMap);

    const files = getBaseFiles(finalAppCode);
    res.json({ files, appCode: finalAppCode, imageUrlMap });
  } catch (err) {
    console.error("/api/image error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { prompt, code } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const fullPrompt =
    "You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n" +
    (code ? "Current code:\n" + code + "\n\nRequest: " + prompt : String(prompt));

  try {
    const result = await callOpenRouter([{ role: "user", content: fullPrompt }], 6000);
    res.json({ result: result.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim() });
  } catch (err) {
    console.error("/api/chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function () {
  console.log("CodeAI running on port " + PORT);
});
