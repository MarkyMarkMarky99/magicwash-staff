import { laundryTagPrintRequestSchema } from '../../../contracts/laundry-tag-prints/laundry-tag-print.schema.js'
import { API_ERROR_CODES } from '../../../contracts/shared/api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { errorBody, ok } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { requestLaundryTagPrint } from './laundry-tag-print-client.js'

export const laundryTagPrintRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    POST: async (req) => {
      const request = parseOrThrow(laundryTagPrintRequestSchema, req.body)
      const result = await requestLaundryTagPrint(request)

      console.info(JSON.stringify({
        event: 'laundry_tag_print_request_outcome',
        customerIndex: request.customerIndex,
        totalCount: request.totalCount,
        outcome: result.outcome,
      }))

      if (result.outcome === 'accepted') return ok(result.data)

      if (result.outcome === 'configuration_error') {
        return {
          status: 500,
          body: errorBody(
            API_ERROR_CODES.INTERNAL_ERROR,
            `Tag printing is not configured. Missing: ${result.missing.join(', ')}`,
          ),
        }
      }

      return {
        status: 502,
        body: errorBody(
          API_ERROR_CODES.INTERNAL_ERROR,
          'The tags could not be sent to the printer',
        ),
      }
    },
  }),
}
