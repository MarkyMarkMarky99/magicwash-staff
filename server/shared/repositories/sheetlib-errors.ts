// Typed SheetLib write failures. Writes that go through the SheetLib/Apps Script
// transport throw one of these two classes instead of a generic Error. Writes on
// the Sheets API transport throw their own classes instead (WriteRejectedError,
// WriteTransportError, WriteCommittedUnreadableError, WriteRowIdentityMismatchError,
// DuplicateRowKeyError) — anything that catches write failures must handle both sets.
//
//   - SheetLibRejectedError    the gateway responded `{ status: 'error' }` —
//     a definite rejection. Nothing was written for that one request.
//   - SheetLibTransportError   no definite answer came back at all: a network
//     failure, timeout, non-2xx HTTP status, an unparsable body, or a
//     malformed/unknown response shape. The write may or may not have
//     persisted — never treat this the same as a confirmed rejection.

export class SheetLibRejectedError extends Error {
  readonly action: string

  constructor(action: string, message: string) {
    super(`SheetLib ${action} failed: ${message}`)
    this.name = 'SheetLibRejectedError'
    this.action = action
  }
}

export class SheetLibTransportError extends Error {
  readonly action: string

  constructor(action: string, message: string) {
    super(message)
    this.name = 'SheetLibTransportError'
    this.action = action
  }
}
