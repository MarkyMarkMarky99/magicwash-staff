/** The actor recorded on writes until this app has real authentication. */
const FALLBACK_ACTOR = 'admin'

/**
 * Resolve who to record as the actor on a write.
 *
 * `override` exists for backward compatibility with AppSheet, which deep-links into
 * this app with `?by=<name>` and expects that name to be recorded. Anything empty,
 * blank, or absent falls back to the app default.
 */
export function currentActor(override?: string | null): string {
  const external = typeof override === 'string' ? override.trim() : ''
  return external === '' ? FALLBACK_ACTOR : external
}
