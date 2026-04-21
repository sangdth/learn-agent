# learn-agent

Learning sandbox for building an AI agent on top of [Hono](https://hono.dev) and [Mastra](https://mastra.ai). Exposes an OpenAI-compatible `/v1/chat/completions` endpoint backed by a Mastra agent.

## Quickstart

```bash
bun install
cp .env.example .env       # then fill in OPENCODE_API_KEY
bun dev                    # http://localhost:3000
```

## Try it

Health check:

```bash
curl http://localhost:3000/healthz
# {"ok":true}  (plus x-request-id response header)
```

Non-streaming:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"opencode/qwen3.5-plus","messages":[{"role":"user","content":"Say hi"}]}'
```

Streaming (SSE):

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"opencode/qwen3.5-plus","stream":true,"messages":[{"role":"user","content":"Count 1-5"}]}'
```

## Scripts

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `bun dev`          | Watch-mode dev server (`.env` auto-loaded)      |
| `bun start`        | Run `src/index.ts` directly                     |
| `bun run build`    | Bundle to `dist/index.js` (Bun target, minified)|
| `bun run typecheck`| `tsc --noEmit` — type-check only                |
| `bun run test`     | Run Vitest suite once                           |
| `bun run test:watch` | Vitest in watch mode                          |

> Use `bun run test`, not `bun test`. `bun test` triggers Bun's native test runner, which doesn't understand `vi.mock`/`vi.hoisted`. The npm-style `run` prefix explicitly dispatches to the `vitest run` script.

See `CLAUDE.md` for architecture, env var details, and the model-field caveat.
