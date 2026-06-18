```ts
// Type roles:
// TRepoRow = *-db.schema.ts stored row after repository mapper.toApi()
//            full database contract, but keys are API/domain field names.
// TListResponse / TDetailResponse
//            = *-api.schema.ts frontend response contracts.
// create/update use detailResponseSchema unless a module needs a custom service.

// Repository dependency reference:
repository.read(query?: RepositoryReadQuery<TReadWhere>) -> Promise<Array<Partial<TRepoRow>>>
repository.create(data: TCreate) -> Promise<TRepoRow>
repository.update(id: string, data: TUpdate) -> Promise<TRepoRow>
repository.delete(id: string) -> future

// ApiHandler responsibility:
// HTTP request -> req.query / req.params / req.body

type ServiceListResult<TListResponse> = {
  items: TListResponse[]
  pagination: {
    page: number
    perPage: number
  }
}

interface BaseCrudServiceOptions<
  TRepoRow,
  TListQuery,
  TReadWhere,
  TCreate,
  TUpdate,
  TListResponse,
  TDetailResponse,
> {
  repository: BaseRepository<TRepoRow, TReadWhere, TCreate, string, TUpdate>

  listQuerySchema: ZodSchema<TListQuery>
  createSchema: ZodSchema<TCreate>
  updateSchema: ZodSchema<TUpdate>
  listResponseSchema: ZodSchema<TListResponse>
  detailResponseSchema: ZodSchema<TDetailResponse>

  toReadQuery(query: TListQuery) -> RepositoryReadQuery<TReadWhere>

  // default projection:
  // pick responseSchema.shape keys from TRepoRow -> responseSchema.parse(projected)
}

class BaseCrudService<
  TRepoRow,
  TListQuery,
  TReadWhere,
  TCreate,
  TUpdate,
  TListResponse,
  TDetailResponse,
> {
  list(query: unknown) -> Promise<ServiceListResult<TListResponse>>
  // validate req.query -> toReadQuery -> repo.read -> project/validate listResponseSchema[]
  // pagination comes from validated query page/perPage; service does not slice; total is out of scope

  getById(id: string) -> Promise<TDetailResponse>
  // validate id -> repo.read({ id }) -> missing throw 404 -> duplicate throw 409 -> project/validate detailResponseSchema

  create(payload: unknown) -> Promise<TDetailResponse>
  // validate req.body -> repo.create(data) -> project/validate detailResponseSchema

  update(id: string, payload: unknown) -> Promise<TDetailResponse>
  // validate id + req.body -> repo.update(id, data) -> project/validate detailResponseSchema
}

```

ไม่รู้จัก database ไม่รู้ว่าเป็น appscript, google sheet, gviz, sql, nosql.
ไม่รู้จัก primary key field/column ของ module; ส่ง semantic id ให้ repository จัดการ.

In Scope:
  รับ req.query / req.params.id / req.body จาก ApiHandler
  -> validate เป็น API contract
  -> แปลง API query เป็น RepositoryReadQuery
  -> เรียก repository
  -> project ด้วย responseSchema.shape
  -> validate/return frontend contract

Not In Scope:
- map DB fields
- resolve primary key field/column
- read HTTP request directly
- build GViz/SQL query string
- No mapper/transformer
- Do not implement specific module business
= ไม่ทำ projection แบบ list/detail ซ่อนอยู่ใน base

Test Edge Cases:

list()
- query ว่างต้อง parse default จาก listQuerySchema ได้
- query invalid ต้อง throw validation error
- toReadQuery() ต้องรับ validated query เท่านั้น
- repo.read() return empty array ต้องได้ items: []
- response ต้อง project เฉพาะ fields ใน listResponseSchema.shape
- repo คืน row ที่มี detail-only/audit fields ต้องไม่หลุดใน list projection
- projected row ที่ไม่ผ่าน listResponseSchema ต้อง throw
- pagination ต้องใช้ page/perPage จาก validated query
- pagination response ต้องไม่มี total
- service ต้องไม่ slice items เอง
- repo reject ต้อง propagate

getById()
- id ว่าง/whitespace ต้อง throw 400 ก่อนเรียก repo
- id valid ต้องเรียก repo.read({ id })
- repo.read() return empty array ต้อง throw 404
- repo.read() return หลาย rows ต้อง throw 409
- response ต้อง project เฉพาะ fields ใน detailResponseSchema.shape
- projected row ที่ไม่ผ่าน detailResponseSchema ต้อง throw
- missing required field ต้องอยู่ใน validation details
- service ต้องไม่สร้าง PK field เอง

create()
- payload invalid ต้อง throw validation error
- payload valid ต้องเรียก repo.create(data) ด้วย parsed data
- repo response ต้อง project ตาม detailResponseSchema.shape
- projected response ที่ไม่ผ่าน detailResponseSchema ต้อง throw
- missing required field ต้องอยู่ใน validation details
- service ต้องไม่ส่ง raw unknown payload เข้า repo

update()
- id ว่าง/whitespace ต้อง throw 400 ก่อนเรียก repo
- payload invalid ต้อง throw validation error
- payload มีแค่ updatedBy ต้อง fail ที่ updateSchema refine
- payload valid ต้องเรียก repo.update(id, data) ด้วย parsed data
- repo response ต้อง project ตาม detailResponseSchema.shape
- projected response ที่ไม่ผ่าน detailResponseSchema ต้อง throw
- service ต้องไม่สร้าง update filter เอง

shared()
- service ต้องไม่อ่าน HTTP request เอง
- service ต้องไม่ map DB fields เอง
- service ต้องไม่เรียก mapper/transformer เอง
- service ต้องไม่ build GViz/SQL query string เอง
- projection ต้องไม่ mutate object เดิมจาก repo
