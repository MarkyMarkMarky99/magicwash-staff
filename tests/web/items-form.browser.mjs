import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

// Run against local Vite; all API traffic is fulfilled here, never forwarded.
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (error) => console.error(error.message))
page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()) })
page.on('requestfailed', (request) => console.error('Failed:', request.url(), request.failure()?.errorText))
const item = { id: 'abcd1234', itemCode: 'ITM-0001', category: 'Clothing', subcategory: 'Tops',
  itemType: 'Shirt', variant: null, displayNameTh: 'เสื้อ', displayNameEn: 'Shirt', active: false, imageUrl: null }
let posts = 0
let failWrite = false
let lastPayload
let readItems = [item]
let pendingItemsRead = null
let failItemsRead = false
await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
  const request = route.request()
  const path = new URL(request.url()).pathname
  if (request.method() === 'GET' && path === '/api/items' && failItemsRead) {
    return route.fulfill({ status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Test load failure' } } })
  }
  if (request.method() !== 'GET') {
    assert.equal(path, '/api/items')
    assert.equal(request.method(), 'POST')
    posts += 1
    lastPayload = request.postDataJSON()
    if (failWrite) return route.abort('failed')
    return route.fulfill({ json: { success: true, data: { ...item, ...lastPayload, id: 'abcd5678', itemCode: 'ITM-0002' } } })
  }
  if (path === '/api/items' && pendingItemsRead) await pendingItemsRead
  const data = path === '/api/items' ? readItems
    : path === '/api/work-orders/test-order' ? {
      orderId: 'test-order', customerId: 'test-customer', status: 'RECEIVED', serviceType: 'WSIR',
      quantity: 1, items: [], receivedDate: null, dueDate: null, invoiceNumber: null,
    } : []
  await route.fulfill({ json: { success: true, data, meta: { pagination: { page: 1, perPage: 1000 } } } })
})
const base = 'http://127.0.0.1:3102/#'
try {
  await page.goto(`${base}/orders/test-order?orderAction=item`)
  await expect(page.getByRole('button', { name: 'NEW ITEM', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Clothing', exact: true }).click()
  await page.getByRole('button', { name: 'Tops', exact: true }).click()
  await page.getByRole('button', { name: 'NEW ITEM', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add item type' })).toBeVisible()
  await page.locator('#item-type').fill('Cardigan')
  await page.locator('#display-name-th').fill('เสื้อคาร์ดิแกน')
  await page.locator('#display-name-en').fill('Cardigan')
  await page.getByRole('button', { name: 'Save item', exact: true }).click()
  await expect(page).toHaveURL(/orders\/test-order\?orderAction=item/)
  await expect(page.getByText('ITM-0002', { exact: true })).toBeVisible()
  assert.equal(posts, 1)
  assert.equal(lastPayload.category, 'Clothing')
  assert.equal(lastPayload.subcategory, 'Tops')
  assert.equal('price' in lastPayload, false)
  assert.equal('serviceType' in lastPayload, false)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Add item type' })).toHaveCount(0)

  await page.goto(`${base}/price-list/items/new`)
  await expect(page.getByRole('alert')).toContainText('select a category and subcategory')
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeDisabled()

  failWrite = true
  await page.goto(`${base}/price-list/items/new?category=Clothing&subcategory=Tops&orderId=test-order`)
  await page.reload()
  await page.locator('#item-type').fill('Hoodie')
  await page.locator('#display-name-th').fill('เสื้อฮู้ด')
  await page.getByRole('button', { name: 'Save item', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('save could not be confirmed')
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeDisabled()
  assert.equal(posts, 2, 'uncertain writes must not retry')
  await page.goto(`${base}/orders/test-order?orderAction=item`)
  await expect(page.getByRole('button', { name: 'NEW ITEM', exact: true })).toBeVisible()
  let releaseRead
  pendingItemsRead = new Promise((resolve) => { releaseRead = resolve })
  readItems = [...readItems, { ...item, id: 'bbbb1234', category: 'Bedding', subcategory: 'Pillows' }]
  await page.goto(`${base}/price-list/items/new?category=Bedding&subcategory=Pillows&orderId=test-order`)
  await page.locator('#item-type').fill('Pillow')
  await page.locator('#display-name-th').fill('หมอน')
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeDisabled()
  releaseRead()
  pendingItemsRead = null
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  failItemsRead = true
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Unable to load item categories')
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeDisabled()
  failItemsRead = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.locator('#item-type').fill('Pillow')
  await page.locator('#display-name-th').fill('หมอน')
  await expect(page.getByRole('button', { name: 'Save item', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  console.log('Items form browser checks passed: picker, create, return, deep link, uncertain write, refreshed categories, load retry')
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 2500))
  throw error
} finally { await browser.close() }
