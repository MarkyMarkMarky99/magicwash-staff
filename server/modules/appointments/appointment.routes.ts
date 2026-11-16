import { appointmentApiContract } from '../../../contracts/appointments/appointment-api.schema.js'
import { bangkokToday, normalizeSheetDate, normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { bodyWithSessionActor } from '../../shared/http/session-actor.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { AppointmentService } from './appointment.service.js'

/** Actor-specific policy belongs here: generic CRUD services receive no request actor. */
export function createAppointmentRoutes(service: AppointmentService, now: () => Date = () => new Date()) {
  const routes = createCrudRoutes(service, appointmentApiContract, { create: ['createdBy'], update: ['updatedBy'] })
  return {
    collection: new ApiHandler({
      GET: (req) => routes.collection.handleRequest(req),
      POST: (req) => {
        if (req.staff?.staffId.trim().toUpperCase() === 'AI') {
          const data = parseOrThrow(appointmentApiContract.request.create, bodyWithSessionActor(req, 'createdBy'))
          const clock = now()
          const date = validateDateWindow(data.appointmentDate, clock, 0, 13)
          if (date.getUTCDay() === 2) throw ApiError.validation('AI cannot create appointments on Tuesday (Asia/Bangkok)')
          const startTime = data.timeSlot.split('-')[0]
          if (data.appointmentDate === bangkokToday(clock)
            && startTime <= normalizeSheetTimestamp(clock.toISOString()).slice(11, 16)) {
            throw ApiError.validation('AI cannot create an appointment in a time slot that has already started today (Asia/Bangkok)')
          }
        }
        return routes.collection.handleRequest(req)
      },
    }),
    item: new ApiHandler({
      GET: (req) => routes.item!.handleRequest(req),
      PATCH: async (req) => {
        if (req.staff?.staffId.trim().toUpperCase() === 'AI') {
          const data = parseOrThrow(appointmentApiContract.request.update, bodyWithSessionActor(req, 'updatedBy'))
          if (data.status !== 'CANCELLED' && data.appointmentDate !== undefined) {
            const existing = await service.getById(req.params.id)
            if (data.appointmentDate !== normalizeSheetDate(existing.appointmentDate)) {
              const date = validateDateWindow(data.appointmentDate, now(), 1, 14)
              if (date.getUTCDay() === 2) throw ApiError.validation('AI cannot move appointments to Tuesday: the shop is closed (Asia/Bangkok)')
            }
          }
        }
        return routes.item!.handleRequest(req)
      },
    }),
  }
}

function validateDateWindow(value: string, now: Date, firstDay: number, lastDay: number): Date {
  const today = bangkokToday(now)
  const midnight = new Date(`${today}T00:00:00Z`).getTime()
  const first = new Date(midnight + firstDay * 86_400_000).toISOString().slice(0, 10)
  const last = new Date(midnight + lastDay * 86_400_000).toISOString().slice(0, 10)
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw ApiError.validation('AI appointment date must be a valid calendar date (YYYY-MM-DD)')
  }
  if (value < first || value > last) {
    throw ApiError.validation(`AI appointment date must be between ${first} and ${last} inclusive (Asia/Bangkok)`)
  }
  return date
}
