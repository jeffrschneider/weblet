/**
 * Counter App Server
 *
 * Serves the counter app with TypeScript transpilation via Bun.
 */

const PORT = 3001;

Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Serve TypeScript files as JavaScript (transpiled)
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      const filePath = `.${path}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const transpiler = new Bun.Transpiler({ loader: "ts" });
        const source = await file.text();
        const result = transpiler.transformSync(source);
        return new Response(result, {
          headers: { "Content-Type": "text/javascript; charset=utf-8" },
        });
      }
    }

    // Serve CSS files
    if (path.endsWith(".css")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/css; charset=utf-8" },
        });
      }
    }

    // Serve static files from /assets
    if (path.startsWith("/assets/")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    // Serve src files (TypeScript transpiled)
    if (path.startsWith("/src/")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        if (path.endsWith(".ts") || path.endsWith(".tsx")) {
          const transpiler = new Bun.Transpiler({ loader: "ts" });
          const source = await file.text();
          const result = transpiler.transformSync(source);
          return new Response(result, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response(file, {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }
    }

    // Default: serve index.html
    if (path === "/" || path === "/index.html") {
      return new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 404 for everything else
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Counter app running at http://localhost:${PORT}`);
