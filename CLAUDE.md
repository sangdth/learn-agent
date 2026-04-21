# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo intent

`learn-agent` is a learning sandbox for building an AI agent on top of [Hono](https://hono.dev) and [Mastra](https://mastra.ai), with a Svelte 5 SPA frontend. It's a **Turborepo monorepo on Bun** — Bun is the runtime, package manager, bundler, and test loader for Vitest; Turborepo orchestrates tasks across workspaces.

## Workspace layout

```txt
learn-agent/
├── apps/
│   ├── api/          # Hono + Mastra backend                (@repo/api)
│   └── web/          # Svelte 5 + Vite SPA                  (@repo/web)
└── packages/
    └── schemas/      # Shared Zod request schemas (JIT TS)  (@repo/schemas)
```

- **Apps** are deployables. Each owns its own `.env`, `tsconfig.json`, build output.
- **Packages** are internal libraries consumed JIT — no build step. Their `package.json` `exports` point straight at `src/*.ts`. Bun (for the API) and Vite (for the web app) transpile TS on the fly.
- Workspace resolution is Bun-native (`"workspaces": ["apps/*", "packages/*"]` in root `package.json`).

## Commands

All root scripts delegate to `turbo run <task>`. Turbo parallelizes across workspaces and caches task outputs.

| Task            | Root command        | What turbo runs                                     |
| --------------- | ------------------- | --------------------------------------------------- |
| Install deps    | `bun install`       | —                                                   |
| Dev (both apps) | `bun dev`           | `turbo run dev` — api :3000 + web :5173 in parallel |
| Build all       | `bun run build`     | `turbo run build` — api bundle + web static bundle  |
| Type-check all  | `bun run typecheck` | `turbo run typecheck` — tsc + svelte-check          |
| Run tests       | `bun run test`      | `turbo run test` — Vitest in `apps/api`             |

**⚠️ Inside a package, use `bun run test`, not `bun test`.** `bun test` triggers Bun's native test runner, which doesn't understand `vi.mock`/`vi.hoisted`. Turbo invokes scripts via `bun run`, so this only matters if you cd into a package and run tests directly.

Single-package tasks via filter: `bun x turbo run build --filter=@repo/web`.

## Request flow

```txt
browser (apps/web, Svelte 5)          external clients (curl, SDKs)
  │  POST /v1/ai/chat                   │  POST /v1/chat/completions
  │  (AI SDK UI message stream)         │  (OpenAI-compatible SSE/JSON)
  ▼                                     ▼
apps/api/src/index.ts   (logger → cors → requestId → routes → onError/notFound)
  ├─ /v1/ai   → routes/ai-chat.ts     (zValidator over @repo/schemas → AI SDK UI stream)
  └─ /v1/chat → routes/chat.ts        (zValidator over @repo/schemas → OpenAI SSE/JSON)
                  └─ services/chat-service.ts   (toAgentMessages → mastra agent)
                       └─ mastra/agents/default-agent.ts   (env → OpenAI-compatible Agent)
```

- **`@repo/schemas`** is the single source of truth for wire contracts: `chatCompletionRequestSchema` (OpenAI request shape) and `aiChatRequestSchema` (AI SDK UI message shape), plus response/UIMessage types. Both sides of the wire import from it. Changes here propagate to api and web in one edit.
- **`chat-service` as canonical internal interface:** both route adapters call `getChatService().generate(...)` / `.stream(...)`. Routes are protocol shims only — no model/provider logic leaks past `apps/api/src/services/chat-service.ts`.
- **Vite proxy** in `apps/web/vite.config.ts` forwards `/v1/*` to `http://localhost:3000`. No CORS in dev. The existing CORS middleware on the API stays in place for cross-origin prod deployments.
- **Entrypoint (`apps/api/src/index.ts`):** Builds the app via `createRouter()` so `Variables` is typed, applies global middleware in order (`logger`, `cors`, `requestId`), exposes `GET /healthz`, mounts route groups with `app.route()`, then calls `registerErrorHandler(app)`. Exports named `app` (for tests) plus a default `{ port, fetch }` object that Bun auto-serves when the file is the CLI entrypoint.
- **Router factory (`apps/api/src/utils/create-router.ts`):** `createRouter()` returns `new Hono<{ Variables: { requestId: string } }>()`. Every sub-router uses it so `c.get('requestId')` is typed everywhere.
- **Middleware (`apps/api/src/middleware/`):** `requestId` reads `x-request-id` (or generates a UUID), stores it in context, mirrors it back in the response header. The Vite proxy preserves this header end-to-end.
- **Config (`apps/api/src/config/env.ts`):** Single Zod schema parses `process.env` at module load. `LLM_API_KEY`, `LLM_BASE_URL`, `DEFAULT_MODEL`, `PORT`, `NODE_ENV`. Failures throw one aggregated error naming every missing/invalid field.
- **Service layer (`apps/api/src/services/chat-service.ts`):** `createChatService(agent)` returns `{ generate, stream }`. A lazy `getChatService()` returns the singleton wired to the default Mastra agent. Tests mock this module.
- **Mastra layer (`apps/api/src/mastra/`):** `default-agent.ts` reads from `env` and builds one `Agent` (OpenAI-compatible model config). `index.ts` registers it on a `Mastra` instance and exposes `getDefaultAgent()`.
- **Chat route (`apps/api/src/routes/chat.ts`):** Validates the OpenAI-shaped request with `zValidator`, delegates to `getChatService()`, and translates outputs into OpenAI `chat.completion` / `chat.completion.chunk` SSE frames via pure helpers in `chat-mapping.ts`. Streaming errors emit a terminal `{ error: {...} }` SSE frame + `[DONE]` because `onError` can't reach an already-open stream.
- **AI chat route (`apps/api/src/routes/ai-chat.ts`):** Validates the AI SDK UI message request with `zValidator` over `aiChatRequestSchema`, flattens `parts[]` into plain text `ChatMessage[]`, delegates to `getChatService().stream()`, and writes `text-start` → `text-delta` → `text-end` frames via the AI SDK's `createUIMessageStream` / `createUIMessageStreamResponse`. Stream errors are surfaced as the protocol's own `error` frame (string) via `onError`.
- **Error handling (`apps/api/src/utils/error-handler.ts`):** `registerErrorHandler(app)` attaches `onError` and `notFound`. Errors map to `{ error: { code, message, requestId } }`. `HTTPException` → its own status, `ZodError` → 400 `validation_error`, everything else → 500 `internal_error` with a generic message (never leaks `err.message`).
- **Web app (`apps/web/src/App.svelte`):** Svelte 5 runes (`$state`). Uses the AI SDK (`@ai-sdk/svelte`'s `Chat` + `DefaultChatTransport` from `ai`) to call `/v1/ai/chat`. The SDK handles transport, streaming parse, and message state; the component just renders `chat.messages` and forwards input via `chat.sendMessage`.

### Response envelopes

- **Success:** route-specific — OpenAI-shaped for `/v1/chat/completions`, AI SDK UI message stream (`text-start` / `text-delta` / `text-end` parts) for `/v1/ai/chat`, `{ ok: true }` for `/healthz`.
- **Error (JSON):** `{ "error": { "code": "<machine_code>", "message": "<human>", "requestId": "<uuid>" } }`.
- **Error (OpenAI streaming SSE):** after the stream opens, a terminal data frame with the same `{ error: {...} }` shape, followed by `data: [DONE]`.
- **Error (AI SDK UI stream):** an `error` frame (string message) emitted via `createUIMessageStream`'s `onError` channel; the SDK surfaces it on the client as `chat.error`.
- Every response carries the `x-request-id` header (echoing the incoming one or a generated UUID). The Vite proxy forwards it unchanged to the browser.

## Environment variables

`.env` lives at **`apps/api/.env`**, not the repo root. Per Turborepo best practice, a root `.env` implicitly couples every package; keeping it inside the app that consumes it makes the dependency explicit. Bun auto-loads `.env` from the cwd at startup, and `turbo run dev` invokes the api script with `cwd=apps/api`.

- `LLM_API_KEY` — required. Bearer token for the OpenAI-compatible endpoint. Get one at <https://opencode.ai/auth>, or use any placeholder for local servers that don't authenticate.
- `LLM_BASE_URL` — required. Defaults to `https://opencode.ai/zen/v1` in `.env.example`. Point at vLLM / LM Studio / LiteLLM / any OpenAI-compatible `/chat/completions` server to switch backends.
- `DEFAULT_MODEL` — required, `provider/model` shape (e.g. `opencode/qwen3.5-plus`). Validated at startup.
- `PORT` — optional, defaults to 3000.

`apps/api/src/config/env.ts` is the single source of truth — a Zod schema over `process.env`, parsed at module load. On failure it throws one aggregated error naming every missing/invalid field. Everything else imports typed values from there; no module reads `process.env` directly.

### Model field caveat

The request's `model` field is **echoed back** in the response `model` field but does **not** change routing — the actual model is always `DEFAULT_MODEL`. Restart the server to switch. Dynamic per-request model routing is out of scope until the sandbox needs it.

### Swapping backend

Because the agent uses Mastra's `OpenAICompatibleConfig` (just `id`, `url`, `apiKey`), any OpenAI-compatible chat-completions server works without a code change — only `apps/api/.env` changes.

## TypeScript gotchas

Config is split: `tsconfig.base.json` at the repo root holds shared compiler options, each workspace extends it. These choices shape how imports and types must be written:

- **`"module": "ESNext"` + `"moduleResolution": "Bundler"`** — relative imports are written without file extensions (`import { foo } from './foo'`). Bun's resolver does the same at runtime. If you see an import with `.js`, it's a leftover from the pre-Bun era and can be stripped.
- **`"type": "module"`** — ESM only; no CommonJS interop assumed.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type { X } from '...'`. This applies to cross-workspace imports from `@repo/schemas` as well: `import { chatCompletionRequestSchema, type ChatMessage } from '@repo/schemas'`.
- **`jsx: "react-jsx"` with `jsxImportSource: "hono/jsx"`** (api only) — Hono JSX is pre-wired. `.tsx` files in `apps/api` render through Hono's JSX runtime, not React.
- **`strict: true`** — no implicit `any`, strict null checks, etc.
- **`types: ["bun"]`** in `apps/api` — `@types/bun` supplies Bun globals (`Bun`, `import.meta.main`) plus Node-compat types (`process`, `crypto`, etc.). Do not add `@types/node` — it conflicts with the Bun types.
- **`apps/web` uses Svelte's tsconfig** — extends `@tsconfig/svelte`, types include `svelte` and `vite/client`. No Bun types here; the web app runs in the browser.
- **JIT packages:** `@repo/schemas` has no build step. Its `"exports"` field points at `src/index.ts` and `src/openai.ts` directly. Both Bun and Vite handle this natively. If you ever consume it from a runtime that can't transpile TS (e.g. plain Node without a loader), a `tsup`/`tsc` build step would be needed.

## Turborepo specifics

- Task config lives in `turbo.json` at the repo root. Only `build`, `dev`, `typecheck`, `test` are defined. All are **package tasks** — root `package.json` scripts only delegate (`"build": "turbo run build"`), never run task logic directly.
- `dev` is `persistent: true, cache: false` — turbo keeps both dev servers alive until you Ctrl-C.
- `build` declares `outputs: ["dist/**"]` so turbo can hash and restore output caches. Re-running `bun run build` with no changes shows `>>> FULL TURBO`.
- `^build` on `typecheck`/`test` is a no-op today (`@repo/schemas` has nothing to build), but the edge ensures topological order when a future shared package grows a build step.
- No root `.env` → no `globalDependencies` for env files. Each app owns its env.
