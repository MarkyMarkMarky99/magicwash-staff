# AI gateway client

The runtime client lives in repository-root shared/ai-gateway so the frontend and Vercel backend can use the same protocol. Its zod runtime contracts live in contracts/ai-gateway. Internal imports in these folders use relative paths with explicit .js extensions. Neither folder depends on Vue, Firebase, frontend environment variables, or browser APIs beyond fetch, FormData, Blob, AbortController and AbortSignal. Contract files export schemas; consumers declare their schema-derived type aliases locally.

The generic client handles authenticated task calls, JSON or multipart bodies, response-envelope validation, gateway error codes, cancellation and deadlines. Health checks return validated readiness information or null and never throw. A task wrapper validates its task-specific input and result. Callers send task names and input, never prompts; task instructions belong to the separate gateway service.

Frontend configuration and Firebase token retrieval live in src/shared/ai-gateway. An empty VITE_AI_GATEWAY_URL disables corporate slip reading without issuing requests. Feature code owns its workflow, image preparation, warnings and draft updates. The corporate form behavior is documented in [Corporate order form](../features/orders/corporate-order-form.md).

Gateway tests use injected fetch implementations and never contact a service. Shared-runtime tests run through tsx; frontend workflow and prefill tests use tsx with jsconfig.json, following [Verification conventions](../conventions/verification.md).

## Chat task

`shared/ai-gateway/tasks/chat.ts` calls `POST /tasks/chat` with a 95 s deadline and validates input/results using `contracts/ai-gateway/chat-api.schema.ts`. Input is `{ agentId, message, sessionId? }` for `register-customer` or `price-check`; messages are at most 4000 characters and may be empty only with images. Attachments are 0–3 JPEG/PNG images, at most 5 MiB each, with role `reference`. The client uses multipart when images are present and JSON otherwise.

The first turn omits `sessionId`; later turns send the returned ID with only new text and images. Results contain `agentId`, `sessionId`, `reply`, a nullable customer or price proposal, and top-level warnings. `SESSION_NOT_FOUND` (404) means the session expired or the gateway restarted; the Agents store clears its session so a retry starts a new chat. See [Agent chat](../features/agents/agent-chat.md) for image preparation and UI behavior.
