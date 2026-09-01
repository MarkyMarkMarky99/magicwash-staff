import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const detailPageSource = source('features/orders/pages/OrderDetailPage.vue')
const overlayRouteSource = source('features/orders/composables/use-order-overlay-route.ts')
const appSource = source('App.vue')

test('detail page offers the three Thai photo actions through the overlay route', () => {
  assert.match(detailPageSource, /น้ำหนัก/)
  assert.match(detailPageSource, /ของลูกค้า/)
  assert.match(detailPageSource, /เอกสาร/)
  assert.match(detailPageSource, /photo-weight/)
  assert.match(detailPageSource, /photo-belonging/)
  assert.match(detailPageSource, /photo-document/)
  assert.match(detailPageSource, /useOrderOverlayRoute/)
})

test('weight action gates the camera with the prompt and replace-based route state', () => {
  assert.match(detailPageSource, /OrderImageWeightPrompt/)
  assert.match(detailPageSource, /BaseOverlay/)
  assert.match(detailPageSource, /weight/)
  assert.match(detailPageSource, /router\.replace/)
  assert.match(overlayRouteSource, /photo-weight/)
  assert.match(overlayRouteSource, /photo-belonging/)
  assert.match(overlayRouteSource, /photo-document/)
})

test('weight prompt is not added to App KeepAlive exclusions', () => {
  assert.doesNotMatch(appSource, /OrderImageWeightPrompt/)
})

test('carousel is one mixed collection with a tolerant type label fallback', () => {
  assert.match(detailPageSource, /imageType/)
  assert.match(detailPageSource, /อื่นๆ/)
  assert.match(detailPageSource, /trim/)
  assert.match(detailPageSource, /imageType[\s\S]{0,160}(?:raw|String|fallback)/i)
})

test('page and prompt remain above store/service/API layers', () => {
  assert.doesNotMatch(detailPageSource, /(?:uploadBytes|firebase|fetch\s*\(|axios|\/api\/order-images)/i)
})

test('a feature-local service uploads JPEGs and posts the resulting URL', () => {
  const servicesUrl = new URL('../../../../../../src/features/orders/services/', import.meta.url)
  const serviceTexts = readdirSync(servicesUrl, { withFileTypes: true })
    .filter((entry: { isFile(): boolean; name: string }) => entry.isFile() && /\.(?:ts|js)$/.test(entry.name))
    .map((entry: { name: string }) => readFileSync(new URL(entry.name, servicesUrl), 'utf8'))

  const uploadService = serviceTexts.find(
    (text: string) => /uploadBytes|uploadBytesResumable/.test(text) && /\/api\/order-images/.test(text),
  )

  assert.ok(uploadService, 'one feature-local service must own storage upload and API POST')
  assert.match(uploadService, /image\/jpeg/)
  assert.ok(
    uploadService!.search(/uploadBytes|uploadBytesResumable/) < uploadService!.indexOf('/api/order-images'),
    'the storage upload must precede the API POST',
  )
  assert.ok(serviceTexts.every((text) => !/src\/api\/storage|@\/api\/storage/.test(text)))
})

console.log('order-image-capture page dry tests passed')
