# Shared QR scanner overlay

`src/shared/components/QrScannerOverlay.vue` is a full-screen, generic camera overlay. It accepts `open` and `title`, emits `close` and `scan(value)`, and exposes a `result` slot at the bottom. The owning page controls the route and decides what a scanned value means.

It requests one rear camera stream at ideal 1280 × 720 and decodes full frames for QR Code and Code 128 through the shared scanner engine. The engine uses native BarcodeDetector when QR Code is supported, otherwise it lazily loads the barcode-detector ponyfill with a self-hosted ZXing-C++ WASM asset. It suppresses repeated reads of the same value for 2000 ms, vibrates briefly when supported, and stops the stream on close or unmount. Camera failures show a retry button. The scan frame animation respects reduced motion.
