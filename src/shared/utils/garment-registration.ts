import { readScanCode } from './scan-code'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'

export function validGarmentTag(value: string): string | null {
  const code = readScanCode(value)
  if (code.kind !== 'garment' && code.kind !== 'unknown') return null
  const tag = code.id
  return laundryTagIdSchema.safeParse(tag).success ? tag : null
}

export function isDuplicateGarmentTag(tag: string, existingTags: ReadonlySet<string>, sessionTags: ReadonlySet<string>): boolean {
  return existingTags.has(tag) || sessionTags.has(tag)
}

export function canSaveGarment(tag: string | null, photo: File | null, existingTags: ReadonlySet<string>, sessionTags: ReadonlySet<string>): boolean {
  return Boolean(tag && validGarmentTag(tag) === tag && photo && !isDuplicateGarmentTag(tag, existingTags, sessionTags))
}
