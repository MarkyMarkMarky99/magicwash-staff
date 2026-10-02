import assert from 'node:assert/strict'
import type { z } from 'zod'
import { PaymentService, paymentRoutes } from '../../../../../server/modules/payments/payment.module.js'
import { paymentReviewSchema } from '../../../../../contracts/payments/payment-api.schema.js'
import { paymentsRowSchema } from '../../../../../server/sheets/Payments/Payments.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

type Row = z.infer<typeof paymentsRowSchema>

function pendingRow(overrides: Partial<Row> = {}): Row {
  return {
    payment_id: 'pay_1', invoice_number: 'INV1', amount: null, method: 'BANK_TRANSFER',
    status: 'PENDING', paid_at: '', reference: '', proof_url: 'https://example.com/slip.webp',
    slip_data: '', notes: 'SLIPOK_1010', created_at: '2026-10-01 10:00:00', created_by: 'customer',
    updated_at: '', updated_by: '', deleted_at: '', deleted_by: '',
    ...overrides,
  }
}

function serviceWith(row: Row | null) {
  const updates: Array<{ id: string, patch: Partial<Row> }> = []
  const repository: SheetRepositoryContract<Row> = {
    async read() { return row ? [row] : [] },
    async append() { throw new Error('not used') },
    async batchAppend() { throw new Error('not used') },
    async update(id, patch) {
      updates.push({ id, patch })
      return { ...row!, ...patch } as Row
    },
    async delete() { throw new Error('not used') },
  }
  const service = new PaymentService({ repository, now: () => new Date('2026-10-02T05:34:56Z') })
  return { service, updates }
}

// VERIFY fills amount, defaults paid_at to now, keeps the verifier note.
{
  const { service, updates } = serviceWith(pendingRow())
  const result = await service.update('pay_1', { action: 'VERIFY', amount: 1190 })
  assert.deepEqual(updates[0], {
    id: 'pay_1',
    patch: {
      status: 'VERIFIED', amount: 1190, paid_at: '2026-10-02 12:34:56',
      updated_at: '2026-10-02 12:34:56', updated_by: 'admin',
    },
  })
  assert.equal(result.status, 'VERIFIED')
  assert.equal(result.notes, 'SLIPOK_1010')
  assert.equal(result.reference, null)
}

// VERIFY with an explicit date and note appends the note.
{
  const { service, updates } = serviceWith(pendingRow())
  await service.update('pay_1', {
    action: 'VERIFY', amount: 1190, paidAt: '2026-10-01 00:00:00', notes: ' ตรวจสลิปแล้ว ',
  })
  assert.equal(updates[0]?.patch.paid_at, '2026-10-01 00:00:00')
  assert.equal(updates[0]?.patch.notes, 'SLIPOK_1010 | ตรวจสลิปแล้ว')
}

// REJECT marks FAILED, appends the reason, leaves amount and paid_at alone.
{
  const { service, updates } = serviceWith(pendingRow({ notes: '' }))
  const result = await service.update('pay_1', { action: 'REJECT', notes: 'ยอดไม่ตรง' })
  assert.deepEqual(updates[0]?.patch, {
    status: 'FAILED', notes: 'ยอดไม่ตรง',
    updated_at: '2026-10-02 12:34:56', updated_by: 'admin',
  })
  assert.equal(result.status, 'FAILED')
}

// Only PENDING rows can be reviewed; missing rows are 404.
{
  const { service, updates } = serviceWith(pendingRow({ status: 'VERIFIED', amount: 500 }))
  await assert.rejects(service.update('pay_1', { action: 'REJECT', notes: 'x' }), { status: 409 })
  assert.equal(updates.length, 0)
  await assert.rejects(serviceWith(null).service.update('pay_1', { action: 'VERIFY', amount: 1 }), { status: 404 })
}

// Contract: REJECT needs a note, VERIFY needs a non-zero amount.
assert.equal(paymentReviewSchema.safeParse({ action: 'REJECT' }).success, false)
assert.equal(paymentReviewSchema.safeParse({ action: 'REJECT', notes: '  ' }).success, false)
assert.equal(paymentReviewSchema.safeParse({ action: 'VERIFY', amount: 0 }).success, false)
assert.equal(paymentReviewSchema.safeParse({ action: 'VERIFY' }).success, false)
const verifyOutput = paymentReviewSchema.parse({ action: 'VERIFY', amount: 10 })
assert.deepEqual(paymentReviewSchema.parse(JSON.parse(JSON.stringify(verifyOutput))), verifyOutput)

// The item route exposes PATCH.
assert.notEqual(paymentRoutes.item, undefined)

console.log('payment-review.dry-test: OK')
