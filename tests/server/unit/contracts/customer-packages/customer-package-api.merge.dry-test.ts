import * as customerPackageApi from '../../../../../contracts/customer-packages/customer-package-api.schema.js'

const requiredExports = [
  'customerPackageApiContract',
  'customerPackageStatusSchema',
  'packageTransactionSchema',
  'customerPackagePortalRowSchema',
  'customerPackageListResponseSchema',
  'customerPackageDetailResponseSchema',
  'customerPackageSortFieldSchema',
  'MAX_CUSTOMER_PACKAGES_PER_PAGE',
  'customerPackageListQuerySchema',
  'customerPackageServiceDaySchema',
  'customerPackageTimeSlotSchema',
  'createCustomerPackageRequestSchema',
  'createCustomerPackageSuccessSchema',
  'createCustomerPackageValidationErrorSchema',
  'createCustomerPackageCatalogReadFailedSchema',
  'createCustomerPackageOpeningTransactionFailedSchema',
  'createCustomerPackagePackageWriteFailedSchema',
  'createCustomerPackageResponseSchema',
  'packageTransactionTypeSchema',
  'packageCreditMovementTypeSchema',
  'packageWriteFailureCertaintySchema',
  'appendPackageTransactionRequestSchema',
  'appendPackageTransactionSuccessSchema',
  'appendPackageTransactionValidationErrorSchema',
  'appendPackageTransactionPackageNotFoundSchema',
  'appendPackageTransactionLookupFailedSchema',
  'appendPackageTransactionWriteFailedSchema',
  'appendPackageTransactionResponseSchema',
] as const

for (const exportName of requiredExports) {
  if (!(exportName in customerPackageApi)) {
    throw new Error(`Expected ${exportName} to be exported by customer-package-api.schema.ts`)
  }
}

if ('customerPackageViewApiContract' in customerPackageApi) {
  throw new Error('customerPackageViewApiContract must not remain exported')
}

const { customerPackageApiContract } = customerPackageApi

if ('request' in customerPackageApiContract) {
  throw new Error('customerPackageApiContract must not expose a request slot')
}

if (!customerPackageApiContract.query?.list) {
  throw new Error('customerPackageApiContract must expose query.list')
}

if (!customerPackageApiContract.response?.list) {
  throw new Error('customerPackageApiContract must expose response.list')
}

if (!customerPackageApiContract.response?.detail) {
  throw new Error('customerPackageApiContract must expose response.detail')
}

if (typeof customerPackageApi.packageTransactionTypeSchema.safeParse !== 'function') {
  throw new Error('packageTransactionTypeSchema must evaluate before view schemas import')
}

if (typeof customerPackageApi.packageCreditMovementTypeSchema.safeParse !== 'function') {
  throw new Error('packageCreditMovementTypeSchema must evaluate before view schemas import')
}
