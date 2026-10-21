# Agent chat

Agents are AI helpers staff chat with from the side menu entry "Agents". The UI is built; replies are fake until the AI gateway `chat` task is wired in.

## Screens and routes

- `/agents` (`agent-list`): one row card per agent, avatar at the left edge, name, role line, description, chevron. Three agents: `register-customer` (น้องลงทะเบียน), `price-check` (น้องราคา), `order-tracking` (น้องติดตาม).
- `/agents/:agentId` (`agent-chat`, `meta.parent = agent-list`): a full page with its own top bar (back, avatar, name, role, "จบงาน"). Back returns to the list through `useGoBack`. An unknown `agentId` replaces the route with the list. The page is excluded from `KeepAlive`; the history lives in the store, not the component.
- The chat shows the not-saved notice, an empty state with greeting and three suggestion chips, staff bubbles with up to three image thumbnails, agent bubbles with the avatar, a thinking bubble, an error bubble with "ลองใหม่", and a composer (attach up to three images, multi-line input, send disabled while thinking).
- "จบงาน" opens a confirm overlay; confirming clears that agent's chat and stays on the page in the empty state.

## Proposal cards

An agent reply carries `proposal` and `warnings`; the card is chosen from the proposal shape.

- Customer draft (`customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, `customerType`): "เปิดฟอร์มลูกค้า" opens the customer create route without prefill; "แก้ไขต่อในแชต" focuses the composer. Warnings show in orange.
- Price rows (`rows[]` of `itemCode`, `name`, `serviceType`, `priceGroup`, `unit`, `price`): a price table.
- Tracking (`orderId`, `customerName`, `statusLabel`, `steps[]`): a status timeline.

## State

- `useAgentChatStore` (`src/features/agents/stores/agent-chat.store.ts`) holds one chat per agent in memory only: messages, thinking flag, draft text, draft images. No localStorage or IndexedDB.
- History survives leaving to the list and re-entering. It is cleared by "จบงาน" or a page reload.
- Each chat has `sessionId: string | null`, null until the first reply and sent with every later message; "จบงาน" resets it to null.
- Late replies that arrive after "จบงาน" are discarded.
- The text input uses `:value` and `@input`, never `v-model`, so Thai IME composition works.

## Fake send

`sendAgentMessage` in `src/features/agents/services/agent-chat.service.ts` is the only fake behaviour. It waits about 2 s and returns a canned `{ sessionId, reply, proposal, warnings }` per agent. It throws when the message text is exactly `error`, which shows the error bubble. Replace it with the AI gateway `chat` task; the store and components do not change.
