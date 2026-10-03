/** The actor recorded when no staff member is signed in. */
const FALLBACK_ACTOR = 'unknown'
let signedInStaffId: string | null = null

export function setSignedInStaffId(id: string | null): void {
  signedInStaffId = id?.trim() || null
}

/** Resolve the signed-in StaffId for writes; legacy overrides are ignored. */
export function currentActor(_override?: unknown): string {
  return signedInStaffId ?? FALLBACK_ACTOR
}
