import assert from 'node:assert/strict'
import type { WashProgramDto } from '../../src/data/wash-programs/wash-programs.service'
import { defaultWashOptions, markCustom, optionsMatchProgram, programToOptions, stepChips, stepLabel, washOptionsSummary, type WashOptions } from '../../src/features/wash-queue/wash-options'

const program: WashProgramDto = { id: 'SPA', name: 'Spa', status: 'ACTIVE', sortOrder: 1, steps: [
  { type: 'quick_wash', products: ['A'], temperature: 'cold' },
  { type: 'rinse', products: [] }, { type: 'soak', products: [], duration: 'overnight' },
  { type: 'normal_wash', products: ['B', 'C'], temperature: '60' },
  { type: 'rinse', products: [] }, { type: 'rinse', products: ['S'] },
] }
const options = programToOptions(program)
assert.equal(options.program, 'SPA')
assert.deepEqual(options.steps, program.steps)
assert.notEqual(options.steps, program.steps)
for (let i = 0; i < options.steps.length; i++) {
  assert.notEqual(options.steps[i], program.steps[i])
  assert.notEqual(options.steps[i]!.products, program.steps[i]!.products)
}
assert.ok(optionsMatchProgram(options, program))
assert.ok(optionsMatchProgram({ ...options, program: 'CUSTOM' }, program))
for (const steps of [
  options.steps.slice(1), [...options.steps].reverse(),
  options.steps.map((step, i) => i === 0 ? { ...step, products: ['X'] } : step),
  options.steps.map((step, i) => i === 0 ? { type: 'quick_wash', products: ['A'], temperature: '40' } : step),
  options.steps.map((step, i) => i === 2 ? { type: 'soak', products: [], duration: 30 } : step),
  options.steps.map((step, i) => i === 0 ? { type: 'normal_wash', products: ['A'], temperature: 'cold' } : step),
] as WashOptions['steps'][]) assert.equal(optionsMatchProgram({ program: 'SPA', steps }, program), false)
const custom = markCustom(options)
assert.equal(custom.program, 'CUSTOM')
assert.equal(options.program, 'SPA')
assert.deepEqual(custom.steps, options.steps)
custom.steps[0]!.products.push('X')
assert.deepEqual(options.steps[0]!.products, ['A'])
const inactive = { ...program, id: 'OLD', status: 'INACTIVE' as const }
assert.deepEqual(defaultWashOptions([inactive, program]), options)
assert.deepEqual(defaultWashOptions([]), { program: 'CUSTOM', steps: [{ type: 'normal_wash', products: [], temperature: 'cold' }] })
assert.deepEqual(defaultWashOptions([inactive]), defaultWashOptions([]))
const fallback = defaultWashOptions([]); fallback.steps[0]!.products.push('X')
assert.deepEqual(defaultWashOptions([]).steps[0]!.products, [])
assert.equal(washOptionsSummary(options, 'Spa'), 'Spa · 6 steps · overnight soak')
assert.equal(washOptionsSummary({ program: 'CUSTOM', steps: options.steps.filter((step) => step.type !== 'soak').slice(0, 4) }, 'Spa'), 'Custom · 4 steps')
assert.equal(washOptionsSummary({ program: 'CUSTOM', steps: [{ type: 'soak', products: [], duration: 30 }] }, ''), 'Custom · 1 step · 30 min soak')
assert.equal(washOptionsSummary({ program: 'CUSTOM', steps: [{ type: 'soak', products: [], duration: 30 }, { type: 'soak', products: [], duration: 'overnight' }] }, ''), 'Custom · 2 steps · 2 soaks')
assert.deepEqual(['stain_removal', 'quick_wash', 'normal_wash', 'rinse', 'soak'].map((type) => stepLabel(type as WashOptions['steps'][number]['type'])), ['Stain removal', 'Quick wash', 'Normal wash', 'Rinse', 'Soak'])
const name = (id: string): string => ({ A: 'Detergent A', S: 'Softener' }[id] ?? id)
assert.deepEqual(stepChips({ type: 'normal_wash', products: [], temperature: 'cold' }, name), ['Cold', 'No product'])
assert.deepEqual(stepChips({ type: 'quick_wash', products: ['A', 'UNKNOWN'], temperature: '40' }, name), ['40°C', 'Detergent A', 'UNKNOWN'])
assert.deepEqual(stepChips({ type: 'normal_wash', products: ['S'], temperature: '60' }, name), ['60°C', 'Softener'])
assert.deepEqual(stepChips({ type: 'rinse', products: [] }, name), ['Water only'])
assert.deepEqual(stepChips({ type: 'soak', products: [], duration: 'overnight' }, name), ['Overnight', 'Water only'])
assert.deepEqual(stepChips({ type: 'soak', products: ['A'], duration: 120 }, name), ['120 min', 'Detergent A'])
assert.deepEqual(stepChips({ type: 'rinse', products: ['S'] }, name), ['Softener'])
assert.deepEqual(stepChips({ type: 'stain_removal', products: [] }, name), ['By hand'])
assert.deepEqual(stepChips({ type: 'stain_removal', products: ['A', 'UNKNOWN'] }, name), ['Detergent A', 'UNKNOWN'])
console.log('wash options dry test passed (defaults, deep copies, program matching, custom, summaries, labels, chips)')
