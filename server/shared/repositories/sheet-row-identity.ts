import type { SheetsApiValue, WriteCertainty } from './sheets-api.client.js'

export class WriteRowIdentityMismatchError extends Error {
  readonly certainty: WriteCertainty

  constructor(message: string) {
    super(message)
    this.name = 'WriteRowIdentityMismatchError'
    this.certainty = 'unknown'
  }
}

export function verifyRowIdentity(
  row: Record<string, SheetsApiValue>,
  primaryKeyColumn: string,
  expectedKey: string,
): void {
  if (row[primaryKeyColumn] !== expectedKey) {
    throw new WriteRowIdentityMismatchError(
      'The row moved between lookup and write, so the written row identity could not be confirmed; do not retry blindly.',
    )
  }
}
