# AI gateway client

The runtime client lives in repository-root shared/ai-gateway so the frontend and Vercel backend can use the same protocol. Its zod runtime contracts live in contracts/ai-gateway. Internal imports in these folders use relative paths with explicit .js extensions. Neither folder depends on Vue, Firebase, frontend environment variables, or browser APIs beyond fetch, FormData, Blob, AbortController and AbortSignal. Contract files export schemas; consumers declare their schema-derived type aliases locally.

The generic client handles authenticated task calls, JSON or multipart bodies, response-envelope validation, gateway error codes, cancellation and deadlines. Health checks return validated readiness information or null and never throw. A task wrapper validates its task-specific input and result. Callers send task names and input, never prompts; task instructions belong to the separate gateway service.

Frontend configuration and Firebase token retrieval live in src/shared/ai-gateway. An empty VITE_AI_GATEWAY_URL disables corporate slip reading without issuing requests. Feature code owns its workflow, image preparation, warnings and draft updates. The corporate form behavior is documented in [Corporate order form](../features/orders/corporate-order-form.md).

Gateway tests use injected fetch implementations and never contact a service. Shared-runtime tests run through tsx; frontend workflow and prefill tests use tsx with jsconfig.json, following [Verification conventions](../conventions/verification.md).
