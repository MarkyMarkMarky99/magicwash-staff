# Shared QR scanner overlay

`src/shared/components/QrScannerOverlay.vue` is a full-screen, generic camera overlay. It accepts `open` and `title`, emits `close` and `scan(value)`, and exposes a `result` slot at the bottom. The owning page controls the route and decides what a scanned value means.

It requests one rear camera stream at ideal 1280 × 720 and continuously decodes QR_CODE and CODE_128 with ZXing. It suppresses repeated reads of the same value for 2000 ms, vibrates briefly when supported, and stops the stream on close or unmount. Camera failures show a retry button. The scan frame animation respects reduced motion.
