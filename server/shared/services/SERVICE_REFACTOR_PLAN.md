```ts
// Type roles:
// TApiRow = row after repository mapper.toApi()
//           API/domain field names; do not infer this from raw *-db.schema.ts.
//           DB shape lives only in storage impl, e.g. GSheetRepository<TApiRow, TDbRow>.
// TListResponse / TDetailResponse
//            = *-api.schema.ts frontend response contracts.
// create/update use detailResponseSchema unless a module needs a custom service.

// Repository dependency reference:
repository.read(query?: RepositoryReadQuery<TReadWhere>) -> Promise<Array<Partial<TApiRow>>>
repository.create(data: TCreate) -> Promise<TApiRow>
repository.update(id: string, data: TUpdate) -> Promise<TApiRow>
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
// Use apiPageMetaSchema / okPaged(); old apiPaginationMetaSchema / okPaginated()
// remains only for transition routes that still return total/totalPages.

interface BaseCrudServiceOptions<
  TApiRow,
  TListQuery,
  TReadWhere,
  TCreate,
  TUpdate,
  TListResponse,
  TDetailResponse,
> {
  repository: BaseRepository<TApiRow, TReadWhere, TCreate, string, TUpdate>

  listQuerySchema: ZodSchema<TListQuery>
  createSchema: ZodSchema<TCreate>
  updateSchema: ZodSchema<TUpdate>
  listResponseSchema: ZodSchema<TListResponse>
  detailResponseSchema: ZodSchema<TDetailResponse>

  toReadQuery(query: TListQuery) -> RepositoryReadQuery<TReadWhere>

  // default projection:
  // pick responseSchema.shape keys from TApiRow -> projected response
  // read paths: project only; NO responseSchema.parse()/safeParse()
}

class BaseCrudService<
  TApiRow,
  TListQuery,
  TReadWhere,
  TCreate,
  TUpdate,
  TListResponse,
  TDetailResponse,
> {
  list(query: unknown) -> Promise<ServiceListResult<TListResponse>>
  // validate req.query -> toReadQuery -> repo.read -> project listResponseSchema.shape only
  // pagination comes from validated query page/perPage; service does not slice; total is out of scope

  getById(id: string) -> Promise<TDetailResponse>
  // validate id -> repo.read({ id }) -> missing throw 404 -> duplicate throw 409 -> project detailResponseSchema.shape only

  create(payload: unknown) -> Promise<TDetailResponse>
  // validate req.body -> repo.create(data) -> project detailResponseSchema.shape

  update(id: string, payload: unknown) -> Promise<TDetailResponse>
  // validate id + req.body -> repo.read({ id }) existence guard -> repo.update(id, data) -> project detailResponseSchema.shape
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
  -> return frontend contract

Not In Scope:
- map DB fields
- resolve primary key field/column
- read HTTP request directly
- build GViz/SQL query string
- No mapper/transformer
- No module-specific response hooks
- No fill-null/buildPayload in service
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
- read response ต้องไม่ runtime-validate ด้วย listResponseSchema.parse()/safeParse()
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
- read response ต้องไม่ runtime-validate ด้วย detailResponseSchema.parse()/safeParse()
- service ต้องไม่สร้าง PK field เอง

create()
- payload invalid ต้อง throw validation error
- payload valid ต้องเรียก repo.create(data) ด้วย parsed data
- service ต้องไม่ fill null หรือ build append payload
- repo response ต้อง project ตาม detailResponseSchema.shape
- response ต้อง strip fields นอก detailResponseSchema.shape
- service ต้องไม่ส่ง raw unknown payload เข้า repo

update()
- id ว่าง/whitespace ต้อง throw 400 ก่อนเรียก repo
- payload invalid ต้อง throw validation error
- payload มีแค่ updatedBy ต้อง fail ที่ updateSchema refine
- payload valid ต้องเรียก repo.read({ id }) เพื่อตรวจ existence ก่อน update
- repo.read({ id }) return empty array ต้อง throw 404
- repo.read({ id }) return หลาย rows ต้อง throw 409
- หลัง existence guard ต้องเรียก repo.update(id, data) ด้วย parsed data
- repo response ต้อง project ตาม detailResponseSchema.shape
- response ต้อง strip fields นอก detailResponseSchema.shape
- service ต้องไม่สร้าง update filter เอง

shared()
- service ต้องไม่อ่าน HTTP request เอง
- service ต้องไม่ map DB fields เอง
- service ต้องไม่เรียก mapper/transformer เอง
- service ต้องไม่ build GViz/SQL query string เอง
- service ต้องไม่มี module-specific after hooks
- projection ต้องไม่ mutate object เดิมจาก repo
