# Plan — Chats: staff-to-staff messages with images and translation

Status: **approved 2026-11-24, in build.** When it ships, move the behaviour into
`docs/features/agents/direct-chat.md` and keep this file as build history.

## Goal

The Agents page becomes **Chats**. Staff keep chatting with AI agents as today, and can also chat
1:1 with each other, send photos, and read every message in their own language (many workers
read Burmese; the owner reads Thai). All history lives in MagicwashAI for now; a Supabase move
later must not change the HTTP contract.

## Owner decisions

- 1:1 only. No groups, no edit/delete, no typing indicator, no streaming.
- Only active `admin` and `staff` can chat. Device accounts, `AI` and `AI-*` are excluded.
- Admins have no access to other people's conversations.
- History is kept forever.
- Images are in v1 (max 3 per message), prepared with the camera pipeline.
- Translation is in v1, automatic, model `gpt-6-luna` through the existing Codex login in
  read-only mode. Translate faithfully, add nothing, change no meaning, but read the context and
  produce something a native reader understands (not word-for-word).
- Each staff member's preferred language (`th` | `my` | `en`) is stored in MagicwashAI, never in
  a Staff sheet column.
- Nav label "Agents" → "Chats"; the route stays `/agents`.

## MagicwashAI

### Access

New module mounted at `/direct` in the main service after CORS (GET/POST/OPTIONS only).

- Firebase actor only (`kind === 'staff'`, role `admin` | `staff`, a valid human StaffId). The
  gateway secret / `X-Acting-Staff-Id` service actor is rejected.
- On every request the caller is re-checked against a strict roster (directory fetch without the
  personal-profile fallback, cached 60 s). A directory outage is `DATA_UNAVAILABLE`.
- Conversation-scoped routes return 404 for both "missing" and "not a participant". A
  conversation id must match `^dm_[0-9a-f]{24}$` before any filesystem access.
- `peerStaffId === caller` is rejected. A peer must be one active `admin` | `staff` row, not AI.
- An offboarded participant: the other one can still read history; nobody can send to or from
  them; no push to them. StaffIds are never reassigned.
- `Cache-Control: no-store` on every response; own send rate limiter (30/min per sender); JSON
  body limit 32 kB.

### Storage (`ConversationStore`; file adapter now, Supabase adapter later)

- `conversationId = 'dm_' + first 24 hex of sha256(sortedA + '\n' + sortedB)`.
- `logs/direct/<id>/meta.json` — `{ id, participants: [a, b], names: { a, b }, createdAt }`,
  written once.
- `logs/direct/<id>/history.jsonl` — the authority. Every record has a per-conversation `seq`.
  - message: `{ seq, id: String(seq), at (UTC ISO, ms), kind: 'staff', speaker {staffId, name,
    role}, text, images?, clientId, translate: { to } | { state: 'unavailable', reason } }`
  - translation outcome: `{ seq, kind: 'translation', refSeq, lang, text | same: true | error }`
- `logs/direct/<id>/read-markers.json` — `{ <staffId>: seq }`, only ever advances, only to a
  message seq.
- `logs/direct/<id>/images/` — final images; `logs/direct/.staging/` — in-flight uploads.
- Inbox order, last message and unread are derived from history and markers. One Node writer;
  synchronous mutations. A torn trailing line is dropped on load. After any append failure the
  cached thread is dropped and reloaded before the next write; a retry may return the recovered
  event only after the journal is fsynced.
- Idempotent send: a repeat `(sender, clientId)` returns the original event.
- Text: trimmed, 0–4000 chars (empty only when images are attached); NUL and malformed Unicode
  rejected.
- Files have app-only permissions, sit on the existing logs volume outside the history prune, and
  `logs/direct` + `logs/preferences` join the restricted backup/restore procedure.

### Images

- Membership is checked before the multipart body is parsed. Limits: 3 files, 5 MiB each, 32 kB
  fields, ≤ 5 parts; disk staging, removed on reject or disconnect.
- Type and extension come from the bytes (JPEG/PNG). Reject over 24 MP or anything that fails a
  bounded full decode.
- Commit order: dedupe `(sender, clientId)` → move staged files into `images/` → fsync files and
  directory → append the event. After journal recovery, final images no event references are
  removed; staging files older than 1 h are removed.
- `GET /direct/conversations/:id/images/:imageId` — participant only, `private, no-store`,
  `nosniff`.
- DM bodies and attachments never go to the generic task history.

### Preferred language

- `logs/preferences/<staffId>.json` = `{ language }`. `GET /preferences?staffId=` (admin any,
  staff self), `POST /preferences` (admin only). Missing = `th`.
- The main service is the only writer. The secretary reads it through
  `GET /internal/preferences/:staffId` (header `X-Internal-Key`, dedicated key) and keeps its old
  settings file only as an outage fallback; its settings write delegates to main.
- A one-off migrate script copies existing secretary settings files into missing main
  preferences.

### Translation

- Every message with text gets `translate.to` = the recipient's language at send time. A failed
  lookup stores `{ state: 'unavailable', reason: 'preference' }`; a retry resolves the target
  once and keeps it.
- The model detects the source language; text already in the target returns `same`.
- Execution: in the secretary container, through `POST /internal/translate` on the docker network
  (internal key; the public `/secretary` proxy gets an explicit route allowlist, strips the
  internal key header, and never forwards `/internal/*`). Run: `gpt-6-luna`, `sandbox:
  'read-only'` passed explicitly, a translation-only launcher, a clean translation Codex home
  (shared auth link only; no skills, MCP, AGENTS.md or listener credentials), an empty throwaway
  cwd, an ephemeral run, output schema `{ same: boolean, text: string | null }`.
- Input: up to 10 messages **before** the target seq plus the target, speakers labelled A/B,
  plus the target language. Message text is data, never instructions.
- Fixed instruction: translate only; translate directly and faithfully, never add, embellish,
  soften or change meaning; read the whole context and write a translation that reads naturally
  and makes sense to a native reader; keep names, customer and item names, IDs, numbers, dates
  and times exactly as written.
- One worker, backlog cap 200 (overflow stays pending in the journal and refills), a 90 s
  deadline from enqueue to result, one in-flight attempt per `(conversation, refSeq, lang)`
  shared by automatic and manual retry. Pending work is rebuilt from the journal on startup.
- **Fail closed:** translation stays disabled until the deployed probe passes. In Docker the
  read-only sandbox cannot build its bubblewrap jail, so Codex refuses every shell command; the
  owner accepted that (2026-11-25) as stricter than read-only. The probe therefore requires that
  no shell command executes, no file write lands, no network call arrives, and a synthetic
  Thai↔Burmese check passes. Never fall back to `danger-full-access`. Messages and images work
  without translation; messages sent while it is off are marked `off` and never back-filled.
- The prompt isolates the one message in a `<message>` block after a `<context>` block and
  restates the task last; digits stay as written (no Thai/Burmese numerals).
- Staff see a one-line notice in Chats that OpenAI receives the message and recent context for
  translation.

### HTTP

| Route | Result |
| --- | --- |
| GET `/direct/inbox` | `{ conversations: [{ conversationId, peer {staffId, name}, last {seq, at, speakerId, text ≤120, hasImages}, unread }] }`, only conversations with a message, newest first; unread = peer messages after my marker |
| POST `/direct/conversations` `{ peerStaffId }` | `{ conversationId, peer }`, creates meta if missing |
| GET `/direct/conversations/:id/history?before=&limit=` | `{ conversationId, peer, messages (decorated with translation state), highWater, hasMore, readSeq }`, counted in messages |
| GET `/direct/conversations/:id/history?after=` | `{ messages, translationUpdates, nextAfter, hasMore }`, cursor over all journal seqs |
| POST `/direct/conversations/:id/messages` | JSON `{ text, clientId }` or multipart (`request` + ≤3 images) → `{ message }` |
| POST `/direct/conversations/:id/read` `{ eventId }` | `{ readSeq }` |
| POST `/direct/conversations/:id/messages/:seq/translate` | retry, participant only, rate limited |
| GET `/direct/conversations/:id/images/:imageId` | image bytes |

### Push

Reuse the single push instance; an exact-StaffId sender shares delivery and expired-endpoint
cleanup with agent push. Fully generic text (title "Magicwash", body "Open Chats to read"),
tag = conversation, URL `/#/agents/dm/<id>`; skipped when the recipient has already read it;
never fails a send. Enabled only after sign-out and account switch on one browser profile pass.

## webapp-vue

- `callAiGatewayEndpoint` accepts `FormData` (no forced JSON content type).
- `shared/ai-gateway/tasks/direct-chat.ts` — own zod schemas for the routes above;
  `src/data/direct-chat/` service + store holding the inbox and the open thread only.
  - Everything is cleared on auth change. Responses are keyed by (auth session, conversation,
    open-thread generation) and stale ones are discarded, including image preparation and
    downloads.
  - The inbox poll is single-flight with a version counter and runs whenever the viewer may
    chat, independent of AI agent visibility (`useAgentsUnread` no longer exits early).
  - The open thread polls `after` every 15 s while visible and on resume, draining `hasMore`.
  - The read marker advances only to the latest peer message visible while the page is visible
    and scrolled to the bottom.
  - A pending send keeps `{ text, clientId, prepared files }` so a retry is identical.
- `prepareChatImage(file)` reuses `encodeCanvasToJpeg` (1280 px longest side, 0.82); a null encode
  shows an error and sends nothing. The optional camera uses `CameraOverlay` output as is.
- Agents list page titled "Chats": agent rows as today, a "People" section (name, preview or
  "Photo", time, unread), a "New chat" button with a picker from `staffStore.items` (active
  admin/staff, not self, not AI; load and retry if needed).
- `/agents/dm/:conversationId` → `DirectChatPage.vue`, excluded from `KeepAlive`, keyed by
  conversation and viewer, role-gated; an inaccessible link returns to Chats with
  "Conversation not available".
- Reuse `TeamAgentEventList` (the `agent` prop becomes optional, the AI branch guarded, existing
  callers unchanged) and `AgentComposer` (images on, max 3, maxlength 4000, draft kept on a failed
  send). Images display through `callAiGatewayBlob` and `TeamAgentEventImages` with a DM-owned,
  lazily loaded cache.
- Translation under the original for the recipient ("Translated · Burmese"); the sender sees
  "Sent as Burmese: …"; "Translating…" while pending; "Translation unavailable" + Retry.
- DM unread adds to the nav badge only, not the AI floating bubble.
- The staff page language picker becomes "Preferred language", shown for every active
  admin/staff and saved to `/preferences`.
- No new Vercel function.

## Supabase later

Keep MagicwashAI as the Firebase authorization boundary; swap the store adapter. Tables in an
unexposed schema with a restricted server role: conversations (unique pair), messages
(`UNIQUE (conversation_id, seq)`, `UNIQUE (conversation_id, sender_staff_id, client_id)`),
translations (`UNIQUE (conversation_id, ref_seq, lang)`), read markers advanced atomically.
Import with writes paused and compare counts, last seq and markers per thread. Images stay on the
volume until a separate move to a private bucket with the same ids behind the same endpoint.

## Build order

1. MagicwashAI `/direct`, images, preferences, translation worker and tests.
2. Containers rebuilt; prove the read-only sandbox and run the synthetic translation check.
3. webapp-vue contracts, data layer and pages.
4. Live test in Chrome with the owner, one staff member and one unrelated staff member,
   including Thai↔Burmese; phone smoke test.
5. Push, after the shared-phone test.
