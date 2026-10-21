# Agent chat

Agents are AI helpers staff chat with from the side menu entry "Agents". `register-customer` and `price-check` use the live MagicwashAI `chat` task. `order-tracking` still returns a canned reply.

## Screens and routes

- `/agents` (`agent-list`): one row card per agent, avatar at the left edge, name, role line, description, chevron. Three agents: `register-customer` (น้องลงทะเบียน), `price-check` (น้องราคา), `order-tracking` (น้องติดตาม).
- `/agents/:agentId` (`agent-chat`, `meta.parent = agent-list`): a full page with its own top bar (back, avatar, name, role, "จบงาน"). Back returns to the list through `useGoBack`. An unknown `agentId` replaces the route with the list. The page is excluded from `KeepAlive`; the history lives in the store, not the component.
- The chat shows the not-saved notice, an empty state with greeting and three suggestion chips, staff bubbles with up to three image thumbnails, agent bubbles with the avatar, a thinking bubble, an error bubble with "ลองใหม่", and a composer (attach up to three images, multi-line input, send disabled while thinking).
- "จบงาน" opens a confirm overlay; confirming clears that agent's chat and returns to the agent list.

## Proposal cards

An agent reply carries `proposal` and `warnings`; the card is chosen from the proposal shape.

- Customer draft (`customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, `customerType`): "เปิดฟอร์มลูกค้า" opens the customer create route with the card's non-null values prefilled. Warnings show in orange.
- Price rows (`rows[]` of `itemCode`, `name`, `serviceType`, `priceGroup`, `unit`, `price`): a price table.
- Tracking (`orderId`, `customerName`, `statusLabel`, `steps[]`): a status timeline.

## Customer form prefill

The customer card emits its proposal through the message list to `AgentChatPage`. The page puts only non-null values for `customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, and `customerType` into `src/shared/navigation/customer-create-prefill.ts`, then pushes `customerCreateRoute()`. No customer data enters the URL or history state.

The shared module holds one in-memory value: `setCustomerCreatePrefill(values)` replaces it and `takeCustomerCreatePrefill()` returns it once and clears it. Reloading loses it. The customer form consumes it on mount in create mode only, filling provided values only where the matching form field is empty. Edit mode ignores it. Both pages are excluded from KeepAlive. Staff review and save through the existing form validation and save button; the hand-off adds no validation or business logic. All eight keys exist in form state, including WhatsApp; customer type remains hidden in create mode and omitted from the existing create payload. See [Customer registration](../customers/registration.md).

## State

- `useAgentChatStore` (`src/features/agents/stores/agent-chat.store.ts`) holds one chat per agent in memory only: messages, thinking flag, draft text, draft images. No localStorage or IndexedDB.
- History survives leaving to the list and re-entering. It is cleared by "จบงาน" or a page reload.
- Each chat has `sessionId: string | null`, null until the first reply and sent with every later message; "จบงาน" resets it to null.
- "จบงาน" aborts an in-flight request for that agent; late replies are discarded.
- `SESSION_NOT_FOUND` clears the session and shows "บทสนทนาเดิมหมดอายุ เริ่มใหม่แล้ว กดลองใหม่เพื่อส่งอีกครั้ง". Retry sends the failed message and images with no session ID. Other failures use the generic error bubble.
- The text input uses `:value` and `@input`, never `v-model`, so Thai IME composition works.

## Sending

`sendAgentMessage` prepares images and calls the shared `sendChat` wrapper with the configured AI gateway URL and Firebase token. An unconfigured gateway fails without a request. The webapp sends only the new message and new images, plus the returned session ID on later turns; it performs no customer lookup or price checking. Results supply the reply, proposal and top-level warnings; customer proposal inner warnings are omitted from the UI proposal.

Each screenshot is resized to at most 1080 px wide with proportional height and no height limit, then encoded as JPEG at quality 0.85. If larger than 4.5 MiB, it is re-encoded at quality 0.7. Files are named `image-<n>.jpg` and attached with role `reference`.

Only `order-tracking` keeps the approximately 2 s fake response and the exact `error` message trick for showing a generic error bubble.

## Verification

Run the chat wrapper test with `npx tsx tests/shared/ai-gateway/chat.dry-test.ts`. Run the Pinia workflow test with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/features/agents/stores/agent-chat.store.dry-test.ts` (Node 22 module mocking isolates gateway configuration). Both use fake fetch responses and make no live service calls.
