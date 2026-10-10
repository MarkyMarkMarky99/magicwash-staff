# feat/wash-queue-open-access

- Owner request 2026-10-10: remove all WashQueue permission gating; every signed-in staff can book, load, unload, pick up, cancel any basket.
- Removed the FIFO load lock: any waiting basket can be loaded; Next badge and queue number stay as display only.
- API already had no role/FIFO checks; no server change.
- Not pushed; browser-check swipes as a non-admin before merging.
