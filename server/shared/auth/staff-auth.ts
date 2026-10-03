import type { VercelRequest } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ApiError } from '../http/api-error.js'
import { getStaffList, type StaffMember } from './staff-list.js'

const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

export type StaffAuthenticator = (req: VercelRequest) => Promise<StaffMember>

export interface StaffIdentity {
  email: string
  staff?: StaffMember
}

export type StaffIdentityAuthenticator = (req: VercelRequest) => Promise<StaffIdentity>

export async function verifyStaffToken(req: VercelRequest): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId?.trim()) throw new Error('FIREBASE_PROJECT_ID is not set')
  const authorization = req.headers.authorization
  const match = typeof authorization === 'string' ? /^Bearer (\S+)$/.exec(authorization) : null
  if (!match) throw ApiError.unauthorized()

  let email: string
  try {
    const { payload } = await jwtVerify(match[1]!, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    })
    if (typeof payload.email !== 'string' || !payload.email.trim() || payload.email_verified !== true) {
      throw ApiError.unauthorized()
    }
    email = payload.email.trim().toLowerCase()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw ApiError.unauthorized()
  }

  return email
}

export const authenticateStaffIdentity: StaffIdentityAuthenticator = async (req) => {
  const email = await verifyStaffToken(req)
  return { email, staff: (await getStaffList()).get(email) }
}

export const authenticateStaff: StaffAuthenticator = async (req) => {
  const { staff } = await authenticateStaffIdentity(req)
  if (!staff) throw ApiError.forbidden()
  return staff
}
