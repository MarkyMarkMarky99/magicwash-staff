import { expect, test } from '@playwright/test'

/**
 * Regression cover for the form overlay being narrower than every other page.
 *
 * `FormOverlay` teleports to `body`, so it never inherits the app column from
 * src/App.vue and has to restate the width itself. It restated it as raw CSS —
 * `width: min(390px, 100%)` — and dropped the `sm:` gate the shell has. Below
 * 390px and at/above 640px the two agree, so the defect only shows in the
 * 390–639px band: exactly where every large phone sits (iPhone 15 Plus / Pro Max
 * 430px, iPhone 16 Pro Max 440px, Pixel 412px). On those devices the form sat
 * 40–50px narrower than the list behind it.
 *
 * The width now lives once, in `.app-column` (src/style.css), and is applied by
 * BaseFullOverlay's panel so a new overlay is correct without remembering to.
 *
 * Geometry only — no data fixture: /customers/new renders the form overlay on
 * an empty form.
 */

const FORM_ROUTE = '/#/customers/new'
const APP_COLUMN_MAX = 390

async function openFormOverlay(page: import('@playwright/test').Page) {
  await page.goto(FORM_ROUTE)
  await page.waitForLoadState('networkidle')
  const panel = page.locator('dialog[open] .form-overlay-panel')
  await expect(panel).toBeVisible()
  await page.waitForTimeout(400)
  return panel
}

test.describe('app column width', () => {
  test.describe('large phone (iPhone Pro Max, 430px)', () => {
    test.use({ viewport: { width: 430, height: 932 } })

    test('form overlay is exactly as wide as the app column', async ({ page }) => {
      const panel = await openFormOverlay(page)

      const panelBox = await panel.boundingBox()
      const columnBox = await page.locator('#app > div').first().boundingBox()
      const viewport = page.viewportSize()
      if (!panelBox || !columnBox || !viewport) throw new Error('missing layout geometry')

      // The shell is full-bleed below `sm` — this guards the shell itself.
      expect(columnBox.width).toBeCloseTo(viewport.width, 0)

      // The defect: panel capped at 390 while the column was 430.
      expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    })
  })

  test.describe('desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('form overlay stays a centred app column', async ({ page }) => {
      const panel = await openFormOverlay(page)

      const panelBox = await panel.boundingBox()
      const columnBox = await page.locator('#app > div').first().boundingBox()
      const viewport = page.viewportSize()
      if (!panelBox || !columnBox || !viewport) throw new Error('missing layout geometry')

      expect(panelBox.width).toBeCloseTo(APP_COLUMN_MAX, 0)
      expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)

      // Centred, and the backdrop still covers the whole viewport.
      const dialogBox = await page.locator('dialog[open]').boundingBox()
      expect(dialogBox?.width).toBeCloseTo(viewport.width, 0)
    })
  })
})
