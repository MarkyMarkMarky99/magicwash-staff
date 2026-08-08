import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type { RepositoryTransformer } from '../../shared/repositories/base.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { appointmentApiContract } from '../../../contracts/appointments/appointment-api.schema.js'
import { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'
import { appointmentsFieldMap } from './appointment.mapping.js'

export type AppointmentSheetDbRow = z.infer<typeof appointmentsRowSchema>
export type AppointmentApiRow = z.infer<typeof appointmentApiContract.response.detail>
export type AppointmentSheetFieldMap = Partial<
  Record<keyof AppointmentSheetDbRow & string, string>
>
export type AppointmentListQuery = z.infer<typeof appointmentApiContract.query.list>
export type AppointmentCreateInput = z.infer<typeof appointmentApiContract.request.create>
export type AppointmentUpdateInput = z.infer<typeof appointmentApiContract.request.update>
export type AppointmentListResponse = z.infer<typeof appointmentApiContract.response.list>
export type AppointmentDetailResponse = z.infer<typeof appointmentApiContract.response.detail>
export type AppointmentCreateResponse = z.infer<typeof appointmentApiContract.response.create>
export type AppointmentUpdateResponse = z.infer<typeof appointmentApiContract.response.update>

export type AppointmentCreateCommand = AppointmentCreateInput & {
  appointmentId: string
  status: 'CONFIRMED'
  serviceTier: 'STANDARD'
  createdAt: string
  updatedAt: string
}

export type AppointmentUpdateCommand = AppointmentUpdateInput & {
  updatedAt: string
}

export type AppointmentSheetRepository = SheetRepositoryContract<AppointmentSheetDbRow>

export interface AppointmentServiceOptions {
  repository: AppointmentSheetRepository | (() => AppointmentSheetRepository)
  /** Supplied by the migrated module to select the DB-shaped sheet path. */
  fieldMap?: AppointmentSheetFieldMap
  /** Supplied by the migrated module for the Address snapshot shape change. */
  transformer?: RepositoryTransformer
  generateAppointmentId?: () => string
  now?: () => Date
}

/**
 * Appointment-specific write policy. BaseCrudService still validates the public
 * request once, checks update existence, persists through the existing repository,
 * and projects the response. These hooks receive only validated API inputs.
 */
export class AppointmentService extends BaseCrudService<
  AppointmentApiRow,
  AppointmentListQuery,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  AppointmentListResponse,
  AppointmentDetailResponse,
  AppointmentCreateResponse,
  AppointmentUpdateResponse,
  AppointmentSheetDbRow,
  AppointmentSheetFieldMap
> {
  private readonly generateAppointmentId: () => string
  private readonly now: () => Date

  constructor(input: AppointmentServiceOptions) {
    super({
      repository: input.repository,
      api: appointmentApiContract,
      searchFields: ['appointmentId', 'customerId', 'notes'],
      fieldMap: input.fieldMap ?? appointmentsFieldMap,
      transformer: input.transformer,
    })
    this.generateAppointmentId = input.generateAppointmentId ?? defaultAppointmentId
    this.now = input.now ?? (() => new Date())
  }

  protected override prepareCreate(data: AppointmentCreateInput): AppointmentCreateCommand {
    const timestamp = formatBangkokTimestamp(this.now())

    return {
      ...data,
      appointmentId: this.generateAppointmentId(),
      status: 'CONFIRMED',
      serviceTier: 'STANDARD',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  protected override prepareUpdate(
    _id: string,
    data: AppointmentUpdateInput,
  ): AppointmentUpdateCommand {
    return {
      ...data,
      updatedAt: formatBangkokTimestamp(this.now()),
    }
  }
}

export function formatBangkokTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`
}

function defaultAppointmentId(): string {
  return `APPT-${randomUUID().slice(0, 8)}`
}
