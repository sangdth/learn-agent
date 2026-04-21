# learn-agent

Learning sandbox for building an AI agent on top of [Hono](https://hono.dev) and [Mastra](https://mastra.ai). The API exposes two endpoints backed by the same Mastra agent: `/v1/chat/completions` (OpenAI-compatible, for external clients) and `/v1/ai/chat` (AI SDK UI message protocol, used by the Svelte 5 SPA).

Turborepo monorepo on Bun. `apps/*` are deployables, `packages/*` are shared libraries consumed JIT (no build step).

```
learn-agent/
├── apps/
│   ├── server/       # Hono + Mastra backend (@repo/api)
│   └── client/       # Svelte 5 + Vite SPA  (@repo/web)
└── packages/
    └── schemas/      # Shared Zod request schemas (@repo/schemas)
```

## Quickstart

```bash
bun install
cp apps/server/.env.example apps/server/.env   # fill in LLM_API_KEY etc.
bun dev                                   # api :3000, web :5173 in parallel
```

Open http://localhost:5173. The web app uses the AI SDK (`@ai-sdk/svelte` + `DefaultChatTransport`) to call `/v1/ai/chat`; Vite proxies it through to the API on `:3000`.

## Scripts

All root scripts delegate to `turbo run <task>`. Each workspace owns the actual task implementation.

| Root command        | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `bun dev`           | `turbo run dev` — watch-mode API + Vite dev server, in parallel      |
| `bun run build`     | `turbo run build` — `apps/server/dist/` (Bun bundle) + `apps/client/dist/` |
| `bun run typecheck` | `turbo run typecheck` — tsc for server + schemas, svelte-check for client  |
| `bun run test`      | `turbo run test` — Vitest suite in `apps/server`                     |

> Inside `apps/server`, use `bun run test` — not `bun test`. The latter triggers Bun's native test runner, which doesn't understand `vi.mock`/`vi.hoisted`. Turbo invokes scripts via `bun run`, so this only matters if you cd into a package.

## Try the API directly

```bash
# Health check
curl http://localhost:3000/healthz
# {"ok":true}  (plus x-request-id response header)

# Non-streaming
curl http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"opencode/qwen3.5-plus","messages":[{"role":"user","content":"Say hi"}]}'

# Streaming (SSE)
curl -N http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"opencode/qwen3.5-plus","stream":true,"messages":[{"role":"user","content":"Count 1-5"}]}'
```

See [`CLAUDE.md`](./CLAUDE.md) for architecture, env vars, and TypeScript gotchas.
