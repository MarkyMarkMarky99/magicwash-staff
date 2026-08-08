import assert from 'node:assert/strict'

const relevantEnvironmentKeys = [
  'ORDERS_SPREADSHEET_ID',
  'CUSTOMERS_SPREADSHEET_ID',
  'APPOINTMENTS_SPREADSHEET_ID',
  'APPSCRIPT_URL',
]

const modulePaths = [
  '../../../../server/modules/orders/order.module.js',
  '../../../../server/modules/customers/customer.module.js',
  '../../../../server/modules/appointments/appointment.module.js',
  '../../../../server/modules/invoices/invoice.module.js',
  '../../../../server/modules/customer-packages/customer-package-view.module.js',
]

async function main(): Promise<void> {
  const previousValues = new Map<string, string | undefined>()
  for (const key of relevantEnvironmentKeys) {
    previousValues.set(key, process.env[key])
    delete process.env[key]
  }

  try {
    await assert.doesNotReject(async () => {
      for (const modulePath of modulePaths) {
        await import(modulePath)
      }
    })
  } finally {
    for (const key of relevantEnvironmentKeys) {
      const previousValue = previousValues.get(key)
      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
  }

  console.log('5 module laziness checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
