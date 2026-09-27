import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../src/${path}`, import.meta.url), 'utf8')
}

const button = source('shared/components/CloseButton.vue')
assert.match(button, /<script setup lang="ts">/)
assert.match(button, /label: 'Close'/)
assert.match(button, /tone: 'onLight'/)
assert.match(button, /type="button"/)
assert.match(button, /h-10 w-10/)
assert.match(button, /rounded-full/)
assert.match(button, /focus-visible:outline-2/)
assert.match(button, /:aria-label="label"/)
assert.match(button, /<span class="material-symbols-outlined" aria-hidden="true">close<\/span>/)
assert.match(button, /hover:bg-white\/10/)
assert.match(button, /hover:bg-black\/5/)

for (const path of [
  'app/auth/LoginPage.vue',
  'shared/layouts/BaseOverlayFrame.vue',
  'shared/components/NavSidebar.vue',
  'shared/components/QrScannerOverlay.vue',
  'features/orders/components/GarmentRegistrationCamera.vue',
  'features/orders/components/DocumentScannerOverlay.vue',
  'features/invoices/components/InvoiceProofLightbox.vue',
]) {
  const caller = source(path)
  assert.match(caller, /import CloseButton from '@\/shared\/components\/CloseButton\.vue'/, path)
  assert.match(caller, /<CloseButton\b/, path)
}

const frame = source('shared/layouts/BaseOverlayFrame.vue')
assert.match(frame, /<slot v-if="closeButton" name="close-button">[\s\S]*<CloseButton\b/)
assert.match(frame, /:tone="closeButtonTone"/)
assert.match(frame, /:class="closeButtonClass \|\| 'text-on-surface'"/)

for (const path of [
  'shared/layouts/DetailOverlay.vue',
  'shared/layouts/PickerOverlay.vue',
  'shared/layouts/LightboxOverlay.vue',
  'shared/layouts/FormOverlay.vue',
]) {
  const overlay = source(path)
  assert.match(overlay, /import BaseOverlayFrame from '@\/shared\/layouts\/BaseOverlayFrame\.vue'/, path)
  assert.match(overlay, /<BaseOverlayFrame\b[\s\S]*?close-button/, path)
}

for (const path of [
  'shared/layouts/PickerOverlay.vue',
  'shared/layouts/LightboxOverlay.vue',
  'shared/layouts/FormOverlay.vue',
]) {
  const overlay = source(path)
  assert.match(overlay, /close-button-tone="onDark"/, path)
  assert.match(overlay, /close-button-class="text-white"/, path)
}

const registration = source('features/orders/components/GarmentRegistrationCamera.vue')
assert.match(registration, /<CloseButton[^>]*:disabled="pendingCount > 0"/)

const scanner = source('features/orders/components/DocumentScannerOverlay.vue')
assert.match(scanner, /<CloseButton[\s\S]*?:disabled="isWarping"/)
assert.match(scanner, /<CloseButton label="Close camera" tone="onDark" :disabled="isWarping"/)

console.log('close button dry tests passed')
