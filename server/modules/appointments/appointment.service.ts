import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type { RepositoryTransformer } from '../../shared/repositories/base.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import {
  appointmentApiContract,
  appointmentWriteFailureCertaintySchema,
} from '../../../contracts/appointments/appointment-api.schema.js'
import { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'
import { appointmentsFieldMap } from './appointment.mapping.js'
import {
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
} from '../../shared/repositories/sheets-api.client.js'
import { DuplicateRowKeyError } from '../../shared/repositories/sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from '../../shared/repositories/sheet-row-identity.js'
import { ApiError } from '../../shared/http/api-error.js'

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

type AppointmentWriteFailureCertainty = z.infer<typeof appointmentWriteFailureCertaintySchema>

interface AppointmentWriteFailure {
  certainty: AppointmentWriteFailureCertainty
  message: string
}

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
  /** Optional DB column -> API field map for the sheet path. */
  fieldMap?: AppointmentSheetFieldMap
  /** Optional transformer for Address snapshot pack/unpack. */
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
      repository: classifyAppointmentWrites(input.repository),
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

/**
 * Translate only repository append/update failures into the existing API error
 * envelope. Reads and validation remain owned by BaseCrudService, so they do
 * not acquire write certainty accidentally.
 */
function classifyAppointmentWrites(
  provider: AppointmentSheetRepository | (() => AppointmentSheetRepository),
): () => AppointmentSheetRepository {
  const resolve = typeof provider === 'function' ? provider : () => provider

  return () => {
    const repository = resolve()

    return {
      read: (query) => repository.read(query),
      append: (row) => runAppointmentWrite(() => repository.append(row)),
      batchAppend: (rows) => repository.batchAppend(rows),
      update: (keyValue, patch) => runAppointmentWrite(() => repository.update(keyValue, patch)),
      delete: (keyValue, deletedBy) => repository.delete(keyValue, deletedBy),
    }
  }
}

async function runAppointmentWrite<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    const failure = classifyWriteFailure(error)
    throw ApiError.internal(failure.message, { certainty: failure.certainty })
  }
}

/**
 * A definite Sheets API rejection is retry-safe. Every other failure is
 * deliberately treated as unknown: claiming rejection without proof could
 * cause a retry to create a duplicate appointment.
 */
function classifyWriteFailure(error: unknown): AppointmentWriteFailure {
  if (error instanceof WriteRejectedError || error instanceof DuplicateRowKeyError) {
    return {
      certainty: 'rejected',
      message: error.message,
    }
  }

  if (
    error instanceof WriteTransportError ||
    error instanceof WriteCommittedUnreadableError ||
    error instanceof WriteRowIdentityMismatchError
  ) {
    return {
      certainty: 'unknown',
      message: error.message,
    }
  }

  return {
    certainty: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  }
}

function defaultAppointmentId(): string {
  return `APPT-${randomUUID().slice(0, 8)}`
}
