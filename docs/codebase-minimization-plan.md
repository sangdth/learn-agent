# Codebase Minimization Plan

## Goal

Reduce unnecessary complexity, dead code, and maintenance surface while preserving current behavior.

## Summary of Findings

- Some dependencies are unused in the client app.
- Tests fail because Vitest is missing TS path alias resolution for `@/*` imports.
- A few exports/types are currently unused and can be internalized or removed.
- Several placeholder `.gitkeep` files are no longer useful.
- Documentation still references pre-rename workspace paths (`apps/api`, `apps/web`).
- The OpenAI request schema includes fields that are accepted but not used by runtime logic.
- The AI UI schema allows non-text parts that are silently dropped by server mapping.

## Phase 1: Safe Cleanup (No Behavior Changes)

1. Remove unused dependencies
   - `apps/client/package.json`: remove `@repo/schemas`, `@lucide/svelte`.

2. Fix test import aliasing
   - Add alias support in `apps/server/vitest.config.ts` so `@/` resolves to `apps/server/src`.

3. Trim unused exports/types
   - Remove or un-export symbols that are only internal.
   - Candidate: `mastra` export in `apps/server/src/mastra/index.ts`.

4. Delete stale placeholder files
   - Remove `.gitkeep` files in already populated server folders.

5. Align docs with current folder names
   - Replace `apps/api` -> `apps/server` and `apps/web` -> `apps/client` in docs where applicable.

## Phase 2: Behavioral Simplification (Low Risk, Contract-Aware)

1. Remove unused `promptText` in streaming path
   - Keep it only where token estimation actually consumes it.

2. Tighten OpenAI request schema or wire-through fields
   - Either pass through `temperature`, `top_p`, `max_tokens`, `user`, or remove them from accepted schema.

3. Tighten AI UI message schema
   - If multimodal is out of scope, accept only text parts to avoid silent dropping.

## Phase 3: Optional Structural Reduction

1. Reassess UI component stack for minimal app scope
   - If only a tiny subset is needed, reduce shadcn/tailwind utility surface.

2. Consolidate TS config story
   - Confirm whether root `tsconfig.base.json` is still needed versus `@repo/tsconfig/base.json` package.

## Risks and Guardrails

- Contract changes in schemas can break external clients if done without versioning.
- Over-aggressive export removal can break downstream imports.
- UI simplification can introduce visual regressions.

Guardrails:

- Keep cleanup and contract changes in separate commits.
- Run full verification after each phase.

## Verification Checklist

Run after each phase:

```bash
bun run typecheck
bun run test
bun run build
```

Manual checks:

- `GET /healthz` returns `{ ok: true }` and `x-request-id`.
- `/v1/chat/completions` non-stream and stream both work.
- `/v1/ai/chat` browser chat flow streams correctly.

## Suggested Execution Order

1. Phase 1 completely.
2. Phase 2 with schema changes behind explicit decision.
3. Phase 3 only if you want a leaner frontend dependency footprint.
