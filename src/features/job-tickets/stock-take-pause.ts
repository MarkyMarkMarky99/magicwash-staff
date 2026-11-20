import { ApiError } from '@/shared/api/api-client'

export const STOCK_TAKE_PAUSE_MESSAGE = 'Paused: a stock-take is in progress'

export function failureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.code === 'STOCK_TAKE_ACTIVE' ? STOCK_TAKE_PAUSE_MESSAGE : fallback
}

export function failureNotice(error: unknown, title: string, message: string): { title: string; message: string } {
  return failureMessage(error, message) === message ? { title, message } : { title: 'Paused', message: STOCK_TAKE_PAUSE_MESSAGE }
}
