import assert from 'node:assert/strict'
import { ApiError } from '@/shared/api/api-client'
import { failureMessage, failureNotice, STOCK_TAKE_PAUSE_MESSAGE } from '@/features/job-tickets/stock-take-pause'

const paused = new ApiError('This operation is paused while a stock-take is active.', 409, 'STOCK_TAKE_ACTIVE')
assert.equal(failureMessage(paused, 'Connection failed. Try again'), STOCK_TAKE_PAUSE_MESSAGE)
assert.equal(failureMessage(paused, 'Connection failed. Try again'), 'Paused: a stock-take is in progress')
assert.equal(failureMessage(new ApiError('Conflict', 409, 'CONFLICT'), 'Connection failed. Try again'), 'Connection failed. Try again')
assert.equal(failureMessage(new TypeError('Failed to fetch'), 'Connection failed. Try again'), 'Connection failed. Try again')
assert.deepEqual(failureNotice(paused, 'Connection failed', 'Connection failed. Try again'), { title: 'Paused', message: STOCK_TAKE_PAUSE_MESSAGE })
assert.deepEqual(failureNotice(new Error('x'), 'Connection failed', 'Connection failed. Try again'), { title: 'Connection failed', message: 'Connection failed. Try again' })

console.log('stock-take-pause.dry-test: OK')
