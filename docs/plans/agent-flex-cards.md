# Agent flex cards — plan

Status: webapp side built (2026-11-25); MagicwashAI side built for the washing pilot, not yet deployed.
Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Read against `origin/main` (this worktree's branch is 17 commits behind it; build on a fresh branch
from `main`).

## Goal

Any agent can attach a tappable card (summary, photos, buttons) to a reply without a bespoke Vue
component per feature, the way LINE Flex Messages work. The AI sends **data only**: a small JSON tree
of known parts. The app draws it with its own components and tokens. No HTML, CSS, JS, colour values
or free URLs from the AI, ever.

## Where it rides

- Team-agent history events gain one optional field, `card`, beside `text`, `images` and `proposal`.
  Only `kind: 'agent'` events carry it.
- `text` stays required and is the plain-text version of the reply. Push notifications, the floating
  bubble and unread previews keep using `text` and ignore `card`.
- W parses it in `shared/ai-gateway/tasks/team-agent.ts` as
  `card: agentCardSchema.nullish().catch(null)`, the same lenient pattern as `proposal`. A malformed
  card becomes `null`: the event shows its text only and history loading never fails because of it.
- An event may carry both `proposal` and `card`; the proposal card renders first.

## Contract — `contracts/ai-gateway/agent-card.schema.ts` (W, source of truth)

A card is a `bubble` or a `carousel` of 2–10 bubbles (swiped sideways).

Bubble:
- `title` (string, ≤40) — the PaperCard tab text, through `AgentCardFrame`.
- `tone` — `brand` | `warning` (maps to `AgentCardFrame` tone).
- `hero` — optional `image` part shown full width at the top.
- `body` — 1–30 parts.
- `footer` — 0–3 `button` parts.

Parts (depth limit: a `box` holds leaf parts only, no box in a box; no recursion in the schema):
- `text` — `text` (≤2000), `size` `sm|md|lg|xl`, `weight` `regular|bold`,
  `tone` `default|muted|primary|success|warning|error`, `maxLines` 1–10 (optional clamp).
- `box` — `layout` `row|column`, `gap` `none|sm|md`, `contents` (1–8 leaf parts). A `row` of two
  texts is the key/value line ("Due" · "Fri 28 Nov").
- `image` — `source` (see Images), `aspect` `square|wide|tall`, `alt`, optional `action`.
- `button` — `label` (≤30), `style` `primary|secondary|link`, `action` (required).
- `separator` — no fields.
- `badge` — `text` (≤20), `tone` as text; drawn with `BaseBadge` `sm`.
- `table` — `columns` (1–4 of `{ label, align: start|end }`), `rows` (≤30, each a string per
  column). For price or item lists.

Actions (the only three):
- `{ type: 'route', route, params }` — `route` is an enum of named in-app routes with their required
  params, e.g. `order-detail {orderId}`, `invoice-detail {invoiceNumber}`, `customer-detail
  {customerId}`, `appointment-detail {appointmentId}`, `laundry-item-detail {…}`. W maps the name to
  its existing route helper; never a path string. An unknown name fails the schema.
- `{ type: 'message', text }` — `text` (≤200) is sent as the tapping staff member's own chat message,
  through the normal send (optimistic bubble, same permissions). Like LINE's message action.
- `{ type: 'photo' }` — only on an `image` part: opens it full screen.

Limits: whole card ≤ 32 KB serialized; enums only for every style choice; strings are shown as plain
text (Vue interpolation, never `v-html`).

Example (washing agent, one order):

```json
{ "type": "bubble", "title": "Order ready", "tone": "brand",
  "hero": { "type": "image", "source": { "url": "https://firebasestorage.googleapis.com/v0/b/…" }, "aspect": "wide", "alt": "Packed bag", "action": { "type": "photo" } },
  "body": [
    { "type": "text", "text": "ORD-1042 · คุณสมชาย", "size": "lg", "weight": "bold" },
    { "type": "box", "layout": "row", "gap": "sm", "contents": [
      { "type": "text", "text": "Items", "tone": "muted", "size": "sm" },
      { "type": "text", "text": "12 ชิ้น", "size": "sm", "weight": "bold" } ] },
    { "type": "badge", "text": "Washed", "tone": "success" } ],
  "footer": [
    { "type": "button", "label": "Open order", "style": "primary", "action": { "type": "route", "route": "order-detail", "params": { "orderId": "ORD-1042" } } },
    { "type": "button", "label": "ปิดงานซัก", "style": "secondary", "action": { "type": "message", "text": "ปิดงานซัก ORD-1042" } } ] }
```

## Images

`source` is `{ url }`: https only, host exactly `firebasestorage.googleapis.com` (where every
garment and order photo lives; the backend already rejects other hosts). Checked by both AI and W.
Agent events carry no attached images today, so there is no event-image source.

Optional fields are nullable rather than absent in the AI output (Codex strict output schema
requires every key); W accepts `null` or missing for each.

Full screen: `PhotoViewer` with a route-owned query `?cardPhoto=<eventId>~<index>`. Generalise
`useBillingPhotoRoute` into an agent-local `useQueryPhotoRoute(key)` (same push/replace/back rules);
the billing card can switch to it in a later round, not in this one.

## Renderer (W)

- `src/features/agents/components/AgentFlexCard.vue` — takes `card`, `eventId`, `imageStates`; draws a
  bubble in `AgentCardFrame`, or a carousel as a horizontal scroll-snap row of frames. Emits
  `route(location)` and `message(text)`; owns its photo viewer.
- One small child per part kind if the file grows; all feature-local (`shared/components/` is
  import-only).
- Style maps (size/tone/style → token classes) live in the component, per
  `docs/conventions/colors.md`; buttons reuse the pill look already in `CustomerProposalCard`.
- `TeamAgentEventList` renders it under the agent bubble and re-emits; `TeamAgentChatPage` pushes the
  route and calls the store's send for `message` (disabled while a send is in flight).
- Docs to update in the build: `docs/features/agents/agent-chat.md`,
  `docs/architecture/ai-gateway-client.md`.

## Emitting it (AI)

- The turn output schema (`src/appointments/runtime.js`) gains `card: anyOf [null, cardJsonSchema]`
  for agents with `cards: true` (washing only in the pilot). It is passed per turn, so no AGENTS.md
  reload and **no session reset**. When to send a card is taught by the schema field descriptions
  plus a `turnPrompt` line naming the shared skill `work/team-shared/chat-cards/SKILL.md` by absolute
  path (sessions read the skill list only at start).
- `src/cards/` (new): the JSON Schema copy of the contract, and `checkCard(card)` run after the turn:
  schema check, image host allowlist, route params, table widths, size. Checking that route ids exist
  is a later option, not done in the pilot. A failing card is dropped (`card: null`), the reply text still posts, and the failure is logged.
- `service.event()` stores `card` next to `proposal`; history returns it as-is.
- Drift guard: a shared fixture set of valid and invalid cards in each repo's `tests/`, run against
  W's zod schema and AI's JSON Schema.

## Existing proposal cards

- `BillingDraftCard` and `CustomerProposalCard` stay bespoke. They are drafts handed into a form
  (`setInvoiceCreatePrefill`, `setCustomerCreatePrefill`) with typed data and a server check; a flex
  card is display plus three actions and cannot carry a form prefill.
- `PriceProposalCard` and `TrackingProposalCard` (non-team chat) are display-only and could become flex
  cards later; not in this round.
- `AgentCardFrame` stays and becomes the bubble frame.

## Build order (after approval)

- W contract + parsing + dry tests, then renderer (Sonnet for the renderer UI, Codex Sol for
  contract/parsing/tests; one Codex job at a time).
- AI schema, `checkCard`, event storage, one pilot agent's prompt line (Sol). Rebuild the Docker
  container; do not touch any agent's thread pointer.
- Live check with the test customer (`cbcc555a`), then turn cards on for the other agents.

## Open

- Pilot agent: which one sends cards first.
- `message` buttons send at once (LINE behaviour, proposed) or only fill the composer.
