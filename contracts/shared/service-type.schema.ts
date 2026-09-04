import { z } from 'zod'

export const serviceTypeSchema = z.enum(['WSIR', 'IRON', 'DRCL', 'WASH'])
