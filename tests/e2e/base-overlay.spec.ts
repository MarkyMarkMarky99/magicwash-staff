import { expect, test, type APIRequestContext } from '@playwright/test'

const APP_COLUMN_MAX = 390

async function findCustomerWithOrders(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/customers?perPage=40')
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  const customers = body.customers ?? body.items ?? body.data ?? []

  for (const customer of customers) {
    const id = customer.customerId ?? customer.id
    if (!id) continue
    const ordersResponse = await request.get(`/api/orders?customerId=${id}&perPage=5`)
    const ordersBody = await ordersResponse.json()
    const orders = ordersBody.orders ?? ordersBody.items ?? ordersBody.data ?? []
    if (orders.length > 0) return id
  }

  throw new Error('no customer with orders available to open the order sheet')
}

async function openOrderSheet(page: import('@playwright/test').Page, request: APIRequestContext) {
  const customerId = await findCustomerWithOrders(request)
  await page.goto(`/#/customers/${customerId}/orders`)
  await page.waitForLoadState('networkidle')
  await page.locator('article[role="button"], [role="button"]').first().click()
  const panel = page.locator('[data-overlay-panel][aria-label="Order details"]')
  await expect(panel).toBeVisible()
  return panel
}

test.describe('overlay frame', () => {
  test('sheet panel and backdrop stay inside the app column without frame scrolling', async ({
    page,
    request,
  }) => {
    const panel = await openOrderSheet(page, request)
    await page.waitForTimeout(400)

    const panelBox = await panel.boundingBox()
    const columnBox = await page.locator('#app > div').first().boundingBox()
    const frame = page.locator('[data-overlay-frame]')
    const frameBox = await frame.boundingBox()
    const backdropBox = await page.locator('[data-overlay-backdrop]').boundingBox()
    const viewport = page.viewportSize()
    if (!panelBox || !columnBox || !frameBox || !backdropBox || !viewport) {
      throw new Error('missing layout geometry')
    }

    expect(panelBox.width).toBeLessThanOrEqual(Math.min(APP_COLUMN_MAX, viewport.width) + 1)
    expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(frameBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(frameBox.width - columnBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(backdropBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(backdropBox.width - columnBox.width)).toBeLessThanOrEqual(1)

    const frameMetrics = await frame.evaluate((element) => ({
      clientWidth: element.clientWidth,
      offsetWidth: (element as HTMLElement).offsetWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop,
      overflow: getComputedStyle(element).overflow,
    }))
    expect(frameMetrics.offsetWidth - frameMetrics.clientWidth).toBeLessThanOrEqual(1)
    expect(frameMetrics.scrollHeight).toBeLessThanOrEqual(frameMetrics.clientHeight + 1)
    expect(frameMetrics.scrollTop).toBe(0)
    expect(frameMetrics.overflow).toBe('hidden')
  })

  test('sheet slides visibly without moving its frame', async ({ page, request }) => {
    const customerId = await findCustomerWithOrders(request)
    await page.goto(`/#/customers/${customerId}/orders`)
    await page.waitForLoadState('networkidle')

    await page.evaluate(`
      window.__overlaySamples = [];
      var start = performance.now();
      var tick = function () {
        var panel = document.querySelector('[data-overlay-panel][aria-label="Order details"]');
        if (panel) {
          var style = getComputedStyle(panel);
          var matrix = style.transform.match(/matrix\\(([^)]+)\\)/);
          var frame = panel.closest('[data-overlay-frame]');
          window.__overlaySamples.push({
            opacity: parseFloat(style.opacity),
            translateY: matrix ? parseFloat(matrix[1].split(',')[5]) : 0,
            height: panel.getBoundingClientRect().height,
            frameScrollTop: frame ? frame.scrollTop : -1,
          });
        }
        if (performance.now() - start < 500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    `)

    await page.locator('article[role="button"], [role="button"]').first().click()
    await expect(page.locator('[data-overlay-panel][aria-label="Order details"]')).toBeVisible()
    await page.waitForTimeout(700)

    type Sample = { opacity: number; translateY: number; height: number; frameScrollTop: number }
    const samples: Sample[] = await page.evaluate(`window.__overlaySamples || []`)
    expect(samples.length).toBeGreaterThan(5)
    const moving = samples.filter((sample) => sample.height > 0 && sample.translateY > 0)
    expect(moving.length).toBeGreaterThan(3)
    for (const sample of samples) expect(sample.frameScrollTop).toBe(0)
    for (const sample of moving) expect(sample.opacity).toBeGreaterThan(0.95)
    const height = moving[0].height
    const midTravel = moving.filter((sample) => (
      sample.translateY > height * 0.15 && sample.translateY < height * 0.85
    ))
    expect(midTravel.length).toBeGreaterThan(1)
  })
})
