import assert from 'node:assert/strict'
import { formatShortDate } from '../../../../../../src/features/customers/utils/format-date'
import { normalizeSheetDate } from '../../../../../../src/shared/utils/sheet-date'

assert.equal(formatShortDate(normalizeSheetDate('Date(2026,6,21)')), '21 Jul 2026')
assert.equal(formatShortDate(normalizeSheetDate('2026-07-21')), '21 Jul 2026')
assert.equal(formatShortDate(null), '—')
assert.equal(formatShortDate(''), '—')

console.log('format-date dry tests passed')
