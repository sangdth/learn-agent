# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo intent

`learn-agent` is a learning sandbox for building an AI agent on top of [Hono](https://hono.dev). It runs on **Bun** (>= 1.1) — Bun is the runtime, package manager, bundler, and test loader for Vitest.

## Commands

This project uses **Bun** (see `bun.lock`). All scripts run via `bun run <script>` or directly as `bun <file>`.

| Task                              | Command              |
| --------------------------------- | -------------------- |
| Install deps                      | `bun install`        |
| Dev server (watch mode)           | `bun dev`            |
| Run `src/index.ts` directly       | `bun start`          |
| Bundle to `dist/index.js`         | `bun run build`      |
| Type-check (`tsc --noEmit`)       | `bun run typecheck`  |
| Run tests once (Vitest)           | `bun run test`       |
| Run tests in watch mode           | `bun run test:watch` |

**⚠️ Use `bun run test`, not `bun test`.** `bun test` triggers Bun's native test runner, which doesn't understand `vi.mock` / `vi.hoisted` and will error out. The `run` prefix routes through the npm-script layer and invokes `vitest run`.

The dev server listens on `http://localhost:3000`. `.env` is auto-loaded by Bun — no `--env-file` flag, no `dotenv` dependency.

Tests live alongside source as `*.test.ts`. They run under Vitest (not `bun test` — the suite uses `vi.mock` / `vi.hoisted`). Vitest is excluded from `tsc`'s type-check output.

## Architecture

The app is layered. Request flow:

```
client → index.ts  (logger → cors → requestId → routes → onError/notFound)
           └─ /v1/chat → routes/chat.ts  (zValidator → chat-mapping → SSE/JSON)
                                └─ services/chat-service.ts  (toAgentMessages → mastra agent)
                                                            └─ mastra/agents/default-agent.ts  (env → Agent)
```

- **Entrypoint (`src/index.ts`):** Builds the app via `createRouter()` so `Variables` is typed, applies global middleware in order (`logger`, `cors`, `requestId`), exposes `GET /healthz`, mounts route groups with `app.route()`, then calls `registerErrorHandler(app)` which wires both `onError` and `notFound`. Exports named `app` (for tests) plus a default `{ port, fetch }` object that Bun auto-serves when the file is the CLI entrypoint.
- **Router factory (`src/utils/create-router.ts`):** `createRouter()` returns `new Hono<{ Variables: { requestId: string } }>()`. Every sub-router uses it so `c.get('requestId')` is typed everywhere.
- **Middleware (`src/middleware/`):** `requestId` reads `x-request-id` (or generates a UUID), stores it in context, mirrors it back in the response header.
- **Config (`src/config/env.ts`):** Single Zod schema parses `process.env` at module load. `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `DEFAULT_MODEL`, `PORT`, `NODE_ENV`. Failures throw one aggregated error naming every missing/invalid field.
- **Service layer (`src/services/chat-service.ts`):** `createChatService(agent)` returns `{ generate, stream }`. Moves `toAgentMessages` / `lastUserContent` out of the route. A lazy `getChatService()` returns the singleton wired to the default Mastra agent. Tests mock this module.
- **Mastra layer (`src/mastra/`):** `default-agent.ts` reads from `env` and builds one `Agent` (OpenAI-compatible model config). `index.ts` registers it on a `Mastra` instance and exposes `getDefaultAgent()`.
- **Chat route (`src/routes/chat.ts`):** Validates the OpenAI-shaped request with `zValidator`, delegates to `getChatService()`, and translates outputs into OpenAI `chat.completion` / `chat.completion.chunk` SSE frames via pure helpers in `src/routes/chat-mapping.ts`. Streaming errors emit a terminal `{ error: {...} }` SSE frame + `[DONE]` because `onError` can't reach an already-open stream.
- **Error handling (`src/utils/error-handler.ts`):** `registerErrorHandler(app)` attaches `onError` and `notFound`. Errors map to `{ error: { code, message, requestId } }`. `HTTPException` → its own status, `ZodError` → 400 `validation_error`, everything else → 500 `internal_error` with a generic message (never leaks `err.message`).
- **Runtime:** Bun's native `Bun.serve` — picked up automatically from the default export of `src/index.ts`. `bun --watch` handles dev reload; `bun build` emits a single minified `dist/index.js` for `bun start` in prod.

### Response envelopes

- **Success:** route-specific (OpenAI-shaped for `/v1/chat/completions`, `{ ok: true }` for `/healthz`).
- **Error (JSON):** `{ "error": { "code": "<machine_code>", "message": "<human>", "requestId": "<uuid>" } }`.
- **Error (streaming SSE):** after the stream opens, a terminal data frame with the same `{ error: {...} }` shape, followed by `data: [DONE]`.
- Every response carries the `x-request-id` header (echoing the incoming one or a generated UUID).

## Environment variables

Copy `.env.example` → `.env` and fill in:

- `OPENCODE_API_KEY` — required. Used as the Bearer token against the OpenAI-compatible endpoint. Get one at https://opencode.ai/auth, or use any placeholder for local servers that don't authenticate.
- `OPENCODE_BASE_URL` — required. Defaults to `https://opencode.ai/zen/v1` in `.env.example`. Point at vLLM / LM Studio / LiteLLM / any OpenAI-compatible `/chat/completions` server to switch backends.
- `DEFAULT_MODEL` — required, `provider/model` shape (e.g. `opencode/qwen3.5-plus`). Validated at startup.
- `PORT` — optional, defaults to 3000.

`src/config/env.ts` is the single source of truth — a Zod schema over `process.env`, parsed at module load. On failure it throws one aggregated error naming every missing/invalid field. Everything else (`default-agent.ts`, `index.ts`) imports typed values from there; no module reads `process.env` directly.

### Model field caveat

The request's `model` field is **echoed back** in the response `model` field but does **not** change routing — the actual model is always `DEFAULT_MODEL`. Restart the server to switch. Dynamic per-request model routing is out of scope until the sandbox needs it.

### Swapping backend

Because the agent uses Mastra's `OpenAICompatibleConfig` (just `id`, `url`, `apiKey`), any OpenAI-compatible chat-completions server works without a code change — only `.env` changes.

## TypeScript gotchas

These tsconfig choices shape how imports and types must be written:

- **`"module": "ESNext"` + `"moduleResolution": "Bundler"`** — relative imports are written without file extensions (`import { foo } from './foo'`). Bun's resolver does the same at runtime. If you see an import with `.js` somewhere, it's a leftover from the pre-Bun era and can be stripped.
- **`"type": "module"`** — ESM only; no CommonJS interop assumed.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type { X } from '...'`; mixing values and types in one import that only uses the type side will fail to compile.
- **`jsx: "react-jsx"` with `jsxImportSource: "hono/jsx"`** — Hono JSX is pre-wired. `.tsx` files render through Hono's JSX runtime, not React. Nothing uses this yet, but it's available without extra setup.
- **`strict: true`** — no implicit `any`, strict null checks, etc.
- **`types: ["bun"]`** — `@types/bun` supplies Bun globals (`Bun`, `import.meta.main`) plus Node-compat types (`process`, `crypto`, etc.). Do not add `@types/node` — it conflicts with the Bun types.
