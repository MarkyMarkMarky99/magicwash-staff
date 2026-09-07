import assert from 'node:assert/strict'
import { z } from 'zod'

import {
  deriveGVizCellTypes,
  GVizQueryBuilder,
} from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'
import { sheetDate, sheetDateTime } from '../../../../../server/shared/contracts/sheet-cell-type.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

const columns = { AppointmentID: 'A', AppointmentDate: 'B', CreatedAt: 'C', Notes: 'D' }

test('a date-marked column renders a typed date literal', async () => {
  const query = GVizQueryBuilder.fromColumns(columns, { AppointmentDate: 'date' })
    .where({ AppointmentDate: '2026-09-07' })
    .build()

  assert.equal(query, "select *\nwhere B = date '2026-09-07'")
})

test('a datetime-marked column renders a typed datetime literal', async () => {
  const query = GVizQueryBuilder.fromColumns(columns, { CreatedAt: 'datetime' })
    .where({ CreatedAt: '2026-09-07 10:00:00' })
    .build()

  assert.equal(query, "select *\nwhere C = datetime '2026-09-07 10:00:00'")
})

test('an unmarked column still renders a quoted string literal (regression guard)', async () => {
  const query = GVizQueryBuilder.fromColumns(columns, { AppointmentDate: 'date' })
    .where({ Notes: 'hello' })
    .build()

  assert.equal(query, "select *\nwhere D = 'hello'")
})

test('no cellTypes argument at all still renders a quoted string literal', async () => {
  const query = GVizQueryBuilder.fromColumns(columns).where({ Notes: 'hello' }).build()

  assert.equal(query, "select *\nwhere D = 'hello'")
})

test('deriveGVizCellTypes returns only marked columns', async () => {
  const rowSchema = z.object({
    AppointmentID: z.string(),
    AppointmentDate: sheetDate(),
    CreatedAt: sheetDateTime(),
    Notes: z.string().nullable(),
  })

  assert.deepEqual(deriveGVizCellTypes(rowSchema), {
    AppointmentDate: 'date',
    CreatedAt: 'datetime',
  })
})

test('deriveGVizCellTypes returns {} for a schema with no marked columns', async () => {
  const rowSchema = z.object({
    AppointmentID: z.string(),
    Notes: z.string().nullable(),
  })

  assert.deepEqual(deriveGVizCellTypes(rowSchema), {})
})

test('sanitization still applies inside a typed literal', async () => {
  const query = GVizQueryBuilder.fromColumns(columns, { AppointmentDate: 'date' })
    .where({ AppointmentDate: "2026-09-0'7" })
    .build()

  assert.equal(query, "select *\nwhere B = date '2026-09-07'")
})

const orderedTests = process.env.REVERSE_TESTS === '1' ? [...tests].reverse() : tests
let failures = 0

for (const currentTest of orderedTests) {
  try {
    await currentTest.run()
    console.log(`ok - ${currentTest.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`not ok - ${currentTest.name}`)
    console.error(error)
  }
}

if (failures !== 0) {
  throw new Error(`${failures} dry-test(s) failed.`)
}

console.log(`passed - ${orderedTests.length} gviz-query-builder dry-tests`)
