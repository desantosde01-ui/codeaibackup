const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY not found in environment variables.");
  process.exit(1);
}

function baseProjectFiles() {
  return {
    "package.json": `{
  "name": "generated-project",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}`,
    "vite.config.js": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    "tailwind.config.js": `export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`,
    "postcss.config.js": `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Generated Project</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
    "src/main.jsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`
  };
}

function buildPrompt(userPrompt) {
  return `
You are a senior React architect.

IMPORTANT RULES:
- NEVER generate everything in a single App file.
- ALWAYS split into multiple components inside src/components/.
- ALWAYS return a valid JSON object.
- DO NOT return markdown.
- DO NOT return explanation.
- ONLY return JSON.

Architecture required:

src/
  App.jsx
  main.jsx
  index.css
  components/
    Hero.jsx
    About.jsx
    Sections.jsx
    Footer.jsx

Rules:
- App.jsx must import components
- Each section must be its own component file
- Clean, readable, modular
- TailwindCSS
- Modern UI
- Production-level code

User request:
${userPrompt}

Return format:

{
  "files": {
    "src/App.jsx": "...",
    "src/components/Hero.jsx": "...",
    "src/components/About.jsx": "...",
    "src/components/Footer.jsx": "..."
  }
}
`;
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const finalPrompt = buildPrompt(prompt);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON returned from model." });
    }

    const baseFiles = baseProjectFiles();
    const mergedFiles = {
      ...baseFiles,
      ...parsed.files
    };

    res.json({
      files: mergedFiles
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error generating project." });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
