# feat/wash-queue-auto-tag

- Booking needs only a photo; machine, tag and program are pre-filled, weight is optional (null allowed).
- Tag = machine letter + 3 digits; rules in `docs/features/wash-queue/wash-queue.md`, code in `src/features/wash-queue/tag-code.ts`.
- `/api/machines` now returns every status and is cached 24 h (persisted).
- Owner reviews the form in the browser before push; tags are handwritten, no new physical labels.
- Not done: browser check, push/deploy; G Drive `WashQueue.json` `tag_code` description still says A-Z letter (owner edits the registry).
