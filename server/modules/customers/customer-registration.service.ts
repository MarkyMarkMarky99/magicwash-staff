import type { z } from 'zod'
import { customerApiContract } from '../../../contracts/customers/customer-api.schema.js'
import { generateShortId } from '../../../shared/utils/id.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { customerIdMappingRowSchema } from '../../sheets/CustomerIDMapping/CustomerIDMapping.db-contract.js'
import { getCustomerIdMappingRepository } from '../../sheets/CustomerIDMapping/CustomerIDMapping.repository.js'
import { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'

type CustomerRow = z.infer<typeof customersRowSchema>
type MappingRow = z.infer<typeof customerIdMappingRowSchema>
type CustomerResponse = z.infer<typeof customerApiContract.response.create>

export interface CustomerRegistrationOptions {
  customers?: () => Pick<SheetRepositoryContract<CustomerRow>, 'read' | 'append'>
  mapping?: () => Pick<SheetRepositoryContract<MappingRow>, 'read' | 'update'>
  generateId?: () => string
  random?: () => number
  now?: () => Date
}

export class CustomerRegistrationService {
  private readonly customers: NonNullable<CustomerRegistrationOptions['customers']>
  private readonly mapping: NonNullable<CustomerRegistrationOptions['mapping']>
  private readonly generateId: () => string
  private readonly random: () => number
  private readonly now: () => Date

  constructor(options: CustomerRegistrationOptions = {}) {
    this.customers = options.customers ?? getCustomersRepository
    this.mapping = options.mapping ?? getCustomerIdMappingRepository
    this.generateId = options.generateId ?? generateShortId
    this.random = options.random ?? Math.random
    this.now = options.now ?? (() => new Date())
  }

  async create(payload: unknown): Promise<CustomerResponse> {
    const data = parseOrThrow(customerApiContract.request.create, payload)
    const customerId = this.generateId()
    const customers = this.customers()
    const mapping = this.mapping()
    const phoneDigits = data.phone.replace(/\D/g, '')
    const existing = await customers.read()
    if (existing.some((row) =>
      (row.DeletedAt == null || row.DeletedAt === '')
      && typeof row.Phone === 'string'
      && row.Phone.replace(/\D/g, '') === phoneDigits
    )) {
      throw ApiError.conflict('duplicate_phone', { code: 'duplicate_phone' })
    }

    const labels = (await mapping.read()).filter((row) =>
      row.CustomerLabel && (row.CustomerID == null || row.CustomerID === ''),
    )
    if (labels.length === 0) throw ApiError.conflict('No customer labels available')
    const label = labels[Math.floor(this.random() * labels.length)].CustomerLabel!
    await mapping.update(label, { CustomerID: customerId })

    const timestamp = formatBangkokTimestamp(this.now())
    const row: CustomerRow = {
      Timestamp: timestamp,
      CustomerID: customerId,
      CustomerIndex: label,
      CustomerName: data.customerName,
      Phone: data.phone,
      Address: data.address ?? null,
      Location: data.location ?? null,
      RegisteredDate: data.registeredDate ?? timestamp.slice(0, 10),
      Facebook: data.facebook ?? null,
      Line: data.lineId ?? null,
      Whatsapp: data.whatsapp ?? null,
      Email: data.email ?? null,
      CustomerType: data.customerType ?? null,
      Source: data.source ?? null,
      ScheduledDays: null,
      LastVisitDate: null,
      PreferredContactMethod: null,
      UpdatedAt: null,
      UpdatedBy: data.updatedBy,
      DeletedAt: null,
    }

    try {
      await customers.append(row)
    } catch (error) {
      if (classifySheetWriteFailure(error).certainty !== 'rejected') throw error
      try {
        await mapping.update(label, { CustomerID: '' })
      } catch {
        throw error
      }
      throw error
    }

    return {
      customerId,
      customerIndex: label,
      customerName: row.CustomerName,
      phone: row.Phone,
      address: row.Address,
      location: row.Location,
      customerType: row.CustomerType,
      registeredDate: row.RegisteredDate,
      facebook: row.Facebook,
      lineId: row.Line,
      whatsapp: row.Whatsapp,
      email: row.Email,
    }
  }
}
