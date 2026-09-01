import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const detailPageSource = source('features/orders/pages/OrderDetailPage.vue')
const overlayRouteSource = source('features/orders/composables/use-order-overlay-route.ts')
const sectionSource = source('features/orders/components/OrderImageSection.vue')
const storeSource = source('features/orders/stores/order-image.store.ts')
const apiServiceSource = source('features/orders/services/order-image.service.ts')
const storageServiceSource = source('features/orders/services/order-image-storage.service.ts')
const appSource = source('App.vue')

test('detail page connects the image section, route overlays, and camera emits', () => {
  assert.match(detailPageSource, /import OrderImageSection from ['"]@\/features\/orders\/components\/OrderImageSection\.vue['"]/)
  assert.match(detailPageSource, /import CameraOverlay from ['"]@\/shared\/components\/CameraOverlay\.vue['"]/)
  assert.match(detailPageSource, /import \{ useOrderImageStore \} from ['"]@\/features\/orders\/stores\/order-image\.store['"]/)
  assert.match(detailPageSource, /@capture="openCapture"/)
  assert.match(detailPageSource, /@capture="handleCapture"/)
  assert.match(detailPageSource, /@close="orderOverlay\.close"/)
  assert.match(detailPageSource, /captureImageType = computed<OrderImageType \| null>/)
})

test('weight action gates the camera with the prompt and one route-held quantity', () => {
  assert.match(detailPageSource, /const captureWeight = computed<number \| null>\(\(\) => \{/)
  assert.match(detailPageSource, /return readOrderImageWeight\(route\.query\)/)
  assert.match(detailPageSource, /const isWeightPromptOpen = computed<boolean>\(\(\) => captureImageType\.value === 'WEIGHT' && captureWeight\.value === null\)/)
  assert.match(detailPageSource, /const isCameraOpen = computed<boolean>\(\(\) => captureImageType\.value !== null && !isWeightPromptOpen\.value\)/)
  assert.match(detailPageSource, /function submitWeight\(weight: number\): void \{\s*orderOverlay\.setWeight\(weight\)/)
  assert.match(detailPageSource, /await orderImageStore\.captureImage\(\{ orderId: targetOrderId, imageType, file, quantity \}\)/)
  assert.match(overlayRouteSource, /router\.replace\(\{ query: \{ \.\.\.route\.query, \[WEIGHT_QUERY_KEY\]: String\(weight\) \} \}\)/)
})

test('weight prompt is not added to App KeepAlive exclusions', () => {
  assert.doesNotMatch(appSource, /OrderImageWeightPrompt/)
})

test('carousel is one mixed collection with a tolerant type label fallback', () => {
  assert.match(sectionSource, /ORDER_IMAGE_TYPES/)
  assert.match(sectionSource, /v-for="image in images"/)
  assert.match(sectionSource, /overflow-x-auto[^>]*no-scrollbar/)
  assert.match(sectionSource, /getOrderImageTypeLabel\(image\.imageType\)/)
  assert.match(sectionSource, /isDisplayableImagePath\(image\.imagePath\)/)
  assert.match(sectionSource, /placeholder|image/)
  assert.match(sectionSource, /https\?:\\\/\\\//)
  assert.match(sectionSource, /uploadingCount > 0/)
  assert.match(sectionSource, /ยังไม่มีรูปภาพสำหรับออเดอร์นี้/)
})

test('loading and API errors preserve actions and replace only the image body', () => {
  assert.match(sectionSource, /v-if="loading"/)
  assert.match(sectionSource, /v-else-if="error"/)
  assert.match(sectionSource, /v-if="uploadError"/)
  assert.match(sectionSource, /@click="emit\('clearUploadError'\)"/)
  assert.match(sectionSource, /v-for="index in uploadingCount"/)
})

test('detail watcher loads and clears image state with the order', () => {
  assert.match(detailPageSource, /void orderImageStore\.loadImages\(id\)/)
  assert.match(detailPageSource, /orderImageStore\.clearImages\(\)/)
})

test('feature services keep browser upload before the validated API POST', () => {
  assert.match(storageServiceSource, /import \{ getDownloadURL, ref as firebaseStorageRef, uploadBytes \} from ['"]firebase\/storage['"]/)
  assert.match(storageServiceSource, /const objectPath = `order-images\/\$\{orderId\}\/\$\{Date\.now\(\)\}_\$\{file\.name\}`/)
  assert.match(storageServiceSource, /const snapshot = await uploadBytes\(objectRef, file\)/)
  assert.match(storageServiceSource, /return await getDownloadURL\(snapshot\.ref\)/)
  assert.match(apiServiceSource, /const ORDER_IMAGES_ENDPOINT = '\/api\/order-images'/)
  assert.match(apiServiceSource, /apiGetList<OrderImageDto>\(ORDER_IMAGES_ENDPOINT, \{ query: \{ orderId \}, querySchema: orderImageListQuerySchema \}\)/)
  assert.match(apiServiceSource, /apiPost<OrderImageCreateDto>\(ORDER_IMAGES_ENDPOINT, \{ data: payload, requestSchema: orderImageCreateSchema \}\)/)
  assert.match(storeSource, /const imagePath = await uploadOrderImage\(input\.orderId, input\.file\)[\s\S]*const created = await createOrderImage/)
})

test('page and prompt remain above store/service/API layers', () => {
  assert.doesNotMatch(detailPageSource, /(?:uploadBytes|firebase|fetch\s*\(|axios|\/api\/order-images)/i)
})

test('weight prompt is not added to App KeepAlive exclusions', () => {
  assert.doesNotMatch(appSource, /OrderImageWeightPrompt/)
})

/* Keep the route vocabulary in the composable, not in a second page-local list. */
test('route defines all three image overlay mappings', () => {
  assert.match(overlayRouteSource, /photo-weight/)
  assert.match(overlayRouteSource, /photo-belonging/)
  assert.match(overlayRouteSource, /photo-document/)
})

console.log('order-image-capture page dry tests passed')
