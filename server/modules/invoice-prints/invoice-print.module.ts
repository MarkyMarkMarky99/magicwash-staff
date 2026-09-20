import { invoicePrintRequestSchema } from '../../../contracts/invoices/invoice-api.schema.js'
import { API_ERROR_CODES } from '../../../contracts/shared/api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { errorBody, ok } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { requestInvoicePrint } from './invoice-print-client.js'

export const invoicePrintRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    POST: async (req) => {
      const request = parseOrThrow(invoicePrintRequestSchema, req.body)
      const result = await requestInvoicePrint(request)

      if (result.outcome === 'accepted') return ok(result.data)

      if (result.outcome === 'configuration_error') {
        return {
          status: 500,
          body: errorBody(
            API_ERROR_CODES.INTERNAL_ERROR,
            `Invoice printing is not configured. Missing: ${result.missing.join(', ')}`,
          ),
        }
      }

      return {
        status: 502,
        body: errorBody(
          API_ERROR_CODES.INTERNAL_ERROR,
          'The invoice could not be sent to the printer',
        ),
      }
    },
  }),
}
