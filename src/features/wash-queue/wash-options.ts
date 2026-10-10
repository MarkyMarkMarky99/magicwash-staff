import type { z } from 'zod'
import type { washOptionsSchema, washStepSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'

export type WashOptions = z.infer<typeof washOptionsSchema>
export type WashStep = z.infer<typeof washStepSchema>

export function programToOptions(program: WashProgramDto): WashOptions {
  return { program: program.id, steps: program.steps.map((step) => ({ ...step, products: [...step.products] })) }
}
export function optionsMatchProgram(options: WashOptions, program: WashProgramDto): boolean {
  return options.steps.length === program.steps.length && options.steps.every((step, index) => {
    const expected = program.steps[index]!
    return step.type === expected.type && step.products.length === expected.products.length &&
      step.products.every((id, i) => id === expected.products[i]) &&
      ('temperature' in step ? step.temperature === ('temperature' in expected ? expected.temperature : undefined) : true) &&
      ('duration' in step ? step.duration === ('duration' in expected ? expected.duration : undefined) : true)
  })
}
export function markCustom(options: WashOptions): WashOptions {
  return { program: 'CUSTOM', steps: options.steps.map((step) => ({ ...step, products: [...step.products] })) }
}
export function defaultWashOptions(programs: readonly WashProgramDto[]): WashOptions {
  const program = programs.find((program) => program.status === 'ACTIVE')
  return program ? programToOptions(program) : { program: 'CUSTOM', steps: [{ type: 'normal_wash', products: [], temperature: 'cold' }] }
}
export function washOptionsSummary(options: WashOptions, programName: string): string {
  const soaks = options.steps.filter((step) => step.type === 'soak')
  const soak = soaks[0]
  const suffix = soaks.length > 1 ? ` · ${soaks.length} soaks` : soak ? ` · ${soak.duration === 'overnight' ? 'overnight' : `${soak.duration} min`} soak` : ''
  return `${options.program === 'CUSTOM' ? 'Custom' : programName} · ${options.steps.length} ${options.steps.length === 1 ? 'step' : 'steps'}${suffix}`
}
export function stepLabel(type: WashStep['type']): string {
  return { stain_removal: 'Stain removal', quick_wash: 'Quick wash', normal_wash: 'Normal wash', rinse: 'Rinse', soak: 'Soak' }[type]
}
export function stepChips(step: WashStep, productName: (id: string) => string): string[] {
  const chips: string[] = []
  if ('temperature' in step) chips.push(step.temperature === 'cold' ? 'Cold' : `${step.temperature}°C`)
  if (step.type === 'soak') chips.push(step.duration === 'overnight' ? 'Overnight' : `${step.duration} min`)
  chips.push(...step.products.map(productName))
  if (!step.products.length) chips.push(step.type === 'stain_removal' ? 'By hand' : 'temperature' in step ? 'No product' : 'Water only')
  return chips
}
