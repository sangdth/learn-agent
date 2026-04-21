# Two-Endpoint Chat Architecture Plan

## Scope

Keep:

- `Mastra` as server-side agent/model orchestration.
- `AI SDK` for frontend chat UX/state/transport only.
- Two endpoints:
  - `/v1/chat/completions` (OpenAI-compatible API)
  - `/v1/ai/chat` (AI SDK UI message protocol)

Both endpoints must use the same backend chat service (`getChatService()`).

## Goals

- Single source of truth for generation/streaming logic in `apps/server/src/services/chat-service.ts`.
- No model-provider logic in frontend.
- No protocol drift between app behavior and docs.
- Predictable error handling and test coverage for both routes.

## Current State (What Already Works)

- `/v1/chat/completions` already uses `getChatService()` and streams SSE OpenAI chunks.
- `/v1/ai/chat` already uses `getChatService()` and AI SDK UI stream format.
- Frontend chat currently uses AI SDK (`Chat` + `DefaultChatTransport`) with `/v1/ai/chat`.

## Gaps / Risks

- Docs drift: docs say web uses `/v1/chat/completions`, app uses `/v1/ai/chat`.
- `ai-chat` route lacks schema validation parity with `chat.ts`.
- Error behavior differs between routes and can diverge over time.
- Potential unused server deps (`@ai-sdk/openai`, `@ai-sdk/openai-compatible`) increase maintenance risk.
- Future tool-call/multimodal support can break if mapping remains text-only.

## Target Architecture

- **Mastra layer**: only place that talks to model backend.
- **Service layer (`chat-service`)**: stable internal interface:
  - `generate(messages)`
  - `stream(messages)`
- **Route adapters**:
  - `/v1/chat/completions`: OpenAI-compatible request/response + SSE chunk mapping.
  - `/v1/ai/chat`: AI SDK UI message transport protocol mapping.
- **Frontend**:
  - Uses AI SDK chat state/transport.
  - Calls only `/v1/ai/chat`.
- **External clients**:
  - Use `/v1/chat/completions`.

## Implementation Plan

1. **Lock contract boundaries**
   - Document `chat-service` as the canonical backend interface.
   - Explicitly treat both routes as protocol adapters only.

2. **Harden `/v1/ai/chat` adapter**
   - Add request schema validation for incoming UI messages.
   - Normalize error handling strategy (consistent machine-readable error semantics).
   - Keep text extraction/conversion logic in one place.

3. **Keep `/v1/chat/completions` stable**
   - Preserve OpenAI-compatible envelopes and SSE `[DONE]` behavior.
   - Keep shared schemas in `@repo/schemas` as source of truth.

4. **Dependency hygiene (server)**
   - Remove unused provider-specific AI SDK packages from `apps/server/package.json` if not imported.
   - Keep only packages required for AI SDK UI protocol route (`ai`) and Mastra stack.

5. **Docs alignment**
   - Update `README.md` to state:
     - Web UI uses `/v1/ai/chat`.
     - OpenAI-compatible clients use `/v1/chat/completions`.
   - Update `CLAUDE.md` request-flow diagram to include both endpoints and their purpose.

6. **Testing**
   - Add/expand tests for `/v1/ai/chat`:
     - Valid request streams expected parts.
     - Invalid request returns validation error.
     - Stream failure returns terminal error behavior.
   - Keep `/v1/chat/completions` tests as compatibility guardrails.
   - Ensure both routes keep `x-request-id`.

7. **Verification**
   - `bun run typecheck`
   - `bun run test`
   - Manual checks:
     - `curl -N /v1/chat/completions` (OpenAI SSE)
     - Browser chat flow via `/v1/ai/chat`

## Acceptance Criteria

- Both endpoints call `getChatService()` (no duplicated generation logic).
- Frontend works with AI SDK chat state and streaming.
- Mastra remains the only server-side model orchestration layer.
- Docs match runtime behavior.
- Tests cover both protocols and pass.

## Non-Goals (for this phase)

- Persistent chat history storage across refreshes/sessions.
- Dynamic per-request model routing.
- Tool-call/multimodal protocol unification.

## Follow-up (Next Phase)

- Add persistent conversation store.
- Add protocol-level observability (latency/error metrics per endpoint).
- Add tool-call-aware mapping strategy across both protocols.
