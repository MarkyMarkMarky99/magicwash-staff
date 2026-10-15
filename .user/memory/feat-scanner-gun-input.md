# feat/scanner-gun-input

- Keyboard-wedge gun scans select tickets on the department list (Pending / In Progress); confirm once via Start/Complete.
- Owner tested on `vercel dev` 2026-10-15 with order `27e16f92` test QR codes; nothing was confirmed/sent.
- Scan beeps changed app-wide: one 400 Hz square beep = success, two = failure/duplicate (owner picked the tone).
- Open: success notice still reads "Queued" for a gun scan; owner not asked to change it.
- Not yet tested on a phone/tablet with a Bluetooth gun; merge to main not requested.
