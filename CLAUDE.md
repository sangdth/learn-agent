# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo intent

`learn-agent` is a learning sandbox for building an AI agent on top of [Hono](https://hono.dev). It is in its initial state — a single-route "Hello Hono!" server — and is expected to grow agent-related tooling over time.

## Commands

This project uses **pnpm** (see `pnpm-lock.yaml`). The README currently says `npm install`, but prefer pnpm to keep the lockfile authoritative.

| Task                              | Command           |
| --------------------------------- | ----------------- |
| Install deps                      | `pnpm install`    |
| Dev server (watch mode via `tsx`) | `pnpm dev`        |
| Type-check and build to `dist/`   | `pnpm build`      |
| Run built output                  | `pnpm start`      |
| Run tests once (Vitest)           | `pnpm test`       |
| Run tests in watch mode           | `pnpm test:watch` |

The dev server listens on `http://localhost:3000`. `dev` and `start` scripts load `.env` via Node 20's `--env-file` flag — no `dotenv` dependency.

Tests live alongside source as `*.test.ts`. They run under Vitest with `passWithNoTests` enabled and are excluded from the `tsc` build output.

## Architecture

- **Entrypoint:** `src/index.ts` creates a `Hono` app and passes `app.fetch` to `@hono/node-server`'s `serve()`. Route groups are mounted with `app.route()` — currently `chatRoute` at `/v1/chat`.
- **Runtime:** Node via `@hono/node-server`. `tsx watch` runs TypeScript directly in dev; `tsc` emits ESM to `dist/` for `pnpm start`.
- **Mastra layer (`src/mastra/`):** A single default `Agent` is built at module load in `src/mastra/agents/default-agent.ts` using Mastra's native `OpenAICompatibleConfig`. `src/mastra/index.ts` registers it on a `Mastra` instance and exports `getDefaultAgent()`.
- **Chat route (`src/routes/chat.ts`):** Validates the OpenAI-shaped request with Zod, calls `getDefaultAgent().generate()` for non-streaming and `.stream()` for streaming, and translates outputs into OpenAI `chat.completion` / `chat.completion.chunk` SSE frames via pure helpers in `src/routes/chat-mapping.ts`.

## Environment variables

Copy `.env.example` → `.env` and fill in:

- `OPENCODE_API_KEY` — required. Used as the Bearer token against the OpenAI-compatible endpoint. Get one at https://opencode.ai/auth, or use any placeholder for local servers that don't authenticate.
- `OPENCODE_BASE_URL` — required. Defaults to `https://opencode.ai/zen/v1` in `.env.example`. Point at vLLM / LM Studio / LiteLLM / any OpenAI-compatible `/chat/completions` server to switch backends.
- `DEFAULT_MODEL` — required, `provider/model` shape (e.g. `opencode/qwen3.5-plus`). Validated at startup.
- `PORT` — optional, defaults to 3000.

The agent validates all three required vars at module load and throws a clear error message if any are missing.

### Model field caveat

The request's `model` field is **echoed back** in the response `model` field but does **not** change routing — the actual model is always `DEFAULT_MODEL`. Restart the server to switch. Dynamic per-request model routing is out of scope until the sandbox needs it.

### Swapping backend

Because the agent uses Mastra's `OpenAICompatibleConfig` (just `id`, `url`, `apiKey`), any OpenAI-compatible chat-completions server works without a code change — only `.env` changes.

## TypeScript gotchas

These tsconfig choices shape how imports and types must be written:

- **`"type": "module"` + `"module": "NodeNext"`** — ESM only. Local relative imports must include an explicit `.js` extension (e.g. `import { foo } from './foo.js'`) even though the source file is `.ts`.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type { X } from '...'`; mixing values and types in one import that only uses the type side will fail to compile.
- **`jsx: "react-jsx"` with `jsxImportSource: "hono/jsx"`** — Hono JSX is pre-wired. `.tsx` files render through Hono's JSX runtime, not React. Nothing uses this yet, but it's available without extra setup.
- **`strict: true`** — no implicit `any`, strict null checks, etc.
