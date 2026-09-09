import { expect, test } from '@playwright/test'

const FORM_ROUTE = '/#/customers/new'
const APP_COLUMN_MAX = 390

async function openFormOverlay(page: import('@playwright/test').Page) {
  await page.goto(FORM_ROUTE)
  await page.waitForLoadState('networkidle')
  const panel = page.locator('[data-overlay-panel].form-overlay-panel')
  await expect(panel).toBeVisible()
  await page.waitForTimeout(400)
  return panel
}

test.describe('app column width', () => {
  test.describe('large phone', () => {
    test.use({ viewport: { width: 430, height: 932 } })

    test('form overlay is exactly as wide as the app column', async ({ page }) => {
      const panel = await openFormOverlay(page)
      const panelBox = await panel.boundingBox()
      const columnBox = await page.locator('#app > div').first().boundingBox()
      const backdropBox = await page.locator('[data-overlay-backdrop]').boundingBox()
      const viewport = page.viewportSize()
      if (!panelBox || !columnBox || !backdropBox || !viewport) throw new Error('missing layout geometry')

      expect(columnBox.width).toBeCloseTo(viewport.width, 0)
      expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(backdropBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(backdropBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    })
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('form overlay stays a centred app column', async ({ page }) => {
      const panel = await openFormOverlay(page)
      const panelBox = await panel.boundingBox()
      const columnBox = await page.locator('#app > div').first().boundingBox()
      const backdropBox = await page.locator('[data-overlay-backdrop]').boundingBox()
      if (!panelBox || !columnBox || !backdropBox) throw new Error('missing layout geometry')

      expect(panelBox.width).toBeCloseTo(APP_COLUMN_MAX, 0)
      expect(Math.abs(panelBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(panelBox.x - columnBox.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(backdropBox.width - columnBox.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(backdropBox.x - columnBox.x)).toBeLessThanOrEqual(1)
    })
  })
})
