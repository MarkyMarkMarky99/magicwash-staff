# feat/scan-popup-photo

- Status: committed, owner-tested on `vercel dev` 2026-10-17; not merged or deployed.
- Design source: `.user/prototypes/scan-confirm-prototype.html` (popup) and `check-mark-variants.html` (variant E chosen).
- Popup shows photo, customer name, customer index; never order id or tag (unreadable to staff).
- Scan-to-top: gun reads only; tap never reorders; resets on clear/deselect/tab/send.
- Not done: camera overlay keeps old text card; photo not dimmed for "Not in this tab"/multi-task as the prototype did.
- Next: merge to main, then phone/gun check on prod.
