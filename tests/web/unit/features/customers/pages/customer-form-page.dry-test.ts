import assert from 'node:assert/strict'
import { chromium, type Page } from '@playwright/test'
import { createServer } from 'vite'

const harness = `
import { createApp, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import { useAuthStore } from '/src/data/auth/auth.store.ts'
import { customerRoutes } from '/src/features/customers/routes.ts'
import CustomerForm from '/src/features/customers/components/CustomerForm.vue'
const pinia = createPinia()
setActivePinia(pinia)
const auth = useAuthStore()
auth.status = 'signedIn'
auth.staff = { staffId: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' }
auth.ready = async () => undefined
const routes = customerRoutes.map(route => ['customer-detail', 'customer-list'].includes(route.name)
  ? { ...route, component: { render: () => h('div', route.name) } } : route)
routes.push({ path: '/bare-form', component: { render: () => h(CustomerForm, { modelValue: {
  customerName: '', phone: '', address: '', facebook: '', lineId: '', whatsapp: '', email: '', customerType: '', updatedBy: 'admin-id'
} }) } })
const router = createRouter({ history: createWebHashHistory(), routes })
createApp({ render: () => h(RouterView) }).use(pinia).use(router).mount('#app')
`

const server = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: true },
  logLevel: 'error',
  plugins: [{
    name: 'customer-form-dry-test',
    resolveId(id) { if (id === '/__customer-form-test.js') return id },
    load(id) { if (id === '/__customer-form-test.js') return harness },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/customer-form-test.html') return next()
        res.setHeader('Content-Type', 'text/html')
        res.end('<html><head><link rel="stylesheet" href="/src/style.css"></head><body><div id="app"></div><div id="overlay-root"></div><script type="module" src="/__customer-form-test.js"></script></body></html>')
      })
    },
  }],
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  const url = `${origin}/customer-form-test.html`
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const requests: Array<{ method: string; body: Record<string, unknown> }> = []
  let loadedType: string | null = 'Member'
  const row = {
    customerId: 'customer-1', customerIndex: 'ABC', customerName: 'Original', phone: '0812345678',
    address: 'Address', facebook: null, lineId: null, whatsapp: null, email: null,
    location: null, registeredDate: '2026-01-01', priceGroup: null,
  }
  await context.route('**/*', async (route) => {
    const request = route.request()
    const target = new URL(request.url())
    if (target.origin !== origin) return route.abort()
    if (!target.pathname.startsWith('/api/')) return route.continue()
    const body = request.postDataJSON()
    if (request.method() !== 'GET') requests.push({ method: request.method(), body })
    await route.fulfill({ json: { data: { ...row, customerType: loadedType, ...body } } })
  })
  async function open(path: string): Promise<Page> {
    const page = await context.newPage()
    await page.goto(`${url}#${path}`)
    await page.locator('#customer-name').waitFor()
    return page
  }

  const edit = await open('/customers/customer-1/edit')
  await edit.waitForFunction(() => document.querySelector<HTMLInputElement>('#customer-name')?.value === 'Original')
  const types = edit.getByRole('group', { name: 'Customer type', exact: true })
  assert.equal(await types.getByRole('button').count(), 3)
  assert.equal(await types.locator('.option-button--selected').textContent(), 'Member')
  assert.equal(await edit.locator('button[type=submit]').isDisabled(), true)
  await types.getByRole('button', { name: 'Corporate', exact: true }).click()
  await types.getByRole('button', { name: 'Member', exact: true }).click()
  assert.equal(await edit.locator('button[type=submit]').isDisabled(), true)
  await types.getByRole('button', { name: 'Corporate', exact: true }).click()
  await edit.locator('button[type=submit]').click()
  await edit.waitForURL((url) => url.hash === '#/customers/customer-1')
  assert.deepEqual(requests.pop(), { method: 'PATCH', body: { customerType: 'Corporate', updatedBy: 'admin-id' } })

  loadedType = null
  const blank = await open('/customers/customer-1/edit')
  await blank.waitForFunction(() => document.querySelector<HTMLInputElement>('#customer-name')?.value === 'Original')
  assert.equal(await blank.locator('.option-button--selected').count(), 0)
  await blank.getByRole('button', { name: 'Regular', exact: true }).click()
  await blank.locator('button[type=submit]').click()
  await blank.waitForURL((url) => url.hash === '#/customers/customer-1')
  assert.deepEqual(requests.pop(), { method: 'PATCH', body: { customerType: 'Regular', updatedBy: 'admin-id' } })

  const create = await open('/customers/new')
  assert.equal(await create.getByRole('group', { name: 'Customer type', exact: true }).count(), 0)
  await create.locator('#customer-name').fill('New customer')
  await create.locator('#customer-phone').fill('0876543210')
  await create.locator('button[type=submit]').click()
  await create.waitForURL((url) => url.hash === '#/customers/customer-1')
  assert.deepEqual(requests.pop(), { method: 'POST', body: {
    customerName: 'New customer', phone: '0876543210', address: null, facebook: null,
    lineId: null, whatsapp: null, email: null, updatedBy: 'admin-id',
  } })
  const omitted = await open('/bare-form')
  assert.equal(await omitted.getByRole('group', { name: 'Customer type', exact: true }).count(), 0)
  console.log('customer-form-page.dry-test: OK (type options, prefill, null, changed-only diff, create payload, absent boolean prop)')
} finally {
  await browser?.close()
  await server.close()
}
