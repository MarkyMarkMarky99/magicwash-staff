# Handoff — MagicwashAI local gateway (agreed 2026-10-20, not started)

## Goal
- A general AI channel: the webapp sends a named task to this PC, `codex exec` runs it on the owner's subscription (no paid API), the answer comes back.
- Only works while this PC is on; the webapp must degrade to manual when it is offline.
- First task: `read-slip` — read a corporate customer's paper count slip and prefill counts on the corporate order form.

## Decisions (owner approved)
- Separate project `C:\MagicwashAI\`, NOT inside `C:\MagicwashInvoice` (codex hangs/crashes must not take printing down; different auth).
- Public hostname `ai.magicwash-laundry.com` on the existing Cloudflare tunnel → `http://localhost:3110`.
- Server-defined tasks only (`POST /tasks/:name`); the browser never sends a raw prompt. A free-form `chat` task, if ever added, is admin-only.
- Browser calls the gateway directly (not through Vercel): avoids a Vercel function waiting ~15 s and keeps secrets off the browser.
- The scanned image is sent straight from the browser to the gateway right after scan accept; no Firebase upload first. Firebase DOCUMENT upload still happens at Save.
- Model for `read-slip`: `gpt-6.1-sol`, effort `medium`.

## Measured (one CRYO-SINGHA slip, phone screenshot)
- gpt-6.1-sol medium: 14.2 / 16.0 / 15.3 / 14.9 s, all 4 runs identical and fully correct (incl. handwritten extra "ผ้ากันเปื้อน 1").
- gpt-6-luna low 15.5 s and medium 17–20 s: both misread White Bathrobe 17 as 18; low also unstable between runs. Do not use luna.
- Tunnel round trip PC→Cloudflare→PC `/health`: 0.10–0.22 s (first calls ~1 s). Firebase image download ~0.5 s.
- Expected end to end with direct browser upload: ~16 s from scan accept.
- Test inputs: `.user/ai-gateway-slip-test/` (slip.png, prompt.md, schema.json, sol result). Exact command used:
  `codex exec --skip-git-repo-check --ephemeral -s read-only -m gpt-6.1-sol -c model_reasoning_effort="medium" -i slip.png --output-schema schema.json -o result.json "<prompt>" < /dev/null`

## Planned layout
- `server.js` — express: `GET /health`, `GET /tasks`, `POST /tasks/:name` (multipart: JSON input + optional image files).
- `auth.js` — verify `Authorization: Bearer <Firebase ID token>` (jose + Google securetoken JWKS, project from `FIREBASE_PROJECT_ID`), check staff role.
- `runner.js` — one job at a time (codex on Windows crashes when run in parallel), spawn with stdin closed, cwd `work/`, timeout (~60 s), kill the process tree on timeout, clear leftover codex exec processes (not the Codex desktop app ones).
- `tasks/read-slip/` — `task.js` (validate input `{ items: [{ itemCode, nameTh, nameEn }] }`, build prompt + per-request schema `{ counts: { [itemCode]: int|null }, unlisted: [{ name, count }] }`, model/effort), `prompt.md`.
- `work/` empty run dir (not a git repo), `tmp/` per-job attachments deleted after the run, `logs/` one line per request (who, task, ms, ok/error), `.env` (`FIREBASE_PROJECT_ID`, `PORT=3110`, `ALLOWED_ORIGINS`).
- Own git repo.

## Safety rules (must hold for every task)
- `-s read-only` still lets codex READ the whole disk (e.g. `webapp-vue/.env.local` service-account keys). Protection = only schema-validated JSON is returned to the browser; never return codex's raw text.
- CORS only `https://magicwash-staff.vercel.app` and localhost dev origins.
- Per-staff rate limit to protect the subscription quota.
- Unreadable handwriting must come back `null`; the prompt forbids guessing.

## Webapp side (after the gateway works)
- Placement (owner, 2026-10-21): the gateway client lives in repo-root `shared/ai-gateway/` so the Vercel backend can call AI tasks too; task request/result zod schemas in `contracts/ai-gateway/`. Client calls tasks by name (never a raw prompt), uses only fetch/FormData/Blob, takes an injected `getToken`, relative imports with explicit `.js`.
- Gateway auth must accept both a staff Firebase ID token (browser) and a service secret (Vercel backend) from the start.
- Shared client in `src/shared/` that calls a task by name; `GET /health` drives an "AI online" state, hidden when offline.
- Corporate page: downscale scan (~1600 px long side JPEG) and send on scan accept; the AI's CLINIC COUNT (the customer's own count) PREFILLS the form counts (corrected 2026-10-21: no separate comparison column; LAUNDRY COUNT is blank at intake and is never read). Show result `warnings` to staff.
- Request input is `{ priceGroup }` (customer.PriceGroup); the gateway loads that group's items from the PriceList sheet itself.
- One order = exactly one count slip (owner, 2026-10-21). No multi-page summing; one AI reading per order, Retake replaces it.
- Corporate page keeps at most ONE slip photo (owner, 2026-10-21): once a photo exists, Scan becomes Retake; the multi-page stack/counter goes away.
- Flow (owner, 2026-10-21): photo first → staff wait while the AI reads → AI values become the form's starting values → staff correct them. The count sheet is locked while reading, so there is no staff-vs-AI overwrite case.
- Result keeps every field the AI reads (senderName, receiverName, totalWeight, deliveryDate…); the form picks only what it uses (owner, 2026-10-21). Don't trim the gateway result.
- Retake = new reading that replaces the starting values (confirm first if staff already edited). Read failure / gateway offline = unlock with empty counts, staff count by hand.

## Open / to do first
- Start method decided 2026-10-20: manual `start.bat` like the print server (which is double-clicked, not auto-started; runs as user Asus).
- Build order decided 2026-10-20: make MagicwashAI work locally on this PC first; tunnel/webapp integration later.
- Owner adds the `ai.` public hostname in the Cloudflare dashboard (tunnel is token-managed; no local config file). Do not put it behind Cloudflare Access.
- Re-test accuracy with the slip downscaled to ~1600 px before wiring the webapp.
- Test more slips with harder handwriting before relying on it.
- codex must be logged in as the Windows user that runs the server.
