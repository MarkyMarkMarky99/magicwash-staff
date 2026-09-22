export type RoutableServiceType = 'WSIR' | 'IRON' | 'DRCL' | 'WASH'
export type JobTicketDepartment = 'Washing' | 'DryCleaning' | 'Ironing' | 'Packaging'

export interface JobTicketProvisioningOrder {
  orderId: string
  customerId: string | null
  orderName: string | null
  dueDate: string | null
  notes: string | null
  createdBy: string
}

export interface JobTicketProvisioningGarment {
  laundryItemId: string
  serviceType: string | null
  specialInstructions: string | null
}

export interface ExistingJobTicket {
  laundryItemId: string
  department: string
}

export interface ProvisionedJobTicketRow {
  id: string
  order_id: string
  laundry_item_id: string
  scope: 'ITEM'
  service_type: RoutableServiceType
  department: JobTicketDepartment
  step_no: number
  customer_id: string | null
  order_name: string | null
  due_date: string | null
  special_instructions: string | null
  notes: string | null
  status: 'Pending'
  created_by: string
}

export interface UnroutableGarment {
  laundryItemId: string
  serviceType: string | null
  reason: 'missingLaundryItemId' | 'unsupportedServiceType'
}

export interface JobTicketProvisioningResult {
  rows: ProvisionedJobTicketRow[]
  unroutableGarments: UnroutableGarment[]
}

const routes: Record<RoutableServiceType, readonly JobTicketDepartment[]> = {
  WASH: ['Washing', 'Packaging'],
  WSIR: ['Washing', 'Ironing', 'Packaging'],
  DRCL: ['DryCleaning', 'Ironing', 'Packaging'],
  IRON: ['Ironing', 'Packaging'],
}

export function buildJobTickets(
  order: JobTicketProvisioningOrder,
  garments: readonly JobTicketProvisioningGarment[],
  existingTickets: readonly ExistingJobTicket[],
): JobTicketProvisioningResult {
  const occupiedPairs = new Set(
    existingTickets.map((ticket) => `${ticket.laundryItemId}\u0000${ticket.department}`),
  )
  const rows: ProvisionedJobTicketRow[] = []
  const unroutableGarments: UnroutableGarment[] = []

  for (const garment of garments) {
    if (garment.laundryItemId.trim() === '') {
      unroutableGarments.push({
        laundryItemId: garment.laundryItemId,
        serviceType: garment.serviceType,
        reason: 'missingLaundryItemId',
      })
      continue
    }

    if (!isRoutableServiceType(garment.serviceType)) {
      unroutableGarments.push({
        laundryItemId: garment.laundryItemId,
        serviceType: garment.serviceType,
        reason: 'unsupportedServiceType',
      })
      continue
    }

    for (const [index, department] of routes[garment.serviceType].entries()) {
      const pair = `${garment.laundryItemId}\u0000${department}`
      if (occupiedPairs.has(pair)) continue
      occupiedPairs.add(pair)
      rows.push({
        id: `${order.orderId}:${garment.laundryItemId}:${department}`,
        order_id: order.orderId,
        laundry_item_id: garment.laundryItemId,
        scope: 'ITEM',
        service_type: garment.serviceType,
        department,
        step_no: index + 1,
        customer_id: order.customerId,
        order_name: order.orderName,
        due_date: order.dueDate,
        special_instructions: garment.specialInstructions,
        notes: order.notes,
        status: 'Pending',
        created_by: order.createdBy,
      })
    }
  }

  return { rows, unroutableGarments }
}

function isRoutableServiceType(value: string | null): value is RoutableServiceType {
  return value !== null && Object.prototype.hasOwnProperty.call(routes, value)
}
