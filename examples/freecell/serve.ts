/**
 * Freecell Server
 *
 * Serves the Freecell game with TypeScript transpilation via Bun.
 */

const PORT = 3002;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}

Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    let path = url.pathname;

    // Handle root
    if (path === "/" || path === "/index.html") {
      return new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Remove leading slash for file path
    const filePath = `.${path}`;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      // Transpile TypeScript files
      if (path.endsWith(".ts") || path.endsWith(".tsx")) {
        const transpiler = new Bun.Transpiler({ loader: "ts" });
        const source = await file.text();
        const result = transpiler.transformSync(source);
        return new Response(result, {
          headers: { "Content-Type": "text/javascript; charset=utf-8" },
        });
      }

      return new Response(file, {
        headers: { "Content-Type": getMimeType(path) },
      });
    }

    // 404 for everything else
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Freecell running at http://localhost:${PORT}`);
