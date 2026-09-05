import type {
  PriceListCreatePayload,
  PriceListUpdatePayload,
} from '../services/price-list.service'

export type PriceListFormState = {
  itemCode: string
  category: string
  subcategory: string
  itemType: string
  variant: string
  displayNameTh: string
  displayNameEn: string
  serviceType: PriceListCreatePayload['serviceType']
  priceGroup: string
  unit: string
  price: string | number
  creditEligible: boolean
  effectiveFrom: string
  effectiveTo: string
  active: boolean
}

export type PriceListCreateMode = 'new' | 'existing'

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized === '' ? null : normalized
}

function requiredPrice(value: string | number): number {
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error('กรุณาระบุราคา')
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('กรุณาระบุราคาเป็นศูนย์หรือจำนวนที่มากกว่า')
  }
  return parsed
}

type PriceListFields = Omit<PriceListCreatePayload, 'itemCode'>

function priceListFields(form: PriceListFormState): PriceListFields {
  return {
    category: form.category,
    subcategory: form.subcategory,
    itemType: form.itemType,
    variant: optionalText(form.variant),
    displayNameTh: form.displayNameTh,
    displayNameEn: optionalText(form.displayNameEn),
    serviceType: form.serviceType,
    priceGroup: form.priceGroup,
    unit: optionalText(form.unit),
    price: requiredPrice(form.price),
    creditEligible: form.creditEligible,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: optionalText(form.effectiveTo),
    active: form.active,
  }
}

export function createPriceListPayload(
  form: PriceListFormState,
  mode: PriceListCreateMode,
): PriceListCreatePayload {
  const fields = priceListFields(form)
  if (mode === 'new') return fields

  const itemCode = form.itemCode.trim()
  if (itemCode === '') throw new Error('กรุณาเลือกรายการเดิม')
  return { ...fields, itemCode }
}

export function updatePriceListPayload(form: PriceListFormState): PriceListUpdatePayload {
  return priceListFields(form)
}
