# Direct chat web data layer

The non-visual integration supports human 1:1 conversations through MagicwashAI. Only signed-in
admin/staff sessions bind the store; the gateway enforces roster eligibility and membership.
There is no new Vercel function. No conversation content is persisted in browser storage.
The `/agents/dm/:conversationId` route (`direct-chat`, parent `agent-list`) has an admin/staff guard
and is excluded from KeepAlive.

## Web UI

**Chats page** (`/agents`, `AgentListPage.vue`, title "Chats"; the nav entry is also "Chats"). The agent
rows are unchanged. Below them (and the admin Assignments row) a "People" section lists
`useDirectChatStore().inbox` newest first through `DirectChatRow.vue`: peer name, last message text or
"Photo" when it has images and no text, a short relative time (`formatRelativeTime`: "Just now", "5m",
"3h", "2d", then a Bangkok date) and the server unread badge. The inbox refreshes each time the page is
shown. The "New chat" button opens `NewChatPicker.vue` (a `PickerOverlay`, local open state) listing
`useStaffStore().items` that are active, role `admin` or `staff`, not the viewer, and not `AI` or
`AI-*`. The picker loads the staff store when it is not loaded or last failed and shows Retry on error.
Picking calls `startConversation(peerStaffId)` and pushes `direct-chat`. A muted line under the section
says messages to people are translated by AI and OpenAI receives the message and recent context. An
inaccessible conversation returns here with `?notice=conversation-unavailable`, shown as a dismissible
"Conversation not available" notice (dismiss replaces the route without the query).

**Conversation page** (`DirectChatPage.vue`, component name kept for the `KeepAlive` exclude). Header
`DirectChatBar.vue` (back through `useGoBack`, peer name). Messages use `TeamAgentEventList` and the
composer is `AgentComposer` (images on, max 3, `maxlength` 4000). Lifecycle: `openThread` on mount and
whenever the conversation ID or viewer changes; `setThreadVisible` follows `document.hidden` once the
thread is open; `closeThread` on unmount; `loadOlder` when the list is scrolled to its top (the "Load
earlier messages" button remains, and automatic loading stops after a failure);
`markVisiblePeerRead(latest peer seq)` only while the page is visible, the thread has loaded and the list
is scrolled to the bottom (within 48 px). Image placeholders carry `data-image-id`; an
`IntersectionObserver` (300 px margin) calls `loadImage` once per image when it nears the viewport, and a
rejected download shows the broken-image tile. A `NOT_FOUND` `AiGatewayError` from any call replaces the
route with the Chats page. Another open failure shows "Could not load this chat" with Retry.

Sending keeps the draft (text and images) in the composer until the send succeeds. When `pendingSend`
remains after a failure the composer is disabled and a strip "Message not sent" offers Retry
(`retrySend`) and Discard (`discardPendingSend`); an image-preparation failure (no pending payload)
shows a dismissible error instead.

**Translation** (`DirectChatTranslation.vue`, in the list's `staff-extra` slot). Only for messages with
text. The recipient sees the original and, below it, "Translated · Thai|Burmese|English" and the
translation. The sender sees "Sent as <language>: <text>". `pending` (and a running retry) shows
"Translating…"; `unavailable` shows "Translation unavailable" and a Retry button calling
`retryTranslation(seq)`. `same`, `off` or a missing translation shows nothing extra. The translation
text carries the target `lang`.

**Preferred language** is set by admins on the staff profile; see [Staff profile](../staff/profile.md#preferred-language).

## Ownership and protocol

`contracts/ai-gateway/direct-chat-api.schema.ts` and `preferences-api.schema.ts` own Zod schemas.
`shared/ai-gateway/tasks/direct-chat.ts` and `preferences.ts` validate requests and results with
those schemas. Services supply the configured main gateway URL and Firebase Bearer token.
DM endpoints are under `/direct`; preferences are at the main `/preferences`, never the secretary
base URL. Calls use the existing 20-second gateway deadline. Image reads return authenticated Blobs.
Direct-chat timestamps retain the gateway's UTC ISO representation, including milliseconds.

- Inbox GET returns `{ conversations }`; its `unread` counts come from the server.
- Latest/before history returns `{ conversationId, peer, messages, highWater, hasMore, readSeq }`.
  `loadOlder` uses the first loaded message's numeric seq as `before`, never as the polling cursor.
- After history returns `{ messages, translationUpdates, nextAfter, hasMore }`. The store starts
  from the initial `highWater`, drains every `hasMore` page and advances `nextAfter` even for pages
  containing only translations. A non-advancing cursor with `hasMore` is an error.
- Translation updates replace the loaded message's translation with `to = lang`, state `pending`
  for error `pending`, `unavailable` for another error, otherwise `done`, preserving `text`/`same`.
  Message translation state also accepts `off`. Translation retry POST returns `{ translate }`.
- Message POST sends JSON `{ text, clientId }` without images, otherwise multipart field `request`
  containing that JSON and repeated file fields `images`. No multipart Content-Type is forced.
- Read POST sends `{ eventId }` and returns `{ readSeq }`. Neither opening nor polling marks read.

## Store API for the UI worker

Import `useDirectChatStore` from `@/data/direct-chat/direct-chat.store`. Pinia unwraps these state
fields; use `storeToRefs` when destructuring reactive state. Treat state as read-only from the UI.
Types `DirectChatMessage`, `DirectChatInbox`, `DirectChatPeer`, `DirectChatSend` are exported by the
service; all derive from schemas. `DirectChatInbox` is the conversation-row array, not its envelope.
`PendingDirectChatSend` is exported by the store.

| State | Type / meaning |
| --- | --- |
| `inbox` | `DirectChatInbox`, initially `[]` |
| `unreadTotal` | computed `number`, sum of inbox unread counts |
| `inboxLoading`, `inboxError` | `boolean`, `unknown` (initially null) |
| `conversationId`, `peer` | `string \| null`, `DirectChatPeer \| null` |
| `messages` | `DirectChatMessage[]`, ascending seq, deduplicated |
| `nextAfter` | `number`, journal cursor (initially 0) |
| `readSeq` | `number`, server-confirmed read position (initially 0) |
| `hasOlder` | `boolean`, latest before-history `hasMore` |
| `loading`, `loadingOlder`, `sending` | `boolean`; sending includes image preparation |
| `error` | `unknown`, initially null; thread/send error |
| `pendingSend` | `PendingDirectChatSend \| null`, `{ text: string, clientId: string, files: File[] }` |
| `imageUrls` | `Record<string, string>`, image ID to owned object URL |
| `threadVisible` | `boolean`, page visibility supplied through its action |

| Action signature | Behavior |
| --- | --- |
| `refreshInbox(): Promise<void>` | Single-flight refresh; failures populate `inboxError` |
| `invalidateInbox(): Promise<void>` | Increment version and refresh; an in-flight obsolete snapshot is discarded and fetched again |
| `startConversation(peerStaffId: string): Promise<string \| null>` | Create/get conversation ID; null if no viewer or response became stale; does not open it |
| `openThread(id: string): Promise<void>` | Close/reset previous thread, load latest history; current errors recorded and rethrown |
| `closeThread(): void` | Clear thread, draft, cursors and URLs; inbox remains |
| `loadOlder(): Promise<void>` | Prepend older messages; preserve polling cursor and loaded translations |
| `pollThread(): Promise<void>` | Single-flight after-history drain; failures populate `error` |
| `setThreadVisible(visible: boolean): void` | Enable/disable 15-second polling; true also refreshes immediately; document hide pauses and resume refreshes |
| `markVisiblePeerRead(seq: number): Promise<void>` | Explicitly mark a loaded peer message; no-op while page/document hidden or seq already read; then refresh inbox |
| `send(text: string, files?: File[], options?: { prepared?: boolean }): Promise<void>` | Prepare files then send; errors recorded and rethrown; no-op while sending or a failed pending send remains |
| `retrySend(): Promise<void>` | Reuse pending text, UUID and exact prepared files; clear pending on success |
| `discardPendingSend(): void` | Drop failed pending send, unless currently sending |
| `retryTranslation(seq: number): Promise<void>` | Retry via message seq and update loaded message translation |
| `loadImage(imageId: string): Promise<string \| null>` | Lazy single-flight Blob download/cache; null if stale; current errors reject |
| `bindSession(staffId: string \| null, sessionKey?: unknown): void` | Infrastructure action, automatically called by the store's synchronous auth watcher; UI must not override it |

Use `openThread` from a watcher of route conversation ID and signed-in viewer, with immediate
execution. After opening, call `setThreadVisible(true)` while the page is shown, false when hidden,
and `closeThread()` on leaving. The Pinia store watches auth independently and clears immediately;
the page watcher must reopen for a new viewer. Store generation checks protect A → B → A visits.
The page owns route errors: on `AiGatewayError.code === 'NOT_FOUND'`, replace with `agent-list` and
show “Conversation not available”. App keys this route by conversation ID and viewer.

Only call `markVisiblePeerRead` when the page is visible and scrolled to the bottom, passing the
latest visible peer message's seq. The store checks visibility and that the message is a peer's;
scroll position is the page's responsibility. Never mark read merely because a request completed.

A failed send retains one retry payload in memory. Preserve the composer draft on rejection and
use `retrySend` to retry it. To edit/send a different payload, explicitly discard the old pending
payload first. A successful send does not advance the after cursor, so subsequent polling still
receives all intervening messages and translation events.

`prepareChatImage(file: File): Promise<File>` lives in `@/utils/prepare-chat-image` next to the
existing image utilities. It caps the longest side at 1280 px without upscaling, then uses
`encodeCanvasToJpeg` at 0.82. A null encode throws `ChatImagePreparationError`; nothing is sent.
Ordinary picker images are prepared by `send`. Pass `{ prepared: true }` only for CameraOverlay
output or files already prepared by this helper. The boundary allows at most three JPEG/PNG files,
5 MiB each, 4000 text characters, and empty text only with an image.

Responses and prepared/downloaded images are scoped to auth session, conversation ID and open
thread generation. Closing/auth change revokes every cached image URL. Late downloads create no
URL. Old successes and failures cannot repopulate a newly bound thread. Inbox state has its own
auth generation and invalidation version; multiple refreshes share one request/drain.

## Service API

Import from `@/data/direct-chat/direct-chat.service`. UI normally uses store actions.

```ts
fetchInbox(): Promise<{ conversations: DirectChatInbox }>
createConversation(peerStaffId: string): Promise<{ conversationId: string; peer: DirectChatPeer }>
fetchHistory(id: string, options?: { before?: number; limit?: number }): Promise<{
  conversationId: string; peer: DirectChatPeer; messages: DirectChatMessage[];
  highWater: number; hasMore: boolean; readSeq: number;
}>
fetchAfter(id: string, after: number): Promise<{
  messages: DirectChatMessage[]; translationUpdates: DirectChatTranslationUpdate[];
  nextAfter: number; hasMore: boolean;
}>
sendMessage(id: string, body: DirectChatSend, files?: File[]): Promise<{ message: DirectChatMessage }>
markRead(id: string, eventId: string): Promise<{ readSeq: number }>
retryTranslation(id: string, seq: number): Promise<{ translate: DirectChatTranslation }>
fetchImage(id: string, imageId: string): Promise<Blob>
```

## Preferred language and unread

`@/data/preferences/preferences.service` exports `fetchPreferences(staffId: string):
Promise<StaffPreferences>` and `updatePreferences(staffId: string, language: PreferredLanguage):
Promise<StaffPreferences>`. `StaffPreferences = { staffId: string; language: 'th' | 'my' | 'en' }`.
The store `usePreferencesStore()` has `preferences: StaffPreferences | null`, `loading`, `saving`,
`error: unknown`, `load(staffId): Promise<StaffPreferences | null>`,
`update(staffId, language): Promise<StaffPreferences | null>` and `reset(): void`.
Stale requests return null; current failures are recorded and rethrown. Auth changes reset it.
GET is `/preferences?staffId=...`; POST is `/preferences` with `{ staffId, language }`.
The gateway permits admin reads of any staff member and staff reads of self; only admin may write.

The existing staff-page `useSecretarySettingsStore` API remains compatible: its service composes
main preferences with secretary `codexReady`. Language saves go only to `/preferences`, followed by
a secretary readiness read; enable/disable continues through the staff service. The UI worker can
use `usePreferencesStore` independently for every active human admin/staff, including those without
a secretary. The staff profile uses it for its "Preferred language" card.

`useAgentsUnread` polls DM inbox every 60 seconds for admin/staff regardless of visible AI agents.
Its `total` is AI unread plus DM unread (nav injection); `aiTotal`, `byAgent` and `latest` contain
only AI-chat data, and App uses `aiTotal` for the floating bubble.

## Verification

All dry tests use fake services/fetch and make no live gateway calls.

```sh
npx tsx tests/shared/ai-gateway/direct-chat.dry-test.ts
npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/direct-chat/direct-chat.store.dry-test.ts
npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/preferences/preferences.store.dry-test.ts
npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/app/use-agents-unread.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/utils/prepare-chat-image.dry-test.ts
```

Live two-account delivery, membership denial, Thai/Burmese translation, shared-phone sign-out and
push, and phone/browser UI flows require the finished UI and a deployed MagicwashAI service.
