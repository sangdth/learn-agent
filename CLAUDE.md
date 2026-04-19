# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo intent

`learn-agent` is a learning sandbox for building an AI agent on top of [Hono](https://hono.dev). It is in its initial state — a single-route "Hello Hono!" server — and is expected to grow agent-related tooling over time.

## Commands

This project uses **pnpm** (see `pnpm-lock.yaml`). The README currently says `npm install`, but prefer pnpm to keep the lockfile authoritative.

| Task                              | Command        |
| --------------------------------- | -------------- |
| Install deps                      | `pnpm install` |
| Dev server (watch mode via `tsx`) | `pnpm dev`     |
| Type-check and build to `dist/`   | `pnpm build`   |
| Run built output                  | `pnpm start`   |

The dev server listens on `http://localhost:3000`.

No test runner, linter, or formatter is configured yet — don't assume `pnpm test` / `pnpm lint` exist. If adding them, update this file and `package.json` together.

## Architecture

- **Entrypoint:** `src/index.ts` creates a `Hono` app and passes `app.fetch` to `@hono/node-server`'s `serve()`. All routes hang off the single `app` instance; there is no router/module split yet. When introducing more surface area, expect to extract route groups into their own files and mount them with `app.route()`.
- **Runtime:** Node via `@hono/node-server`. `tsx watch` runs TypeScript directly in dev; `tsc` emits ESM to `dist/` for `pnpm start`.

## TypeScript gotchas

These tsconfig choices shape how imports and types must be written:

- **`"type": "module"` + `"module": "NodeNext"`** — ESM only. Local relative imports must include an explicit `.js` extension (e.g. `import { foo } from './foo.js'`) even though the source file is `.ts`.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type { X } from '...'`; mixing values and types in one import that only uses the type side will fail to compile.
- **`jsx: "react-jsx"` with `jsxImportSource: "hono/jsx"`** — Hono JSX is pre-wired. `.tsx` files render through Hono's JSX runtime, not React. Nothing uses this yet, but it's available without extra setup.
- **`strict: true`** — no implicit `any`, strict null checks, etc.
