# fix/document-scanner-capture

- Port of `fix/document-scanner-quality` without the lab diagnostics; measured on the shop phone via `diag/document-scanner-lab`.
- Changes: warp from native frame (2400 cap on output only); haptic after the frame grab; `createImageBitmap` 'high' downscale for detection; one model preloaded at app idle.
- Measured: output 957x1337 → ~1650x2330; captured/best-frame sharpness 0.5 → 1.0–1.3; detect draw 230–280 ms → ~30 ms.
- Open: accept stage now ~1 s (enhance 600–690 ms) — move to a Web Worker only if staff find it slow.
- Open: first ~2 s of detection often misses with slow ML passes (220–400 ms); unclear if aiming or detection.
- After merge: delete this file, `fix/document-scanner-quality`, and (owner's call) `diag/document-scanner-lab`.
