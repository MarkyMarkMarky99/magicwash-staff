import { expect, test, type Page } from '@playwright/test'

const customer = {
  customerId: 'CUS-1', customerIndex: '1', customerName: 'Test Customer', phone: null,
  address: null, location: null, customerType: null, registeredDate: null,
  facebook: null, lineId: null, whatsapp: null, email: null,
}
const packageItem = {
  packageCode: 'PKG-1', name: 'Ten credits', eligibleService: 'WASH', includedCredit: 10,
  price: 500, notes: null, createdAt: '', createdBy: 'admin', updatedAt: null,
  updatedBy: null, deletedAt: null, deletedBy: null,
}
const packageCreated = {
  kind: 'created', customerPackageId: 'CP-1', customerId: 'CUS-1', packageCode: 'PKG-1',
  openingCredit: 10, transactionId: 'TX-1', createdAt: '2026-10-03',
}

async function prepare(page: Page, packageFails = false, customerContext = true) {
  const writes: { path: string; body: Record<string, unknown> }[] = []
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST') {
      writes.push({ path, body: request.postDataJSON() })
      const outcome = path === '/api/invoices'
        ? { kind: 'created', invoiceNumber: 'INV-TEST', itemCount: 1, itemsTotal: 500, invoiceTotal: 500 }
        : packageFails
          ? { kind: 'catalog_read_failed', packageCode: 'PKG-1', message: 'Catalog unavailable' }
          : packageCreated
      await route.fulfill({ json: outcome })
      return
    }
    const data = path === '/api/customers/CUS-1' ? customer
      : path === '/api/packages' ? [packageItem]
        : path === '/api/customers' ? [customer] : []
    await route.fulfill({ json: { success: true, data, meta: {
      pagination: { page: 1, perPage: 200, total: Array.isArray(data) ? data.length : 1, totalPages: 1 },
    } } })
  })
  await page.goto(`/#/customer-packages/create${customerContext ? '?customerId=CUS-1' : ''}`)
  await expect(page.getByRole('heading', { name: 'Create customer package' })).toBeVisible()
  await page.locator('#customer-package-code').click()
  await page.getByRole('option', { name: /PKG-1/ }).click()
  return writes
}

test('customer can create a package with no invoice request or linkage', async ({ page }) => {
  const writes = await prepare(page)
  const choice = page.getByRole('switch', { name: 'Invoice already created' })
  await expect(choice).not.toBeChecked()
  await expect(page.getByRole('switch')).toHaveCount(1)
  await choice.click()
  await expect(choice).toBeChecked()
  await expect(page.getByText('Test Customer', { exact: true })).toBeVisible()
  await expect(page.locator('#customer-package-customer')).toHaveCount(0)
  await expect(page.locator('#customer-package-invoice')).toHaveValue('')
  await page.getByRole('button', { name: 'Create package', exact: true }).click()
  await expect(page).toHaveURL(/\/customers\/CUS-1\/packages/)
  expect(writes.map(write => write.path)).toEqual(['/api/customer-packages'])
  expect(writes[0].body).toMatchObject({ customerId: 'CUS-1', packageCode: 'PKG-1', invoiceId: null })
})

test('switch off creates an invoice first and links the package to it', async ({ page }) => {
  const writes = await prepare(page)
  await expect(page.getByRole('switch', { name: 'Invoice already created' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Buy package', exact: true }).click()
  await expect(page).toHaveURL(/\/customers\/CUS-1\/packages/)
  expect(writes.map(write => write.path)).toEqual(['/api/invoices', '/api/customer-packages'])
  expect(writes[0].body).toMatchObject({ billingType: 'CYCLE', items: [{ quantity: 1, unitPrice: 500 }] })
  expect(writes[1].body.invoiceId).toBe('INV-TEST')
})

test('an existing invoice attempt cannot be switched to an unlinked package purchase', async ({ page }) => {
  const writes = await prepare(page, true)
  await page.getByRole('button', { name: 'Buy package', exact: true }).click()
  await expect(page.getByText('Catalog unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Invoice already created' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry remaining step' }).click()
  await expect.poll(() => writes.length).toBe(3)
  expect(writes.map(write => write.path)).toEqual(['/api/invoices', '/api/customer-packages', '/api/customer-packages'])
  expect(writes[2].body.invoiceId).toBe('INV-TEST')
})

test('the package list form still accepts an existing invoice without generating one', async ({ page }) => {
  const writes = await prepare(page, false, false)
  await expect(page.getByRole('switch')).toHaveCount(1)
  await page.locator('#customer-package-customer').click()
  await page.getByRole('option', { name: /Test Customer/ }).click()
  await page.getByRole('switch', { name: 'Invoice already created' }).click()
  await page.locator('#customer-package-invoice').fill('INV-EXISTING')
  await page.getByRole('button', { name: 'Create package', exact: true }).click()
  await expect(page).toHaveURL(/#\/customer-packages$/)
  expect(writes.map(write => write.path)).toEqual(['/api/customer-packages'])
  expect(writes[0].body.invoiceId).toBe('INV-EXISTING')
})


test('customer can link an optional existing invoice without creating one', async ({ page }) => {
  const writes = await prepare(page)
  await page.getByRole('switch', { name: 'Invoice already created' }).click()
  await page.locator('#customer-package-invoice').fill('  INV-MANUAL  ')
  await page.getByRole('button', { name: 'Create package', exact: true }).click()
  await expect(page).toHaveURL(/\/customers\/CUS-1\/packages/)
  expect(writes.map(write => write.path)).toEqual(['/api/customer-packages'])
  expect(writes[0].body.invoiceId).toBe('INV-MANUAL')
})

test('switching off the manual field clears its text and restores automatic invoicing', async ({ page }) => {
  const writes = await prepare(page)
  const choice = page.getByRole('switch', { name: 'Invoice already created' })
  await choice.click()
  await page.locator('#customer-package-invoice').fill('INV-MANUAL')
  await choice.click()
  await expect(page.locator('#customer-package-invoice')).toHaveCount(0)
  await choice.click()
  await expect(page.locator('#customer-package-invoice')).toHaveValue('')
  await choice.click()
  await page.getByRole('button', { name: 'Buy package', exact: true }).click()
  await expect(page).toHaveURL(/\/customers\/CUS-1\/packages/)
  expect(writes.map(write => write.path)).toEqual(['/api/invoices', '/api/customer-packages'])
  expect(writes[1].body.invoiceId).toBe('INV-TEST')
})

test('the optional invoice control stays at the bottom below Notes', async ({ page }) => {
  await prepare(page)
  const choice = page.getByRole('switch', { name: 'Invoice already created' })
  const notesBox = await page.locator('#customer-package-notes').boundingBox()
  const choiceBox = await choice.boundingBox()
  expect(notesBox).not.toBeNull()
  expect(choiceBox).not.toBeNull()
  expect(choiceBox!.y).toBeGreaterThan(notesBox!.y + notesBox!.height)
  await expect(page.getByRole('switch')).toHaveCount(1)
})
