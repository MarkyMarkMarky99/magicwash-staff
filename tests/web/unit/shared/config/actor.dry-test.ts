import assert from 'node:assert/strict'
import { currentActor } from '@/shared/config/actor'

// The app has no authentication yet, so `currentActor` is the single place that decides
// what goes into `created_by` / `updated_by`. The override exists only for AppSheet,
// which deep-links in with `?by=<name>`; everything else must fall back to the default.

const FALLBACK = 'admin'

// --- falls back whenever there is no usable override -------------------------------
assert.equal(currentActor(), FALLBACK, 'no argument falls back')
assert.equal(currentActor(undefined), FALLBACK, 'undefined falls back')
assert.equal(currentActor(null), FALLBACK, 'null falls back')
assert.equal(currentActor(''), FALLBACK, 'empty string falls back')
assert.equal(currentActor('   '), FALLBACK, 'whitespace-only falls back')
assert.equal(currentActor('\t\n '), FALLBACK, 'other whitespace falls back')

// A blank override must never reach the write. The photo gallery posts `created_by` to
// an Apps Script gateway that rejects an empty value with
// "Validation failed: Missing required field: created_by", which silently lost every
// capture started from an in-app link.
assert.notEqual(currentActor(''), '', 'must never resolve to an empty string')

// --- honours a real override (AppSheet backward compatibility) ---------------------
assert.equal(currentActor('appsheet'), 'appsheet', 'a real name is kept')
assert.equal(currentActor('  appsheet  '), 'appsheet', 'a real name is trimmed')
assert.equal(currentActor('Jane Doe'), 'Jane Doe', 'inner spaces are preserved')

// --- non-string input is treated as absent ----------------------------------------
// vue-router types `route.query.by` as `string | string[] | undefined`. Call sites are
// expected to unwrap an array themselves; if one forgets, this must degrade to the
// fallback rather than stringifying an array into the sheet.
assert.equal(currentActor(['a', 'b'] as unknown as string), FALLBACK, 'an array falls back')
assert.equal(currentActor(42 as unknown as string), FALLBACK, 'a number falls back')

console.log('actor.dry-test: OK (fallback, blank handling, override, non-string input)')
