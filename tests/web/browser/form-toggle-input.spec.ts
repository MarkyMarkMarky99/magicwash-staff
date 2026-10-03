import { expect, test } from '@playwright/test'

test('uncontrolled customer contact fields still open, focus and clear their text', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.goto('/#/customers/new')
  const toggle = page.getByRole('switch', { name: 'Facebook', exact: true })
  await expect(toggle).not.toBeChecked()
  await expect(page.locator('#facebook')).toHaveCount(0)
  await toggle.click()
  const input = page.getByRole('textbox', { name: 'Facebook profile' })
  await expect(input).toBeFocused()
  await input.fill('Customer profile')
  await toggle.click()
  await expect(input).toHaveCount(0)
  await toggle.click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
})
