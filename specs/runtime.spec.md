# Runtime Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0, Sections 5-6

---

## 1. Overview

The Weblet Runtime is responsible for executing weblets based on their declared runtime type. For Bun (the reference runtime), this includes server initialization, static file serving, API route handling, and TypeScript/JSX transpilation. The runtime reads configuration from APP.md and provides a consistent execution environment.

---

## 2. Requirements

### 2.1 Functional Requirements

#### Server Initialization

- **FR-RT-001**: The runtime SHALL read server configuration from APP.md manifest
- **FR-RT-002**: The runtime SHALL start a server on the port specified in APP.md (default: 3000)
- **FR-RT-003**: The runtime SHALL detect port conflicts and report errors with available alternatives
- **FR-RT-004**: The runtime SHALL support PORT environment variable override
- **FR-RT-005**: The runtime SHALL execute the `server` entry point for non-browser runtimes
- **FR-RT-006**: The runtime SHALL support `bun --serve .` mode for simple static + TypeScript serving

#### Static File Serving

- **FR-STATIC-001**: The runtime SHALL serve the `entry` file (default: index.html) at the root path `/`
- **FR-STATIC-002**: The runtime SHALL serve files in `/assets/` at `/assets/*` paths
- **FR-STATIC-003**: The runtime SHALL set appropriate Content-Type headers based on file extension
- **FR-STATIC-004**: The runtime SHALL return 404 for non-existent static files
- **FR-STATIC-005**: The runtime SHALL support SPA fallback mode (serve index.html for unmatched routes)
- **FR-STATIC-006**: The runtime SHALL serve files with correct cache headers (ETag, Last-Modified)

#### API Route Handling

- **FR-API-001**: The runtime SHALL map files in `/api/` directory to route handlers
- **FR-API-002**: The runtime SHALL support HTTP methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **FR-API-003**: The runtime SHALL parse JSON request bodies automatically
- **FR-API-004**: The runtime SHALL support path parameters (e.g., `/api/users/[id].ts`)
- **FR-API-005**: The runtime SHALL return JSON responses with correct Content-Type
- **FR-API-006**: The runtime SHALL support middleware patterns

#### TypeScript/JSX Support

- **FR-TS-001**: The runtime SHALL transpile TypeScript files on-the-fly (Bun native)
- **FR-TS-002**: The runtime SHALL transpile JSX/TSX files on-the-fly (Bun native)
- **FR-TS-003**: The runtime SHALL serve transpiled JS with source maps in development
- **FR-TS-004**: The runtime SHALL support import maps for bare specifiers

#### Runtime Modes

- **FR-MODE-001**: The runtime SHALL support `browser` mode (static only, no server required)
- **FR-MODE-002**: The runtime SHALL support `bun` mode (Bun.serve with full capabilities)
- **FR-MODE-003**: The runtime SHALL support `deno` mode (Deno.serve equivalent)
- **FR-MODE-004**: The runtime SHALL support `node` mode (http/express server)

### 2.2 Non-Functional Requirements

- **NFR-RT-001**: The server SHALL start in under 500ms for typical weblets
- **NFR-RT-002**: The server SHALL handle 100 concurrent connections minimum
- **NFR-RT-003**: Static file serving SHALL use streaming for files > 1MB
- **NFR-RT-004**: The server SHALL gracefully shutdown within 5 seconds on SIGTERM
- **NFR-RT-005**: Memory usage SHALL not exceed 100MB for idle server

---

## 3. Interface

### 3.1 Server Configuration (from APP.md)

```typescript
interface ServerConfig {
  runtime: "browser" | "bun" | "deno" | "node";
  entry: string;       // Browser entry point (default: "index.html")
  server?: string;     // Server entry point (e.g., "serve.ts")
  port: number;        // Default: 3000
}
```

### 3.2 Bun Server Implementation

```typescript
// serve.ts - Reference implementation structure
import { serve, file } from "bun";

interface WebletServer {
  start(config: ServerConfig): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
}

// Minimal server
Bun.serve({
  port: config.port,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith("/api/")) {
      return handleApiRoute(req, path);
    }

    // Static files
    if (path.startsWith("/assets/")) {
      return serveStaticFile(path);
    }

    // SPA fallback
    return new Response(Bun.file(config.entry));
  },

  error(error: Error): Response {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
});
```

### 3.3 API Route Handler Signature

```typescript
// api/users.ts
export async function GET(req: Request): Promise<Response> {
  const users = await getUsers();
  return Response.json(users);
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();
  const user = await createUser(body);
  return Response.json(user, { status: 201 });
}

// api/users/[id].ts - Path parameters
export async function GET(req: Request, params: { id: string }): Promise<Response> {
  const user = await getUser(params.id);
  if (!user) {
    return new Response("Not Found", { status: 404 });
  }
  return Response.json(user);
}
```

### 3.4 Middleware Interface

```typescript
type Middleware = (
  req: Request,
  next: () => Promise<Response>
) => Promise<Response>;

// Example: logging middleware
const logMiddleware: Middleware = async (req, next) => {
  const start = Date.now();
  const response = await next();
  console.log(`${req.method} ${req.url} - ${Date.now() - start}ms`);
  return response;
};
```

---

## 4. Behavior

### 4.1 Server Startup Sequence

1. Parse APP.md to extract server configuration
2. Validate entry file exists
3. If server file specified, validate it exists
4. Check if port is available
5. Initialize storage directories (`.data/`, `.userdata/`)
6. Load environment variables from `.env` if present
7. Start HTTP server
8. Log startup message: `Server running at http://localhost:{port}`
9. If `--open` flag, launch browser

### 4.2 Request Handling Flow

```
Request →
  1. Parse URL and method
  2. Check if API route (/api/*)
     → Yes: Load handler, execute, return response
     → No: Continue
  3. Check if static file (/assets/* or explicit file)
     → Yes: Serve file with headers
     → No: Continue
  4. SPA fallback: Serve entry file
```

### 4.3 API Route Resolution

Files in `/api/` map to routes:

| File | Route | Methods |
|------|-------|---------|
| `api/health.ts` | `/api/health` | Exports: GET, POST, etc. |
| `api/users.ts` | `/api/users` | Exports: GET, POST, etc. |
| `api/users/[id].ts` | `/api/users/:id` | Path param: `id` |
| `api/posts/[slug]/comments.ts` | `/api/posts/:slug/comments` | Path param: `slug` |

### 4.4 Content-Type Mapping

| Extension | Content-Type |
|-----------|--------------|
| `.html` | `text/html; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.ts` | `text/javascript; charset=utf-8` (transpiled) |
| `.json` | `application/json` |
| `.svg` | `image/svg+xml` |
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.woff2` | `font/woff2` |
| `.woff` | `font/woff` |

### 4.5 Graceful Shutdown

1. Stop accepting new connections
2. Wait for in-flight requests to complete (max 5 seconds)
3. Close database/file handles
4. Log shutdown message
5. Exit with code 0 (or 130 if SIGINT)

---

## 5. Error Handling

### 5.1 HTTP Error Responses

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Invalid JSON body | `{ "error": "Invalid JSON" }` |
| 404 | Route/file not found | `{ "error": "Not Found" }` |
| 405 | Method not allowed | `{ "error": "Method Not Allowed" }` |
| 500 | Server error | `{ "error": "Internal Server Error" }` |

### 5.2 Startup Errors

| Error | Handling |
|-------|----------|
| Port in use | Suggest alternative ports, exit code 4 |
| Entry file missing | Log error, exit code 3 |
| Server file syntax error | Log error with line number, exit code 3 |
| Permission denied | Log error, exit code 4 |

### 5.3 Runtime Errors

- Uncaught exceptions: Log stack trace, return 500 response
- Async rejection: Log error, return 500 response
- Timeout: Return 504 after 30 seconds

---

## 6. Dependencies

- **cli.spec.md**: Runtime is invoked by CLI `weblet run` command
- **storage.spec.md**: Runtime initializes storage directories
- **dependencies.spec.md**: Runtime uses resolved import maps

---

## 7. Acceptance Criteria

- [ ] AC-001: Server starts on configured port within 500ms
- [ ] AC-002: index.html is served at root path `/`
- [ ] AC-003: Files in `/assets/` are served with correct Content-Type
- [ ] AC-004: TypeScript files are transpiled and served as JavaScript
- [ ] AC-005: API routes in `/api/` directory are automatically mapped
- [ ] AC-006: Path parameters in routes (e.g., `[id]`) are parsed correctly
- [ ] AC-007: 404 is returned for non-existent routes
- [ ] AC-008: Server gracefully shuts down on SIGTERM
- [ ] AC-009: PORT environment variable overrides config
- [ ] AC-010: Server handles 100 concurrent requests without errors

---

## 8. Test Scenarios

### TS-RT-001: Serve Static HTML
```
Given a weblet with index.html containing "<h1>Hello</h1>"
When I request GET /
Then response status is 200
And Content-Type is "text/html; charset=utf-8"
And body contains "<h1>Hello</h1>"
```

### TS-RT-002: Serve Assets with Correct MIME Type
```
Given a weblet with assets/style.css
When I request GET /assets/style.css
Then response status is 200
And Content-Type is "text/css; charset=utf-8"
```

### TS-RT-003: API Route Handling
```
Given a weblet with api/health.ts exporting GET function
When I request GET /api/health
Then response status is 200
And Content-Type is "application/json"
```

### TS-RT-004: API Path Parameters
```
Given a weblet with api/users/[id].ts
When I request GET /api/users/123
Then the handler receives params.id = "123"
```

### TS-RT-005: 404 for Missing Files
```
Given a weblet with only index.html
When I request GET /nonexistent.html
Then response status is 404
```

### TS-RT-006: SPA Fallback Mode
```
Given a weblet with entry: index.html and SPA mode enabled
When I request GET /any/deep/path
Then response status is 200
And body is contents of index.html
```

### TS-RT-007: TypeScript Transpilation
```
Given a weblet with src/app.ts containing TypeScript
When I request GET /src/app.ts
Then response status is 200
And Content-Type is "text/javascript"
And body contains transpiled JavaScript (no type annotations)
```

### TS-RT-008: Port Conflict Detection
```
Given port 3000 is already in use
When I start a weblet configured for port 3000
Then an error is logged with message containing "Port 3000 is already in use"
And the server does not start
```

### TS-RT-009: Environment Variable Override
```
Given a weblet configured for port 3000
When I set PORT=8080 and start the weblet
Then the server starts on port 8080
```

### TS-RT-010: Graceful Shutdown
```
Given a running weblet server with an in-flight request
When I send SIGTERM
Then the in-flight request completes successfully
And the server shuts down
And no new requests are accepted
```
