import { z } from 'zod'
import { laundryItemRegisterRequestSchema, laundryItemRegisterResponseSchema } from '../../../contracts/laundry-items/laundry-item-register-api.schema.js'
import { laundryTagIdSchema } from '../../../contracts/laundry-tag-prints/laundry-tag-print.schema.js'
import type { laundryItemsRowSchema } from '../../sheets/LaundryItems/LaundryItems.db-contract.js'
import type { laundryItemPhotosRowSchema } from '../../sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'

type LaundryItemRow = z.infer<typeof laundryItemsRowSchema>
type PhotoRow = z.infer<typeof laundryItemPhotosRowSchema>
type LaundryItemRegisterResponse = z.infer<typeof laundryItemRegisterResponseSchema>

const registrationSchema = laundryItemRegisterRequestSchema.extend({ createdBy: z.string().trim().min(1) })
const tagCheckSchema = z.object({ customerId: z.string().trim().min(1), tags: z.array(laundryTagIdSchema) })
const actorSchema = z.object({ staffId: z.string().trim().min(1) })

interface RegistrationDependencies {
  laundryItems: Pick<SheetRepositoryContract<LaundryItemRow>, 'read' | 'batchAppend'>
  photos: Pick<SheetRepositoryContract<PhotoRow>, 'read' | 'batchAppend'>
  customerExists: (customerId: string) => Promise<boolean>
  generateId: () => string
  now: () => string
  triggerClassification: (actorStaffId: string) => Promise<boolean>
}

export class LaundryItemRegistrationService {
  constructor(private readonly dependencies: RegistrationDependencies) {}

  async checkTags(customerId: string, tags: string[]): Promise<{ new: string[], registered: string[], conflicts: string[] }> {
    const data = parseOrThrow(tagCheckSchema, { customerId, tags })
    const rows = await this.dependencies.laundryItems.read()
    const liveRows = rows.filter(row => !row.deleted_at)
    const result = { new: [] as string[], registered: [] as string[], conflicts: [] as string[] }
    for (const tag of data.tags) {
      const matches = liveRows.filter(row => row.id === tag)
      if (matches.some(row => row.customer_id !== data.customerId)) result.conflicts.push(tag)
      else if (matches.length > 0) result.registered.push(tag)
      else result.new.push(tag)
    }
    return result
  }

  async register(payload: unknown, actor: unknown): Promise<LaundryItemRegisterResponse> {
    const data = parseOrThrow(registrationSchema, payload)
    const { staffId } = parseOrThrow(actorSchema, actor)
    const deps = this.dependencies
    if (!await deps.customerExists(data.customerId)) throw ApiError.notFound('Customer not found')
    const tags = await this.checkTags(data.customerId, data.garments.map(garment => garment.tag))
    if (tags.conflicts.length > 0) {
      throw new ApiError('TAG_CONFLICT', `Tag belongs to another customer: ${tags.conflicts.join(', ')}`, { tags: tags.conflicts })
    }
    const now = deps.now()
    const newTags = new Set(tags.new)
    const newGarments = data.garments.filter(garment => newTags.has(garment.tag))
    if (newGarments.length > 0) {
      await deps.laundryItems.batchAppend(newGarments.map(garment => ({
        id: garment.tag, customer_id: data.customerId, item_id: garment.itemId ?? null,
        wash_program: null, notes: null, image_url: garment.imageUrl,
        created_at: now, created_by: data.createdBy, updated_at: null, updated_by: null,
        deleted_at: null, deleted_by: null,
      })))
    }
    let photoTags = data.garments.map(garment => garment.tag)
    let failed: string[] = []
    try {
      const photos = await deps.photos.read()
      const photographed = new Set(photos.filter(row => row.photo_type === 'REGISTRATION' && !row.deleted_at).map(row => row.laundry_item_id))
      const missingPhotos = data.garments.filter(garment => newTags.has(garment.tag) || !photographed.has(garment.tag))
      photoTags = missingPhotos.map(garment => garment.tag)
      if (missingPhotos.length > 0) {
        await deps.photos.batchAppend(missingPhotos.map(garment => ({
          id: deps.generateId(), laundry_item_id: garment.tag, order_id: null,
          photo_type: 'REGISTRATION', image_url: garment.imageUrl, notes: null,
          created_at: now, created_by: data.createdBy, updated_at: null, updated_by: null,
          deleted_at: null, deleted_by: null,
        })))
      }
    } catch {
      failed = photoTags
    }
    let aiTriggered = false
    if (newGarments.some(garment => garment.itemId === null)) {
      try {
        aiTriggered = await deps.triggerClassification(staffId)
      } catch {
        console.warn('laundry_item_classification: trigger failed')
      }
    }
    return { registered: tags.new, alreadyRegistered: tags.registered, failed, aiTriggered }
  }
}
