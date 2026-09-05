import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Regression cover for two BaseOverlay defects, both invisible to the build
 * (there is no frontend type-check) and to the unit dry-tests.
 *
 * 1. The <dialog> is `fixed inset-0`, i.e. viewport-sized, while the app lives
 *    in a centred `sm:max-w-[390px]` column (src/App.vue). The panel used to be
 *    `w-full`, so at desktop widths an open overlay spanned the whole screen
 *    while the rest of the app stayed narrow.
 * 2. `.base-overlay-sheet-panel` carries its own `transition: transform` for the
 *    drag snap-back. `transition` is a shorthand and that rule sits after the
 *    enter/leave rule at equal specificity, so it replaced it wholesale —
 *    opacity was never transitioned and the sheet popped in at full opacity
 *    while it slid.
 *
 * Both assertions read computed style / geometry rather than pixels, so they do
 * not depend on which customer the data happens to give us.
 */

const APP_COLUMN_MAX = 390

async function findCustomerWithOrders(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/customers?perPage=40')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const customers = body.customers ?? body.items ?? body.data ?? []

  for (const customer of customers) {
    const id = customer.customerId ?? customer.id
    if (!id) continue
    const orders = await request.get(`/api/orders?customerId=${id}&perPage=5`)
    const parsed = await orders.json()
    const rows = parsed.orders ?? parsed.items ?? parsed.data ?? []
    if (rows.length > 0) return id
  }

  throw new Error('no customer with orders available to open the order sheet')
}

test.describe('BaseOverlay', () => {
  test('sheet panel stays inside the app column and matches its position', async ({
    page,
    request,
  }) => {
    const customerId = await findCustomerWithOrders(request)

    await page.goto(`/#/customers/${customerId}/orders`)
    await page.waitForLoadState('networkidle')
    await page.locator('article[role="button"], [role="button"]').first().click()

    const panel = page.locator('dialog[open] .base-overlay-panel')
    await expect(panel).toBeVisible()
    await page.waitForTimeout(400)

    const panelBox = await panel.boundingBox()
    const columnBox = await page.locator('#app > div').first().boundingBox()
    const viewport = page.viewportSize()
    if (!panelBox || !columnBox || !viewport) throw new Error('missing layout geometry')

    // Never wider than the column cap, and never wider than the viewport on phones.
    expect(panelBox.width).toBeLessThanOrEqual(Math.min(APP_COLUMN_MAX, viewport.width) + 1)

    // Aligned with the app column rather than the viewport.
    expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)

    // The backdrop itself must still cover the whole viewport.
    const dialogBox = await page.locator('dialog[open]').boundingBox()
    expect(dialogBox?.width).toBeCloseTo(viewport.width, 0)
  })

  test('sheet slides visibly rather than materialising in place', async ({ page, request }) => {
    const customerId = await findCustomerWithOrders(request)

    await page.goto(`/#/customers/${customerId}/orders`)
    await page.waitForLoadState('networkidle')

    // Sample computed style every frame across the enter transition. Passing the
    // probe as a string avoids esbuild's __name helper, which is not defined in
    // the page context.
    await page.evaluate(`
      window.__overlaySamples = [];
      var start = performance.now();
      var tick = function () {
        var el = document.querySelector('dialog[open] .base-overlay-panel');
        if (el) {
          var cs = getComputedStyle(el);
          var m = cs.transform.match(/matrix\\(([^)]+)\\)/);
          window.__overlaySamples.push({
            property: cs.transitionProperty,
            opacity: parseFloat(cs.opacity),
            translateY: m ? parseFloat(m[1].split(',')[5]) : 0,
            height: el.getBoundingClientRect().height,
          });
        }
        if (performance.now() - start < 500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    `)

    await page.locator('article[role="button"], [role="button"]').first().click()
    await expect(page.locator('dialog[open] .base-overlay-panel')).toBeVisible()
    await page.waitForTimeout(700)

    type Sample = { property: string; opacity: number; translateY: number; height: number }
    const samples: Sample[] = await page.evaluate(`window.__overlaySamples || []`)
    expect(samples.length).toBeGreaterThan(5)

    const moving = samples.filter((s) => s.height > 0 && s.translateY > 0)
    expect(moving.length).toBeGreaterThan(3)

    // The panel must be opaque for the whole travel. It used to fade in at the
    // same time, and the fade covered exactly the frames where it was moving —
    // so the slide happened while it was invisible and the sheet looked like it
    // popped into place.
    for (const sample of moving) {
      expect(sample.opacity).toBeGreaterThan(0.95)
    }

    // The travel must be visible over several frames, not a single jump: at
    // least a few samples land in the middle half of the distance.
    const height = moving[0].height
    const midTravel = moving.filter((s) => s.translateY > height * 0.15 && s.translateY < height * 0.85)
    expect(midTravel.length).toBeGreaterThan(1)
  })
})
