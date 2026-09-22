import {
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
} from './sheets-api.client.js'
import { DuplicateRowKeyError } from './sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from './sheet-row-identity.js'

export interface SheetWriteFailure {
  certainty: 'rejected' | 'unknown'
  message: string
}

export function classifySheetWriteFailure(error: unknown): SheetWriteFailure {
  if (error instanceof WriteRejectedError || error instanceof DuplicateRowKeyError) {
    return { certainty: 'rejected', message: error.message }
  }
  if (error instanceof WriteCommittedUnreadableError) {
    return {
      certainty: 'unknown',
      message: `Write committed but the persisted row could not be read back; do not retry: ${error.message}`,
    }
  }
  if (error instanceof WriteTransportError || error instanceof WriteRowIdentityMismatchError) {
    return { certainty: 'unknown', message: `Write outcome unknown: ${error.message}` }
  }
  return { certainty: 'unknown', message: error instanceof Error ? error.message : String(error) }
}
