import { serviceTypeSchema } from './service-type.schema.js'

/**
 * The one Thai wording for a service-type code, and the one icon for it.
 *
 * This lives in `contracts/shared/` and not in `src/shared/` because a service type is domain
 * vocabulary, and not in any feature because price-list, invoices and orders all display it and
 * features may not import each other. `@contracts/*` is the only path legal from all of them.
 *
 * Before 2026-09-06 there were four copies with two different Thai wordings
 * (`ซัก อบ รีด` in price-list/invoices vs `ซักรีด` in orders). The orders wording won.
 * Do not reintroduce a local copy — change the wording here instead.
 */
type ServiceType = (typeof serviceTypeSchema.options)[number]

export const serviceTypePresentation: Record<ServiceType, { label: string; icon: string }> = {
  WSIR: { label: 'ซักรีด', icon: 'local_laundry_service' },
  IRON: { label: 'รีด', icon: 'iron' },
  DRCL: { label: 'ซักแห้ง', icon: 'dry_cleaning' },
  WASH: { label: 'ซัก', icon: 'water_drop' },
}

/** Unknown codes fall back to the raw code — reads are not validated against dirty cells. */
export function serviceTypeLabel(serviceType: string | null | undefined): string | null {
  if (!serviceType) return null
  return serviceTypePresentation[serviceType as ServiceType]?.label ?? serviceType
}

export const serviceTypeOptions = serviceTypeSchema.options.map((value) => ({
  value,
  label: serviceTypePresentation[value].label,
  icon: serviceTypePresentation[value].icon,
}))
