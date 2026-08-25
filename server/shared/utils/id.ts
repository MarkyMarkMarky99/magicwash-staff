import { randomUUID } from 'node:crypto'

/** 8 lowercase hex characters — the first hyphen-delimited group of a UUID v4. */
export function generateShortId(): string {
  return randomUUID().slice(0, 8)
}
