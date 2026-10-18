/** The actor recorded when no staff member is signed in. */
const FALLBACK_ACTOR = 'unknown'
let operator: { staffId: string; name: string } | null = null
let signedInStaffId: string | null = null

export function setSignedInStaffId(id: string | null): void {
  signedInStaffId = id?.trim() || null
}

export function setOperator(op: { staffId: string; name: string } | null): void {
  operator = op
}

export function currentOperatorId(): string | null {
  return operator?.staffId ?? null
}

export function currentActor(_override?: unknown): string {
  return currentOperatorId() ?? signedInStaffId ?? FALLBACK_ACTOR
}
