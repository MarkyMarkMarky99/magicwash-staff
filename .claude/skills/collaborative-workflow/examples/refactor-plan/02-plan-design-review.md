# Plan Design & Review

**Status:** Approved

## Considered Directions

- **Option A:** สร้าง fluent `QueryBuilder` class
  - Pros: contract ชัด, test ง่าย, ลด duplication ได้มาก
  - Cons: เพิ่ม abstraction ใหม่
- **Option B:** แยก helper functions สำหรับ filter/sort/pagination
  - Pros: implementation เล็กกว่า
  - Cons: state/reset และ chaining ไม่ชัด, กระจาย logic ง่ายกว่า

**Recommended / Agreed Direction:** Option A, fluent `QueryBuilder` class

## High-Level Steps

1. สร้าง `QueryBuilder` ใน `query-builder.ts`
2. ย้าย filter/sort/pagination construction เข้า `QueryBuilder`
3. refactor `customer.service.ts` ให้ใช้ `QueryBuilder`
4. เพิ่ม unit tests และ service coverage ที่เกี่ยวข้อง

## Contracts

```ts
type SortDirection = 'asc' | 'desc'

type Operator = 'eq' | 'contains'

interface QueryBuilderContract {
  where(field: string, operator: Operator, value: unknown): this
  orderBy(field: string, direction?: SortDirection): this
  paginate(page: number, perPage: number): this
  reset(): this
  build(): RepositoryReadQuery<CustomerWhere>
}
```

## Functional Flow

```text
customerService.list(query)
-> new QueryBuilder()
-> where/orderBy/paginate from validated query params
-> build()
-> repository.read(repositoryQuery)
-> response projection
```

## Data Flow

```text
API list query params
-> service-level normalized options
-> QueryBuilder internal filter/sort/pagination state
-> RepositoryReadQuery<CustomerWhere>
-> repository.read()
```

## Files / Modules To Change

- `server/modules/customers/query-builder.ts`
- `server/modules/customers/customer.service.ts`
- `server/modules/customers/query-builder.test.ts`
- customer service tests, if current assertions need updating

## Edge Cases

> Re-check this list every time the plan changes.

**filter / where**

- no filters returns query without `where`
- unsupported operator is rejected
- empty string filter value is ignored or rejected according to existing service behavior
- multiple `where()` calls combine with AND

**sort / orderBy**

- no sort keeps repository default order
- multiple `orderBy()` calls use the latest value
- invalid direction is rejected before repository call

**pagination**

- valid page/perPage maps into repository pagination
- `page = 0` is rejected
- `perPage` above max is rejected or clamped according to current API schema

**state / reset**

- `reset()` clears filters, sort, and pagination
- query object returned from `build()` is not mutated by later builder calls

## Decisions & Rejected Alternatives

- **Decision:** Use a fluent class instead of plain helpers.
  - Reason: chaining and reset are required behaviors, and class state is easier to test directly.
- **Rejected:** Change repository query shape.
  - Reason: repository layer is out of scope.
