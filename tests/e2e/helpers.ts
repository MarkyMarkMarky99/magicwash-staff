import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

// Fixed, coordinator-mandated output locations — do NOT change these to
// Playwright's default test-results/ dir.
export const SHOTS_DIR =
  'C:\\Users\\Asus\\AppData\\Local\\Temp\\claude\\C--MagicwashGemini-webapp-vue\\c36b7929-cfac-42a3-b205-62379c67c6fe\\scratchpad\\shots';
export const CONSOLE_LOG_PATH = path.join(SHOTS_DIR, '..', 'console-log.txt');

fs.mkdirSync(SHOTS_DIR, { recursive: true });

// Real customer ids pulled from the live /api/customers, /api/orders,
// /api/customer-packages and /api/invoices responses during setup — never
// invented. See report SETUP section for how each was chosen.
export const CUSTOMER_A = { id: '49f65d88', name: 'คุณแอ้' }; // orders + 1 ACTIVE package, 0 invoices
export const CUSTOMER_B = { id: 'bdd8854c', name: 'พิมพ์นิดา' }; // orders + packages, distinct from A (KeepAlive isolation)
export const CUSTOMER_INVOICES = { id: '3affaca8', name: 'แอค' }; // has invoices, for invoice row-nav
export const CUSTOMER_ZERO_PACKAGES = { id: 'e6741c92', name: 'TR' }; // orders, 0 packages, 0 invoices

export function shot(name: string): string {
  return path.join(SHOTS_DIR, name);
}

export function attachConsoleCapture(page: Page, label: string) {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      fs.appendFileSync(CONSOLE_LOG_PATH, `[${label}] [console.${type}] ${msg.text()}\n`);
    }
  });
  page.on('pageerror', (err) => {
    fs.appendFileSync(CONSOLE_LOG_PATH, `[${label}] [pageerror] ${err.message}\n`);
  });
}

// Tab bar buttons render label text as plain "Orders" / "Packages" / "Invoices"
// in the DOM; the ALL-CAPS look is CSS text-transform only, not the actual text.
export function tabButton(page: Page, label: 'Orders' | 'Packages' | 'Invoices') {
  return page.locator(`button:has(span:text-is("${label}"))`).first();
}
