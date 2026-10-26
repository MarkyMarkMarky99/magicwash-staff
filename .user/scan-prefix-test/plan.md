# Scan prefix browser test (2026-10-26)

App: http://localhost:3000 (vercel dev, already running; never stop it or its vite child).
Commit under test: `ae2aa499` on `feat/order-intake-page`. Plan: `docs/plans/scan-code-prefix.md`.

## Rules

- Read only. Never press Save, Start, Complete, Confirm, Print, Add photo, Register or anything that
  writes. Leave every page without saving (Discard where offered).
- Every scan is simulated with the gun helper below, never typed into a field.
- After each scan: read the URL, read the page, take one screenshot when something should appear.

## Gun helper

A scanner gun is a keyboard sending keys < 50 ms apart, then Enter. Paste this with the JavaScript
tool after every full page load (SPA route changes keep it):

```js
window.__gun = (text) => {
  for (const ch of text) {
    const code = /[a-z]/i.test(ch) ? 'Key' + ch.toUpperCase() : /[0-9]/.test(ch) ? 'Digit' + ch : ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch === '.' ? 'Period' : ''
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code, shiftKey: /[A-Z]/.test(ch), bubbles: true }))
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
}
```

Before each scan, blur any focused field: `document.activeElement?.blur()`.

## Mock data (live rows of customer Marky `a3e93305`, the owner's own account; read-only use)

| name | code to scan | what it is |
|---|---|---|
| G1 | `MWG-QruY68yk` | registered garment, Marky |
| G1-lower | `mwg-QruY68yk` | same, lower-case prefix |
| G2 | `MWG-7QQtHpoj` | registered garment, Marky |
| G2-legacy | `7QQtHpoj` | same, old tag without prefix |
| GX | `MWG-ZZZZ9999` | well-formed, not registered |
| GBAD | `MWG-abc` | malformed |
| B1 | `MWB-e7f8a9b0` | bag barcode |
| W1 | `MWG-dZaBsip0` | garment with an Ironing Pending ticket, order `5aed2e17` |
| W2-legacy | `iCW7WVwH` | garment of order `5aed2e17` (Ironing Pending), no prefix |
| P1 | `MWG-UlWEhtqa` | garment of order `e9e63dd8`, ready for Packaging |

## Cases

### A. Any page (`#/orders`)
1. G1 → full-screen garment detail overlay for `QruY68yk`; URL query `scannedGarment=QruY68yk`.
2. Browser Back → overlay closes, still on the order list, no extra history entry left.
3. G1-lower → opens the same garment.
4. With it open, scan G2 → overlay now shows `7QQtHpoj` (replaced, not stacked); one Back closes it.
5. GX → notice "Tag not registered", nothing opens.
6. GBAD → notice "Tag not registered", nothing opens.
7. G2-legacy → nothing happens.
8. B1 → nothing happens.
9. Inside the overlay: the photo Add button is visible (shared history mode); do not press it.

### B. Half-filled form (`#/orders/new`)
1. Type text into one field, blur it, scan G1 → overlay opens.
2. Back → overlay closes, the typed text is still there. Leave without saving.
3. With the cursor still inside a text field, scan G1 → nothing happens (gun input is ignored while
   typing). Record what happens.

### C. Intake (`#/orders/new/intake/a3e93305`)
1. G1 → garment added to the list, no garment detail overlay, URL has no `scannedGarment`.
2. G2-legacy → garment added.
3. B1 → refused with the page's own message.
4. Discard the draft.

### D. Department work (`#/departments/ironing`, Pending tab)
1. W1 → that ticket selected / moved to top with the page's own notice; no overlay.
2. W2-legacy → selected.
3. GX → page's own "No job for this tag" message; no overlay.
4. Clear the selection. Do not press Start.

### E. Packaging (`#/departments/packaging/e9e63dd8`)
1. Open a new bag sheet (do not confirm). P1 → "Added to this bag"; no overlay.
2. Remove the bag / leave without confirming.

### F. Console
- Record any console error during A–E.

## Report

Per case: PASS / FAIL, what was seen (URL, notice text), screenshot for failures. List anything
that could not be done and why.
