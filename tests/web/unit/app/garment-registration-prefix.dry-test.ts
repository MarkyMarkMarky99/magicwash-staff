import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computed, effectScope, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ScriptTarget, transpileModule } from 'typescript'
import { canSaveGarment, isDuplicateGarmentTag, validGarmentTag } from '@/shared/utils/garment-registration'

const source = readFileSync(new URL('../../../../src/features/laundry-items/composables/useLaundryItemRegisterGarments.ts', import.meta.url), 'utf8')
const code = transpileModule(source.replace(/^import .*$/gm, '').replace('export function', 'function'), { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText
for (const prefix of ['', 'MWG-', 'mwg-']) {
  const scope = effectScope()
  const checked: string[] = []
  const saved: string[] = []
  const dependencies = {
    computed, onScopeDispose, ref, shallowRef, watch, canSaveGarment, isDuplicateGarmentTag, validGarmentTag,
    feedback: () => {}, window: { clearTimeout: () => {}, setTimeout: () => 1 },
    getLaundryItem: async (tag: string) => { checked.push(tag); return null },
  }
  const registration = scope.run(() => new Function(...Object.keys(dependencies), `${code}; return useLaundryItemRegisterGarments(() => 'customer-1', () => new Set(), arguments[arguments.length - 1]);`)(...Object.values(dependencies), (tag: string) => saved.push(tag)))!
  await registration.acceptTag(`${prefix}Ab12Cd34`)
  registration.setPhoto(new File(['photo'], 'photo.jpg'))
  assert.deepEqual(checked, ['Ab12Cd34'])
  assert.deepEqual(saved, ['Ab12Cd34'])
  scope.stop()
}
console.log('garment-registration-prefix.dry-test: OK')
