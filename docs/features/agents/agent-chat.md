# Agent chat

The side menu entry "Chats" (route `/agents`) opens the Chats page: AI helpers staff chat with, and a "People" section for direct messages (see [Direct chat](direct-chat.md)). `register-customer` and `price-check` use the live MagicwashAI `chat` task. `order-tracking` still returns a canned reply. `appointments`, `washing` and `ironing` are shared team chats and `personal` is one assistant per employee (see [Team agents](#team-agents) and [Personal assistants](#personal-assistants)).

## Screens and routes

- `/agents` (`agent-list`, page title "Chats"): one row card per agent, avatar at the left edge, name, role line, description, chevron. Seven agents: `register-customer` (น้องลงทะเบียน), `price-check` (น้องราคา), `order-tracking` (น้องติดตาม), and the team agents `appointments` (น้องนัดหมาย), `washing` (น้องซักผ้า), `ironing` (น้องรีดผ้า) and `personal` (ผู้ช่วยส่วนตัว, role line "My assistant"), the last three for `admin` and `staff`. Admins also get an "Assignments" row under the list that opens `/agents/personal-assignments`. Each catalog entry has an optional `roles` list; an agent whose list excludes the signed-in role (every `device` account, for the team agents) is hidden from the list and its route redirects to the list.
- `/agents/:agentId` (`agent-chat`, `meta.parent = agent-list`): a full page with its own top bar (back, avatar, name, role, "End"). Back returns to the list through `useGoBack`. An unknown `agentId` replaces the route with the list. The page is excluded from `KeepAlive`; the history lives in the store, not the component.
- UI text is English; only staff messages, agent replies, agent names, greetings and suggestion chips stay in Thai. The not-saved notice shows once per device (localStorage `agent-chat-notice-seen`) and hides itself after 6 seconds. The thinking bubble reads "Thinking… (may take up to a few min)". The composer textarea hides its scrollbar.
- The chat shows the not-saved notice, an empty state with greeting and three suggestion chips, staff bubbles with up to three image thumbnails, agent bubbles with the avatar, a thinking bubble, an error bubble with "Retry", and a composer (attach up to three images, multi-line input, send disabled while thinking). Enter sends; Shift+Enter adds a line; Enter during an open IME composition (Thai input) stays with the IME.
- "End" opens a confirm overlay; confirming clears that agent's chat and returns to the agent list.

## Proposal cards

An agent reply carries `proposal` and `warnings`; the card is chosen from the proposal shape.

- Customer draft (`customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, `customerType`): "เปิดฟอร์มลูกค้า" opens the customer create route with the card's non-null values prefilled. Warnings show in orange.
- Price rows (`rows[]` of `itemCode`, `name`, `serviceType`, `priceGroup`, `unit`, `price`): a price table.
- Tracking (`orderId`, `customerName`, `statusLabel`, `steps[]`): a status timeline.

## Customer form prefill

The customer card emits its proposal through the message list to `AgentChatPage`. The page puts only non-null values for `customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, and `customerType` into `src/shared/navigation/customer-create-prefill.ts`, then pushes `customerCreateRoute()`. No customer data enters the URL or history state.

The shared module holds one in-memory value: `setCustomerCreatePrefill(values)` replaces it and `takeCustomerCreatePrefill()` returns it once and clears it. Reloading loses it. The customer form consumes it on mount in create mode only, filling provided values only where the matching form field is empty. Edit mode ignores it. Both pages are excluded from KeepAlive. Staff review and save through the existing form validation and save button; the hand-off adds no validation or business logic. All eight keys exist in form state, including WhatsApp; customer type remains hidden in create mode and omitted from the existing create payload. See [Customer registration](../customers/registration.md).

## State

- `useAgentChatStore` (`src/features/agents/stores/agent-chat.store.ts`) holds one chat per agent in memory only: messages, thinking flag, draft text, draft images. No localStorage or IndexedDB (only the notice-seen flag uses localStorage).
- History survives leaving to the list and re-entering. It is cleared by "End" or a page reload.
- Each chat has `sessionId: string | null`, null until the first reply and sent with every later message; "End" resets it to null.
- "End" aborts an in-flight request for that agent; late replies are discarded.
- `SESSION_NOT_FOUND` clears the session and shows "The previous chat expired and a new one started. Tap Retry to send again.". Retry sends the failed message and images with no session ID. Other failures use the generic error bubble.
- The text input uses `:value` and `@input`, never `v-model`, so Thai IME composition works.

## Sending

`sendAgentMessage` prepares images and calls the shared `sendChat` wrapper with the configured AI gateway URL and Firebase token. An unconfigured gateway fails without a request. The webapp sends only the new message and new images, plus the returned session ID on later turns; it performs no customer lookup or price checking. Results supply the reply, proposal and top-level warnings; customer proposal inner warnings are omitted from the UI proposal.

Each screenshot is resized to at most 1080 px wide with proportional height and no height limit, then encoded as JPEG at quality 0.85. If larger than 4.5 MiB, it is re-encoded at quality 0.7. Files are named `image-<n>.jpg` and attached with role `reference`.

Only `order-tracking` keeps the approximately 2 s fake response and the exact `error` message trick for showing a generic error bubble.

## Team agents

`appointments`, `washing`, `ironing` and `billing` each have one shop-wide conversation, with history stored by MagicwashAI. They share the same team-chat implementation as the personal assistants. `appointments`, `washing` and `ironing` are available to admins and staff. MagicwashAI allows staff to confirm deliveries and restricts booking, rescheduling and cancellation to admins. `billing` is admin-only, including unread polling. Each has the route `/agents/<agentId>` (`team-agent-chat`, component `TeamAgentChatRoute`, excluded from `KeepAlive`, which renders `TeamAgentChatPage` keyed by `agentId` so switching agents on the same route mounts a fresh page) and uses the team-agent store. A user whose role is not allowed who opens the route is replaced to the agent list once the session has loaded. The speaker name on a staff message is the signed-in employee.

- State lives in `useTeamAgentStore(agentId, target?)` (`src/data/team-agent/`), one Pinia store per agent (per target employee for `personal`, see below), memory only, except the last-seen event ID in localStorage (`team-agent-last-seen-event:<agentId>`, per device, every access in try/catch). The old appointments key `appointments-agent-last-seen-event` is copied to the new key on first read and removed, so existing devices keep their read position. The calls go through `shared/ai-gateway/tasks/team-agent.ts` with a 20 s deadline: send (`POST /tasks/chat` with `input.agentId`, returns `{ accepted, turnId, eventId }` at once), history, image, reminders list, reminder cancel, notes, all under `/agents/<agentId>/...`. An optional `staffId` on `TeamAgentAccess` is sent as the chat `input.staffId` and as a `staffId` query on every one of those calls.
- Opening the page loads the latest 200 events. When 200 came back, a "Load earlier messages" button tops the list (every team agent): it fetches the 200 events before the oldest loaded one (`history?before=<eventId>&limit=200`; `after` and `before` are never combined), prepends them, keeps the scroll position, and hides once a fetch returns fewer than 200. The store exposes `hasOlder`, `olderLoading` and `loadOlder()`. Each shows the speaker name (staff name, "AI", or "System"); `action` events are compact lines with an OK / Failed / Unknown outcome chip; the action type is one of `create`, `reschedule`, `cancel`, `remind`, `reminder-cancelled`, `close`, `reopen`, `assign`, `assignment-done`, `assignment-cancelled`, `assignment-overdue`, `assignment-closed`. A history speaker may carry `role` (`admin`, `staff` or `system`); the page does not use it to restyle bubbles. Event text is plain Thai prose and is shown as received. An `action:<attemptId>:attempt` event is hidden once the matching `action:<attemptId>:result` event is present (`visibleEvents` in the store); every other event renders unchanged.
- Images: the composer uses the same picker, three-image limit and downscale as the other agents (`AgentComposer`, `downscaleScreenshot`). Send is multipart through `callAiTask` files with role `reference`; the message may be empty when images are attached. The optimistic bubble shows the local previews. History events with `images` show thumbnails in the message (same markup as `AgentMessageList`, no viewer). Each image is fetched from `GET /agents/<agentId>/images/:id` with the Bearer token as a Blob, held as an object URL cached per image id, and revoked when the chat page closes.
- Sending shows an optimistic staff bubble, posts, then polls. The bubble is dropped once its `eventId` is in the history. A failed send removes the bubble, shows the error and puts the text back in the composer if it is empty. There is no auto-retry.
- Polling fetches only events after the last known event ID: on window focus, after a send, and every 15 s while the page is open. While history reports `busy` the list ends with a quiet "Working…" row.
- No End button, no clear or session reset, no "not saved" notice. The bar's "Reminders" button opens a panel: pending reminders (due time, note, created-at) each with Cancel, and the AI's notes read-only (file name and content), both reloaded on open.
- Unread counting: `src/App.vue` calls `useAgentsUnread` (`src/app/composables/useAgentsUnread.ts`), which polls every 60 s each team agent the signed-in role can see (nothing for `device` or signed-out) and binds the signed-in staff ID to every team store. It also polls DM inbox for admin/staff independently of visible agents. It returns nav `total` (AI + DM), `aiTotal` (AI only), `byAgent` and `latest`; `App.vue` provides `total` as `agentsUnreadKey` and `byAgent` as `agentsUnreadByAgentKey` (`src/shared/agents-unread.ts`). MagicwashAI stores the read position per staff member and chat. The next poll picks up reads from another device. Each store counts events after that position, excluding events the viewer sent (`speaker.staffId` equal to the bound viewer) and an action `:attempt` whose `:result` is already present. Agent, system and action events and other staff's messages count. The store also keeps `latestUnreadAi`, the newest unread `agent` or `system` event; both reset when the chat shows the latest event. For these chats, localStorage is a fallback and supplies a one-time migration when MagicwashAI has no read position. With no marker in either place, the badge starts from the latest event.
- Row badge: each team-agent row on `/agents` shows its `byAgent` count in a filled `error` pill (`1`–`99`, `99+`) before the chevron, hidden at 0, the same style as the "Chats" menu entry's total.
- Floating bubble: `AgentFloatingBubble` (`src/features/agents/components/`) is mounted by `App.vue` inside the app shell (above page content and header, below `#overlay-root` so any modal overlay covers and inerts it) only after the shell has mounted and only while `useAgentBubble` (`src/app/composables/useAgentBubble.ts`) has a message. It shows the 56 px avatar of the agent holding the newest unread agent or system message (`latest`, compared by event `at`), a speech bubble with that agent's name and the message text without markdown symbols (`plainBubbleText`) clamped to 3 lines, and a count pill on the avatar when more than one message is unread across AI chats. DM unread is excluded from the floating bubble. It never shows for `device` or signed-out accounts, on public routes, or while the viewer is on that agent's own chat route. Tapping the avatar or bubble pushes `/agents/<agentId>`, whose `openChat` marks the chat read. The × button hides it until a newer message arrives; the dismissed event ID and its `at` are kept in localStorage `agent-bubble-dismissed:<staffId>`. It is draggable by pointer events (touch and mouse): a move under 6 px is a tap, a longer one drags the avatar and bubble together, and on release the group snaps to the nearer left or right edge with a 12 px margin, kept above a bottom reserve of 88 px plus the safe-area inset; the bubble sits on the side away from the edge. The side and vertical position are kept per device in localStorage `agent-bubble-position`. The entrance fade is dropped under `prefers-reduced-motion`. All storage access is in try/catch.

### Billing draft hand-off

The billing agent appears as **น้องออกบิล** with the role line **Billing assistant**. A team history event can carry an optional, nullable `proposal` that follows `BillingDraft` in `contracts/ai-gateway/billing-draft.schema.ts`. The history parser turns an invalid proposal into `null` and retains the event. `useTeamAgentStore('billing').visibleEvents` preserves the proposal on each event passed to `TeamAgentEventList`.

`TeamAgentChatPage.openBillingDraft(draft: BillingDraft)` puts the draft in a one-shot, in-memory slot and pushes `/invoices/create` with `customerId` and `orderId`. Invoice creation consumes the slot on context load and checks both IDs against the loaded order. A fresh invoice list request filtered by `orderId` checks for an existing invoice even when the order link is empty. If one exists, the page shows the existing duplicate warning and keeps the seeded lines.

The draft lines replace the lines seeded from the order: description, quantity, unit and price as the agent wrote them, a blank price when it is null. A line covering exactly one order item keeps it as `sourceItemId`; a cited PriceList row's `itemCode` becomes `sku`. The form retains `photoMatch` and `source` as optional local fields. Staff review and submit the invoice through the normal create form. See [invoice API provenance and order filtering](../../architecture/backend/service-layer.md#invoice-provenance-and-order-filtering).

## Secretary

MagicwashAI uses a server-only `SECRETARY_PROXY_KEY` to call Vercel with `x-secretary-key`
and `x-assistant-id`. The assistant is an active Staff row with role `assistant` and StaffId
`AI-<owner StaffId>`. History resolves that StaffId to the assistant's name. Vercel reads the
active owner's role and departments for every request.

The allowlist covers staff directory, customer, appointment, work-order, job-ticket, and weekly
attendance reads (`GET /api/attendance`, only query key `week` as a string date).
Staff and admin owners can have their secretary book their own day off via
`POST /api/attendance/day-off` with exactly `{ workDate }`. The attendance subject is the owner;
`created_by` records `AI-<owner>`. Bangkok tomorrow through today+14, date conflicts and the
Monday-Sunday weekly quota apply as for self-booking. Attendance admin create, PATCH and DELETE
remain forbidden through the proxy, even for admin owners; assistants without `onBehalfOf` cannot book.
Admin owners can book, reschedule, and cancel appointments. Admin and staff owners can complete
appointments and work orders. A secretary can close job tickets for one order or for up to 200
orders in the same department. Closing and reopening require an admin owner or a staff owner
assigned to that department. Batch close reports completed tickets for each requested order and
awards no score.
See [Secretary API permissions](../../architecture/backend/operations.md#secretary).

### Secretary chat

The `secretary` agent (display name `เลขาส่วนตัว`) is a per-owner team agent like `personal`: the signed-in user talks to their own secretary, so its store and last-seen key are per staff member. The catalog entry permits `admin` and `staff`, and the list shows it only when the signed-in
owner's exact `AI-<staffId>` directory row is an active assistant. Missing, inactive, ambiguous or
unavailable directory state hides it. `agentVisibleToViewer` combines the role check with this gate;
`agentVisibleToRole` retains its role-only behavior for other agents. Background unread polling,
badges and the floating bubble use the same viewer gate. The directory is already preloaded;
secretary management actions update it immediately. This is a discovery gate; MagicwashAI and
Vercel enforce request permissions independently. It is a separate service: every call (history, images, reminders, notes, read markers, `POST /tasks/chat`) uses the base URL `<AI gateway base URL>/secretary` with the same contract as the other team agents. The admin "open another employee's assistant" route, the assignments page and push notifications do not apply to it.

## Personal assistants

`personal` is one assistant per employee; MagicwashAI resolves the instance. A staff member always gets their own. An admin gets their own and may open any employee's.

- Routes: `/agents/personal` (`team-agent-chat`, the viewer's own assistant, matched by the same route as the other team agents) and `/agents/personal/:staffId` (`personal-agent-target`, admin only; a non-admin is replaced to `/agents/personal` by a route guard). `TeamAgentChatRoute` keys the page by agent, target and signed-in staff ID, so changing agent, target or account mounts a fresh page. A target equal to the viewer's own ID is treated as the own chat.
- Target: `useTeamAgentStore('personal', staffId)` creates the store `team-agent-personal:<staffId>`; the own chat is `team-agent-personal:self`. The target is sent as `staffId` on every call of that store; the AI side enforces who may use it.
- The chat bar shows the target employee's name (staff store `nameOf`) over the "My assistant" role line. An admin's messages keep the admin as speaker. No notice is shown to the employee.
- Last-seen: `team-agent-last-seen-event:personal:<viewerStaffId>:<targetStaffId|self>`, so an admin reading another employee's chat never marks it read for that employee and two accounts on one device never share a marker. The other agents keep `team-agent-last-seen-event:<agentId>` (no migration). Without a viewer ID the personal store neither reads nor writes the marker.
- Identity change: `store.bindViewer(staffId)` resets a personal store (events, pending bubbles, panel, images, cursors, in-flight results) and re-reads the marker whenever the viewer differs. The page binds on mount and `useAgentsUnread` binds on every change of the signed-in staff ID, including sign-out.
- Unread: `useAgentsUnread` polls only the viewer's own personal chat (target `self`). Admin target stores keep a local read position and are excluded from background polling and badge counts.
- "Open assistant" on the staff profile (`StaffProfilePage`, admin only) pushes `personalAgentTargetRoute(staffId)` from `src/shared/navigation/form-routes.ts`.
- Reminders panel and notes read the same endpoints with the target; reminder cancel is allowed to admins on a target.

### Assignments page

The shared gateway accepts assignment records with an optional, nullable string `orderId`.
For department-agent assignments, `createdBy` can carry `kind: 'agent'`, an `agentId`,
and the initiating admin's `staffId` when present. Department-agent closures use the
`assignment-closed` history action (icon `task_alt`) and a `done` assignment status.

`/agents/personal-assignments` (`personal-assignments`, admin only; guarded like the target route and redirected to the list for a non-admin) lists work admins assigned through assistants. The list calls `GET /agents/personal/assignments?status=open|all` through `usePersonalAssignmentsStore`; the filter lives in the route query (`?status=all`, absent means Open). Each card shows the assignee, a status badge (Open, Done, Cancelled), an Overdue badge for an open assignment past `dueAt`, a failed-deliveries badge when `failedDeliveries > 0`, the detail, the due time (Bangkok display, prefixed with `Order <orderId>` when the assignment has an order) and who created it (for `createdBy.kind === 'agent'` the agent's catalog name, e.g. น้องซักผ้า, instead of an admin name). The card is the shared `AssignmentCard`. `GET /agents/personal/assignments` also takes `staffId` (admins may pass any id; a staff caller must omit it and gets only their own); the staff profile uses `status=open&staffId=<id>` for its Open assignments section (see `docs/features/staff/profile.md`) through `useStaffOpenAssignmentsStore`, and `listPersonalAssignments` / `fetchPersonalAssignments` take an optional `staffId`. Open cards have a Cancel button; it opens a confirm overlay, then `POST /agents/personal/assignments/:id/cancel` replaces the row with the returned assignment. The list supports pull-to-refresh. Response fields are parsed leniently (optional fields are nullish).

## Push notifications

Admins and staff can turn on phone notifications above the agent list. On iOS and iPadOS, open
the app from the Home Screen first. If permission is blocked, change it in the phone's settings.
Device accounts never subscribe.

MagicwashAI sends team replies to every subscribed admin or staff member who can see that agent.
Personal replies go only to the assistant's owner. The notification body is generic. Tapping a
notification opens the chat. Sign-in refreshes any existing subscription for the current account.
Sign-out unsubscribes the browser and closes displayed notifications.

## Verification

Run the push workflow with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/team-agent/push-notifications.dry-test.ts`.

Run the chat wrapper test with `npx tsx tests/shared/ai-gateway/chat.dry-test.ts`. Run the Pinia workflow test with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/features/agents/stores/agent-chat.store.dry-test.ts` (Node 22 module mocking isolates gateway configuration). Run the team-agent endpoint wrapper test with `npx tsx tests/shared/ai-gateway/team-agent.dry-test.ts`, its store test with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/team-agent/team-agent.store.dry-test.ts`, and the catalog role test with `npx tsx --tsconfig jsconfig.json tests/web/unit/features/agents/agents.dry-test.ts`, and the bubble helpers test with `npx tsx tests/web/unit/features/agents/agent-bubble.dry-test.ts`. The service-key allowlist (including `GET /api/work-transactions` for the AI service key) is covered by `npx tsx tests/server/unit/api/staff-auth-gateway.dry-test.ts`. All use fake fetch responses and make no live service calls.

### Secretary settings

MagicwashAI owns preferred language and Codex readiness. The staff data layer now reads and saves
language through main `/preferences`; secretary settings supply only readiness to the compatibility
service. The low-level secretary wrapper remains available with this protocol: `GET <gateway>/secretary/settings?staffId=<ownerId>`
returns `{ staffId, language: 'th' | 'my' | 'en', codexReady: boolean }`; admins may read any owner,
staff only themselves. Admin-only `POST` to the same URL accepts exactly `{ language }` and returns
the same shape. Both use the configured AI gateway base URL and Firebase Bearer token, as secretary
chat does, with the shared 20-second deadline and error handling. Contracts live in
`contracts/ai-gateway/secretary-api.schema.ts`; the wrapper validates inputs and responses, including
the returned owner ID. No settings are stored in Sheets. See
[profile integration](../staff/profile.md#secretary-data-integration) for store/service signatures.

Secretary-specific dry tests: `npx tsx tests/shared/ai-gateway/secretary.dry-test.ts`,
`npx tsx tests/server/unit/api/staff-api.dry-test.ts`,
`npx tsx tests/server/unit/api/secretary-gateway.dry-test.ts`,
`npx tsx --tsconfig jsconfig.json tests/web/unit/data/staff-store.dry-test.ts`, and
`npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/team-agent/secretary-settings.store.dry-test.ts`.
The catalog test above covers both roles and active/inactive secretary states.


## Direct conversations

Staff-to-staff chats are implemented separately from AI agent stores. The role-gated
`/agents/dm/:conversationId` route renders `DirectChatPage`, which reuses `TeamAgentEventList` (its
`agent` prop is optional and the AI-event branch is guarded, so agent chats render as before) and
`AgentComposer`. Direct-chat inbox unread contributes to the nav badge, and never to the AI floating
bubble. Main-gateway preferences are available independently of secretary enablement. See
[Direct chat](direct-chat.md) for the UI, exact store/service APIs and lifecycle responsibilities.
