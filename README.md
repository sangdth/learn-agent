# learn-agent

Learning sandbox for building an AI agent on top of [Hono](https://hono.dev) and [Mastra](https://mastra.ai). Exposes an OpenAI-compatible `/v1/chat/completions` endpoint backed by a Mastra agent.

## Quickstart

```bash
pnpm install
cp .env.example .env       # then fill in OPENCODE_API_KEY
pnpm dev                   # http://localhost:3000
```

## Try it

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

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `pnpm dev`        | Watch-mode dev server with `.env` loaded  |
| `pnpm build`      | Type-check and emit ESM to `dist/`        |
| `pnpm start`      | Run `dist/` with `.env` loaded            |
| `pnpm test`       | Run Vitest suite once                     |
| `pnpm test:watch` | Vitest in watch mode                      |

See `CLAUDE.md` for architecture, env var details, and the model-field caveat.
