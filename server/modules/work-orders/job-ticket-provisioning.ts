import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import type { WorkRatesByTask } from './work-rate-lookup.js'

export type RoutableServiceType = 'WSIR' | 'IRON' | 'DRCL' | 'WASH'
export type JobTicketDepartment = z.infer<typeof jobTicketDepartmentSchema>

export interface RouteStep {
  department: JobTicketDepartment
  taskCode: string
}

export type ServiceRoutes = Record<RoutableServiceType, readonly RouteStep[]>

export interface JobTicketProvisioningOrder {
  orderId: string
  customerId: string | null
  orderName: string | null
  dueDate: string | null
  notes: string | null
  createdBy: string
  completedAt: string
}

export interface JobTicketProvisioningGarment {
  laundryItemId: string
  taggedBy: string | null
  serviceType: string | null
  specialInstructions: string | null
  photoEvidenceUrl: string | null
}

export interface ExistingJobTicket {
  id: string
  laundryItemId: string
  department: string
  taskCode: string | null
}

export interface ProvisionedJobTicketRow {
  id: string
  order_id: string
  laundry_item_id: string
  scope: 'ITEM'
  task_code: string
  department: JobTicketDepartment
  step_no: number
  customer_id: string | null
  order_name: string | null
  due_date: string | null
  special_instructions: string | null
  notes: string | null
  status: 'Pending' | 'Completed'
  started_at?: string
  completed_at?: string
  scanned_by?: string
  updated_by?: string
  photo_evidence_url: string | null
  created_by: string
  work_minutes: number | null
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

const defaultTaskCodes: Record<JobTicketDepartment, string> = {
  Tagging: 'TAG-PHOTO',
  Washing: 'WSH-STANDARD',
  DryCleaning: 'DRC-STANDARD',
  Ironing: 'IRN-STANDARD',
  Packaging: 'PCK-STANDARD',
  Logistics: 'LOG-STANDARD',
}

function defaultStep(department: JobTicketDepartment): RouteStep {
  return { department, taskCode: defaultTaskCodes[department] }
}

const taggingStep = defaultStep('Tagging')

export const serviceRoutes: ServiceRoutes = {
  WASH: [defaultStep('Washing'), defaultStep('Packaging')],
  WSIR: [defaultStep('Washing'), defaultStep('Ironing'), defaultStep('Packaging')],
  DRCL: [defaultStep('DryCleaning'), defaultStep('Ironing'), defaultStep('Packaging')],
  IRON: [defaultStep('Ironing'), defaultStep('Packaging')],
}

const departmentPrefixes: Record<JobTicketDepartment, string> = {
  Tagging: 'TAG',
  Washing: 'WSH',
  DryCleaning: 'DRC',
  Ironing: 'IRN',
  Packaging: 'PCK',
  Logistics: 'LOG',
}

export function departmentForJobTicketId(jobTicketId: string): JobTicketDepartment | null {
  const prefix = jobTicketId.split('-', 1)[0]
  const departments = Object.keys(departmentPrefixes) as JobTicketDepartment[]
  return departments.find((department) => departmentPrefixes[department] === prefix) ?? null
}

export function buildJobTicketId(orderId: string, laundryItemId: string, step: RouteStep): string {
  return `${departmentPrefixes[step.department]}-${orderId}-${laundryItemId}-${step.taskCode}`
}

function buildLegacyJobTicketId(orderId: string, laundryItemId: string, department: JobTicketDepartment): string {
  return `${departmentPrefixes[department]}-${orderId}-${laundryItemId}`
}

function occupancyKey(laundryItemId: string, step: RouteStep): string {
  return `${laundryItemId}\u0000${step.department}\u0000${step.taskCode}`
}

function occupiedByExisting(orderId: string, existingTickets: readonly ExistingJobTicket[]): Set<string> {
  const occupied = new Set<string>()
  const departments = Object.keys(defaultTaskCodes) as JobTicketDepartment[]
  for (const ticket of existingTickets) {
    const department = departments.find((candidate) => candidate === ticket.department)
    if (department === undefined) continue
    if (ticket.taskCode !== null && ticket.taskCode.trim() !== '') {
      occupied.add(occupancyKey(ticket.laundryItemId, { department, taskCode: ticket.taskCode.trim() }))
    }
    if (ticket.id === buildLegacyJobTicketId(orderId, ticket.laundryItemId, department)) {
      occupied.add(occupancyKey(ticket.laundryItemId, defaultStep(department)))
    }
  }
  return occupied
}

function minutesForStep(rates: WorkRatesByTask, step: RouteStep): number | null {
  const rate = rates.get(step.taskCode)
  return rate?.department === step.department ? rate.minutes : null
}

export function buildJobTickets(
  order: JobTicketProvisioningOrder,
  garments: readonly JobTicketProvisioningGarment[],
  existingTickets: readonly ExistingJobTicket[],
  ratesByTask: WorkRatesByTask,
  routes: ServiceRoutes = serviceRoutes,
): JobTicketProvisioningResult {
  const occupied = occupiedByExisting(order.orderId, existingTickets)
  const existingIds = new Set(existingTickets.map((ticket) => ticket.id))
  const rows: ProvisionedJobTicketRow[] = []
  const unroutableGarments: UnroutableGarment[] = []
  const photosByTag = new Map<string, string>()

  for (const garment of garments) {
    if (garment.photoEvidenceUrl?.trim() && !photosByTag.has(garment.laundryItemId)) {
      photosByTag.set(garment.laundryItemId, garment.photoEvidenceUrl)
    }
  }

  for (const garment of garments) {
    if (garment.laundryItemId.trim() === '') {
      unroutableGarments.push({
        laundryItemId: garment.laundryItemId,
        serviceType: garment.serviceType,
        reason: 'missingLaundryItemId',
      })
      continue
    }

    const taggingId = buildJobTicketId(order.orderId, garment.laundryItemId, taggingStep)
    const taggingKey = occupancyKey(garment.laundryItemId, taggingStep)
    if (garment.taggedBy !== null && !occupied.has(taggingKey) && !existingIds.has(taggingId)) {
      occupied.add(taggingKey)
      rows.push({
        id: taggingId,
        order_id: order.orderId,
        laundry_item_id: garment.laundryItemId,
        scope: 'ITEM',
        task_code: taggingStep.taskCode,
        department: taggingStep.department,
        step_no: 0,
        customer_id: order.customerId,
        order_name: order.orderName,
        due_date: order.dueDate,
        special_instructions: garment.specialInstructions,
        notes: order.notes,
        status: 'Completed',
        started_at: order.completedAt,
        completed_at: order.completedAt,
        scanned_by: garment.taggedBy,
        updated_by: garment.taggedBy,
        photo_evidence_url: photosByTag.get(garment.laundryItemId) ?? null,
        created_by: order.createdBy,
        work_minutes: minutesForStep(ratesByTask, taggingStep),
      })
    }

    if (!isRoutableServiceType(garment.serviceType, routes)) {
      unroutableGarments.push({
        laundryItemId: garment.laundryItemId,
        serviceType: garment.serviceType,
        reason: 'unsupportedServiceType',
      })
      continue
    }

    for (const [index, step] of routes[garment.serviceType].entries()) {
      const id = buildJobTicketId(order.orderId, garment.laundryItemId, step)
      const key = occupancyKey(garment.laundryItemId, step)
      if (occupied.has(key) || existingIds.has(id)) continue
      occupied.add(key)
      rows.push({
        id,
        order_id: order.orderId,
        laundry_item_id: garment.laundryItemId,
        scope: 'ITEM',
        task_code: step.taskCode,
        department: step.department,
        step_no: index + 1,
        customer_id: order.customerId,
        order_name: order.orderName,
        due_date: order.dueDate,
        special_instructions: garment.specialInstructions,
        notes: order.notes,
        status: 'Pending',
        photo_evidence_url: photosByTag.get(garment.laundryItemId) ?? null,
        created_by: order.createdBy,
        work_minutes: minutesForStep(ratesByTask, step),
      })
    }
  }

  return { rows, unroutableGarments }
}

function isRoutableServiceType(value: string | null, routes: ServiceRoutes): value is RoutableServiceType {
  return value !== null && Object.prototype.hasOwnProperty.call(routes, value)
}
