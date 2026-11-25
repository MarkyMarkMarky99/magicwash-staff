# Billing assistant (น้องออกบิล) — v1 plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Status: webapp non-visual part built, not deployed.

## Owner decisions (2026-11-25)

- Prices often do not follow PriceList. Past invoice history is always the main source of a price.
- The agent may read every invoice of every customer. A new customer is priced from similar lines on
  other customers' invoices.
- Every suggested price cites its source: the invoice, that invoice's order, and the photo of that
  specific garment.
- The agent never creates an invoice. It drafts the bill in chat; the admin opens the prefilled
  invoice form, checks it and presses Create.
- Entry point is the agents chat, not a button on the invoice page.
- Access: role `admin` only.
- Main model `gpt-6.2-sol` writes the bill and decides. `gpt-6-luna` subagents filter history and look
  at photos and report back, so the main context stays small.
- The agent composes the bill lines itself (later 2026-11-25). Rules cannot cover every case, so it
  copies how this customer was billed before (wording, package or per piece, units, quantities) and
  reasons from context. It writes what staff tell it, including prices given in chat and one draft
  covering several orders of the same customer. Example: a 20-piece ironing order billed as "แพกเกจรีดเสื้อผ้าทั่วไป 10 ชิ้น"
  × 2 package at 250, as on the customer's previous invoice. The server guards facts only.

## Claude defaults (changeable)

- Price order per line:
  1. this customer's history;
  2. other customers' history;
  3. PriceList.
  The PriceList price is always shown beside the chosen one.
- When one source has several prices for the same garment, use the most recent invoice and list the
  others.
- Only issued invoices count as evidence: deleted, draft, cancelled and void ones are excluded.
- Runtime: a team agent (one shop-wide conversation, async turns, 10-minute cap), like
  `appointments`. The synchronous `chat` task has a 60 s timeout, too short for photo work.
- v1 has no daily runs, no reminders, no writes of any kind, and no agent notes. A remembered rule
  such as "customer X is always 50" would be a price without a citation.

## Flow

1. The admin opens น้องออกบิล in Chats and writes, for example, "ออกบิล ORD-xxx". Photos may be
   attached.
2. Sol loads the order (customer, items, garments and their photos) and dispatches the Luna
   `history` subagent at the same time.
3. Sol sends the shortlisted pairs (a current garment against a cited garment) to the Luna `photos`
   subagent.
4. Sol decides each line and replies with a short Thai explanation plus a structured bill draft.
5. The AI server checks the draft (below). The chat shows the checked draft as a card.
6. The admin may ask follow-ups or ask for changes. Each reply carries a fresh, checked draft.
7. "Open in invoice form" opens the invoice create page for that order, prefilled. The admin edits
   anything and presses Create. Normal form validation and the normal create API apply.

## Webapp (W)

### No billing API (owner, 2026-11-25)

- The agent reads the sheets directly through GViz. It does not go through Vercel, so there is no
  billing key and no new read endpoint, and nothing spends Vercel quota or time.
- The agent gets no webapp credential at all, which is also why it has no write path.
- W changes are only:
  - line provenance;
  - the invoice list `orderId` filter;
  - the chat card and prefill.
- Invoice detail also returns `sourceItemId` and `sku`.
- The invoice list query gains an `orderId` filter, matched on `InvoiceItems.source_order_id`, for
  the prefill's duplicate check.

### Line provenance (every invoice, not only drafted ones)

- Form state:
  - a line seeded from an order item keeps that item's `orderItemId` as `sourceItemId`;
  - a PriceList pick keeps that row's `itemCode` as `sku`;
  - editing the description or clearing the PriceList selection clears the SKU. A different
    PriceList selection uses its own SKU. Source item IDs stay with their seeded lines.
- `invoiceLineInputSchema` gains optional `sourceItemId` and `sku`.
- The server rejects a `sourceItemId` that does not belong to `sourceOrderId`. It writes both values
  to `InvoiceItems.source_item_id` and `sku`. The columns already exist; today `source_item_id` is
  always written as null.
- No change to totals, numbering, print or payments.

### Chat card and prefill

- `TEAM_AGENT_IDS` and the catalog gain `billing` (น้องออกบิล), `roles: ['admin']`.
- The team event schema gains an optional `proposal` that carries only the checked draft.
- Draft card:
  - lines as the agent wrote them (description, quantity × unit, price), the reason, source badge
    and the PriceList price when one is cited;
  - citations as links to the invoice detail, the order and the garment photo;
  - photo matches marked "exact" or "probable";
  - warnings in orange;
  - an "Open in invoice form" button.
- Prefill uses `src/shared/navigation/invoice-create-prefill.ts`, the same one-shot in-memory pattern
  as `customer-create-prefill.ts`.
  - The button stores the checked draft and pushes the invoice create route with `customerId` and
    `orderId`.
  - The page applies the draft once, only when both IDs match the loaded order.
  - The draft lines replace the lines seeded from the order. A line covering exactly one item of the
    opened order keeps it as `sourceItemId`; lines from another order keep none. The invoice links
    only the opened order; a line with a PriceList row keeps its `itemCode` as `sku`.
  - A null price stays blank. The line's `photoMatch` and `source` show as badges in the form.
  - Before applying, the page looks up existing invoices for the order through
    the invoice list `orderId` filter. It does not rely on the order's linked invoice number, which can stay
    empty if the order-link write failed. If one exists, the page shows the duplicate warning and
    does not apply the draft.

## AI (MagicwashAI)

### Agent registration and runtime

- Add `billing` to `src/team-agents/configs.js`:
  - `allowedRoles: ['admin']`, `dailySlots: []`, `actionTypes: []`;
  - model `gpt-6.2-sol`, effort `medium`;
  - env allowlist: the spreadsheet IDs it reads only, with no webapp URL or key.
- Team startup (`server.js`) passes billing a `runConfig`, the same hook the secretary uses. It
  turns on `features.multi_agent_v2` and registers the two Luna roles through
  `agents.<name>.config_file`.
- Team turns today must return `proposal: null` (`src/appointments/runtime.js`). Add a per-agent
  proposal schema and check. For billing, the checked draft is stored with the turn event and
  returned in history; other team agents stay `null`.
- `docker-entrypoint.sh` also ships `work/billing/agents/` (today it copies only `AGENTS.md`,
  `.agents` and `scripts`).
- "No writes" means no business-data writes. Runtime event storage and temporary photo files are
  allowed.
  - Billing gets no listener URL (skip listener issuance in `src/appointments/service.js`).
  - Billing is left out of the loop in `configs.js` that adds assignment action types to every
    team agent.
  - Billing does not inherit the Docker default `danger-full-access`. It runs a billing-specific
    sandbox, passed through the runtime's per-agent sandbox option (`src/appointments/runtime.js`)
    and applied to Sol and both Luna roles:
    - the workspace is read-only;
    - writes are allowed only in a per-turn scratch directory, removed after the turn;
    - network is allowed for GViz reads and photo downloads.
    The exact Codex settings are confirmed by a live probe, as the translation sandbox was.
  - The `photo` script stages images in that scratch directory, and the subagents read them from
    there.

### Workspace `work/billing/`

- `AGENTS.md` holds the framework:
  - role, Thai tone and the price order;
  - always cite;
  - find the order from the customer's name, phone or dates (`customer`), never ask staff for IDs;
  - copy how past invoices billed the same kind of work; no evidence means a null price and a question;
  - never write anything;
  - how to brief each subagent.
- `.agents/skills/billing/SKILL.md` covers how to use the scripts.
- `scripts/` holds small read-only node scripts that read GViz directly, through the same reader as
  `src/sheets/price-list.js`, mapping columns by header name per the G Drive schema registry:
  - `lines`: `Invoices` + `InvoiceItems`, issued invoices only (no deleted, draft, cancelled or void).
    Filters: customer, order, sku, text and invoice item IDs, newest first, bounded;
  - `order`: an order with its items (`OrderItems`), garments (`OrderGarments` → `LaundryItems`),
    garment photos (`LaundryItemPhotos`; legacy `LaundryPhotos`/`AfterPhoto`), `OrderImages` and
    the customer;
  - `customer`: customers by name, code or phone, each with its latest orders and their issued
    invoice numbers;
  - `prices`: active PriceList rows;
  - `photo`: download one image to a local file, resized, and print its path.

### Luna subagents (`work/billing/agents/*.toml`)

- Both run `gpt-6-luna`, read-only, may not spawn agents, and return JSON only.
- `history`:
  - Input: the order lines (orderItemId, description, catalog item, quantity) and the customer.
  - It runs `lines` and, for a line without `sourceItemId`, reads its order to work out which
    garment it was.
  - Output per line: up to 5 candidates, each with `invoiceItemId`, the tag when known, the match
    (`exact` or `probable`) and why.
- `photos`:
  - Input: pairs of photo paths (current garment and cited garment).
  - Output per pair: what is the same or different (fabric, size, detail, damage), and the 1–2
    closest pairs, so Sol can view those itself before a close call.

### Draft and server check

- Sol writes each line in full: `description`, `quantity`, `unit`, `unitPrice | null`, the
  `orderItemIds` it covers, a short Thai `reason`, `citations` (`invoiceItemId` and the compared tag)
  and an optional PriceList row (`itemCode`, `serviceType`, `priceGroup`). Lines need not map one to
  one onto order items, and the price need not equal a cited price.
- The AI server checks facts from fresh GViz reads before the reply is stored, with the same readers
  as the scripts:
  - the main order must exist; `customerId` comes from it. A line may name another order of the
    same customer (`orderId`), else it belongs to the main order;
  - a line with an empty description is dropped; a bad quantity becomes 1 and an empty unit `piece`;
  - `orderItemIds` outside the line's order are dropped;
  - unknown cited `invoiceItemId`s and PriceList rows not in effect are dropped silently. The
    citation's invoice, order, description, quantity, unit, price and photo are resolved from the
    sheets, never from model text;
  - `source` is derived by the server: no price → `needs-price`; a citation from this customer →
    `customer-history`; another customer's → `other-history`; a PriceList row → `price-list`;
    otherwise `chat` (a price staff gave or the agent chose without a citation).
- No warnings are raised. Only the checked draft reaches the card and the prefill.
- Each turn's prompt starts with a standing instruction to follow staff (`turnPrompt`), so changed
  rules reach the long-lived session without starting a new one.
- Citation strength is shown as is, not hidden. Only the photo link varies:
  - "exact": the cited line's `sourceItemId` leads to an OrderGarments row with that
    `orderitem_id`, then to that garment's photo on the same order;
  - "probable": any weaker link, for example an older line without `sourceItemId` or a garment link
    left empty. The photo is a garment of the same kind from the cited order;
  - "no photo": the cited order has no garment photo, or a CYCLE invoice has no order.
  The admin decides. This is the agreed exception to "cite the
  garment photo", because nearly every existing invoice line predates provenance.
- A line sourced from PriceList only cites the PriceList row, with no invoice or photo.

## Known data limits

- Old lines have no `sourceItemId`, so their photo citations are "probable". An order with several
  garments of the same kind yields all their photos.
- CYCLE invoices have no source order. They cite an invoice line only, with no order or photo.
- `OrderGarments.orderitem_id` is filled only when known. The fallback is the order's garments with
  the same catalog item.
- Orders from before tag registration have no garment photos, only OrderImages.
- Legacy photo type spellings vary.

## Not in v1

- Package credit deduction (owner, 2026-11-25). v1 drafts normal bills only and does not read
  customer packages or credits.

## Verification

- W:
  - `typecheck:web`, `typecheck:api`, `vite build`;
  - dry-tests: the invoice list `orderId` filter; the provenance write rejects a foreign order item; prefill applies once and
    is refused on an ID mismatch or an existing invoice.
- AI:
  - unit tests for the GViz `lines` reader: header mapping, and that it excludes non-issued
    invoices;
  - unit tests for the draft check: a fake citation, a price mismatch, the wrong customer source, a
    foreign order item, a model-supplied URL ignored;
  - unit tests for the role gate and the absence of a write path;
  - one live turn on a KLX (cbcc555a) order after the Docker rebuild.
- Browser: a Claude in Chrome check of the card, the links, the prefill and a KLX invoice create.
- Live run: confirm that Codex subagents can open local image files under the agent sandbox.
