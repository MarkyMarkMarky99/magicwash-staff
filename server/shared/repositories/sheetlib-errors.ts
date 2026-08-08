// Typed SheetLib write failures. Every `SheetRepository` write (APPEND/UPDATE)
// throws one of these two classes instead of a generic `Error`, so callers that
// need to tell "the gateway gave a definite answer" apart from "no definite
// answer ever came back" can `instanceof`-check instead of parsing `.message`.
// Both extend `Error` with the exact same message text the shared repository
// tests already assert on, so this is purely additive: nothing that only does
// `assert.rejects(fn, /pattern/)` against the existing message format breaks.
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
