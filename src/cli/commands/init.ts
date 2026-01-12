/**
 * weblet init command
 *
 * Scaffolds a new weblet project.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { existsSync } from "node:fs";

import type { Runtime } from "../../parser/schema.ts";
import { printError, printSuccess, printInfo } from "../index.ts";

// =============================================================================
// Types
// =============================================================================

interface InitFlags {
  name?: string;
  runtime?: string;
  template?: string;
  [key: string]: string | boolean | undefined;
}

type Template = "minimal" | "static" | "dynamic" | "agent";

// =============================================================================
// Help
// =============================================================================

const HELP = `
weblet init - Create a new weblet

Usage: weblet init [path] [options]

Arguments:
  path              Directory to create (default: current directory)

Options:
  --name <name>     App name (default: directory name)
  --runtime <rt>    Runtime: browser, bun, deno, node (default: browser)
  --template <tpl>  Template: minimal, static, dynamic, agent (default: minimal)
  --help            Show this help

Templates:
  minimal     Just APP.md and index.html (default)
  static      Adds assets directory and CSS
  dynamic     Adds serve.ts for Bun runtime
  agent       Includes agent integration boilerplate

Examples:
  weblet init my-app
  weblet init my-app --runtime bun --template dynamic
  weblet init ./games/tetris --name tetris
`.trim();

// =============================================================================
// Templates
// =============================================================================

function generateAppMd(name: string, runtime: Runtime, template: Template): string {
  const hasServer = runtime !== "browser" && template !== "minimal";

  let yaml = `---
name: ${name}
description: A Weblet application
version: 1.0.0
runtime: ${runtime}
entry: index.html`;

  if (hasServer) {
    yaml += `\nserver: serve.ts`;
  }

  if (template === "agent") {
    yaml += `

agent:
  discoverable: true
  launchable: true
  triggers:
    - user wants to use ${name}
  provides:
    - ${name}`;
  }

  yaml += `
---

# ${name}

A Weblet application.

## Getting Started

`;

  if (runtime === "browser") {
    yaml += `Open \`index.html\` in your browser.`;
  } else {
    yaml += `\`\`\`bash
${runtime === "bun" ? "bun" : runtime === "deno" ? "deno run --allow-net --allow-read" : "node"} serve.${runtime === "node" ? "js" : "ts"}
\`\`\``;
  }

  return yaml;
}

function generateIndexHtml(name: string, template: Template): string {
  const hasStyles = template !== "minimal";
  const hasAgent = template === "agent";

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>`;

  if (hasStyles) {
    html += `\n  <link rel="stylesheet" href="assets/style.css">`;
  } else {
    html += `
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
  </style>`;
  }

  html += `
</head>
<body>
  <h1>${name}</h1>
  <p>Welcome to your new Weblet!</p>`;

  if (hasAgent) {
    html += `

  <div id="agent-status"></div>

  <script type="module">
    // Check for agent context
    const ctx = window.__AGENT_CONTEXT__;
    const statusEl = document.getElementById('agent-status');

    if (ctx) {
      statusEl.innerHTML = '<p>Launched by agent: <strong>' + ctx.agent.name + '</strong></p>';

      // Example: emit event to agent
      document.body.addEventListener('click', () => {
        ctx.emit('user-interaction', { type: 'click' });
      });
    } else {
      statusEl.innerHTML = '<p><em>Running standalone (no agent)</em></p>';
    }
  </script>`;
  }

  html += `
</body>
</html>`;

  return html;
}

function generateServeTs(name: string): string {
  return `/**
 * ${name} - Server
 */

Bun.serve({
  port: process.env.PORT || 3000,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith("/api/")) {
      return handleApi(req, path);
    }

    // Static files
    const filePath = path === "/" ? "index.html" : "." + path;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    // 404
    return new Response("Not Found", { status: 404 });
  },
});

async function handleApi(req: Request, path: string): Promise<Response> {
  if (path === "/api/health") {
    return Response.json({ status: "ok" });
  }

  return Response.json({ error: "Not Found" }, { status: 404 });
}

console.log("Server running at http://localhost:" + (process.env.PORT || 3000));
`;
}

function generateStyleCss(): string {
  return `/* ${new Date().getFullYear()} - Weblet Styles */

:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #0066cc;
  --color-border: #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #f0f0f0;
    --color-primary: #66b3ff;
    --color-border: #333333;
  }
}

* {
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.6;
}

h1, h2, h3 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

a {
  color: var(--color-primary);
}

button {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  opacity: 0.9;
}
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/
bun.lockb

# Build
dist/

# Weblet runtime
.data/
.userdata/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db
`;
}

// =============================================================================
// Command
// =============================================================================

export async function initCommand(
  args: string[],
  flags: InitFlags
): Promise<void> {
  // Show help
  if (flags.help) {
    console.log(HELP);
    return;
  }

  // Determine target directory
  const targetDir = args[0] ? resolve(args[0]) : process.cwd();
  const dirName = basename(targetDir);

  // Get options
  const name = (flags.name as string) ?? dirName;
  const runtime = ((flags.runtime as string) ?? "browser") as Runtime;
  const template = ((flags.template as string) ?? "minimal") as Template;

  // Validate runtime
  const validRuntimes = ["browser", "bun", "deno", "node"];
  if (!validRuntimes.includes(runtime)) {
    printError(`Invalid runtime: ${runtime}. Use: ${validRuntimes.join(", ")}`);
    process.exit(2);
  }

  // Validate template
  const validTemplates = ["minimal", "static", "dynamic", "agent"];
  if (!validTemplates.includes(template)) {
    printError(`Invalid template: ${template}. Use: ${validTemplates.join(", ")}`);
    process.exit(2);
  }

  // Check if directory exists and has APP.md
  if (existsSync(join(targetDir, "APP.md"))) {
    printError(`APP.md already exists in ${targetDir}`);
    process.exit(1);
  }

  // Create directory if needed
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
    printInfo(`Created directory: ${targetDir}`);
  }

  // Determine actual runtime based on template
  const actualRuntime: Runtime =
    template === "dynamic" || template === "agent" ? "bun" : runtime;

  // Generate files
  const files: Array<{ path: string; content: string }> = [];

  // APP.md
  files.push({
    path: "APP.md",
    content: generateAppMd(name, actualRuntime, template),
  });

  // index.html
  files.push({
    path: "index.html",
    content: generateIndexHtml(name, template),
  });

  // serve.ts (for dynamic/agent templates or bun runtime)
  if (template === "dynamic" || template === "agent" || actualRuntime === "bun") {
    files.push({
      path: "serve.ts",
      content: generateServeTs(name),
    });
  }

  // assets/style.css (for static/dynamic/agent templates)
  if (template !== "minimal") {
    files.push({
      path: "assets/style.css",
      content: generateStyleCss(),
    });
  }

  // .gitignore
  files.push({
    path: ".gitignore",
    content: generateGitignore(),
  });

  // Write files
  for (const file of files) {
    const filePath = join(targetDir, file.path);
    const fileDir = join(targetDir, file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "");

    if (fileDir !== targetDir && !existsSync(fileDir)) {
      await mkdir(fileDir, { recursive: true });
    }

    await writeFile(filePath, file.content);
    printSuccess(`Created ${file.path}`);
  }

  // Done
  console.log("");
  printSuccess(`Weblet '${name}' created!`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${args[0] ?? "."}`);

  if (actualRuntime === "browser") {
    console.log("  open index.html");
  } else {
    console.log("  bun serve.ts");
  }

  console.log("");
}
