---
last_audited: 2026-08-26
audit_sources:
  - src/features/customers
  - src/features/customers/pages
  - src/features/customers/services
  - server/modules/customers
  - server/modules/invoices
  - server/modules/price-list
  - server/sheets/Customers
  - server/sheets/Invoices
  - server/sheets/PriceList
  - contracts
---

# Naming Conventions

Follow the naming style of the layer being changed.

## Folders

Application feature/module folders use kebab-case:

- `customers`
- `price-list`
- `customer-packages`

Physical Sheet folders use the Sheet name:

- `Customers`
- `PriceList`
- `InvoiceItems`

Do not rename physical Sheet concepts only to normalize casing.

## Vue Files

Vue components and pages use PascalCase.

Pages end with `Page.vue`.

Examples:

- `CustomerListPage.vue`
- `CustomerOrderHistoryPage.vue`
- `AppointmentForm.vue`

## TypeScript Files

Use kebab-case with a responsibility suffix where applicable.

Examples:

- `customer.service.ts`
- `waiting-pickup.service.ts`
- `invoice.module.ts`
- `invoice.service.ts`
- `customer-api.schema.ts`

Feature route entry files use:

- `routes.ts`

## Sheet Files

Files representing a physical Sheet preserve the Sheet name.

Pattern:

<SheetName>.db-contract.ts
<SheetName>.repository.ts

Examples:

- `Customers.db-contract.ts`
- `Customers.repository.ts`
- `Invoices.db-contract.ts`
- `Invoices.repository.ts`

## Code Symbols

Use:

- `camelCase` for variables, functions, fields, and exported instances
- `PascalCase` for classes and TypeScript types
- `UPPER_SNAKE_CASE` for true constants

Examples:

- `customerApiContract`
- `customersDbContract`
- `getCustomersRepository`
- `InvoiceService`
- `MAX_CUSTOMERS_PER_PAGE`

## API vs DB Fields

API/application fields use camelCase:

- `customerId`
- `invoiceNumber`
- `createdAt`

DB fields use the exact physical Sheet column name:

- `CustomerID`
- `invoice_number`
- `created_at`

Do not change DB field casing during persistence modeling.

Mapping between the two belongs in the backend module/service.

## References

- `docs/conventions/contracts.md`
- `docs/architecture/frontend/feature-structure.md`
- `docs/architecture/backend/module-structure.md`
