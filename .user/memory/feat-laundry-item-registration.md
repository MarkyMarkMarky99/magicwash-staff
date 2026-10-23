# feat/laundry-item-registration

- Cut from `feat/laundry-items-sheet` (its LaundryItems backend is not on main yet; merge that first or together).
- Plan: `docs/plans/laundry-item-registration.md`. This branch's scope (owner): register sheets + generic CRUD only, no flows or UI.
- Done: tabs `OrderGarments`, `LaundryItemPhotos` in the LaundryItems workbook (A..L each), registry JSONs on G Drive, `/api/order-garments` + `/api/laundry-item-photos` GET/POST/PATCH, server-generated ids, no DELETE, no keyword search.
- Gates passed: typecheck:api, 13 dry tests, live column parity. No live write tried; not deployed.
- Owner to fix: G Drive `LaundryItems.json` `image_url` description still says registration photos stay in LaundryPhotos.
- Next (needs owner go-ahead): registration endpoint + page, order scan flow, `status` writes from job tickets.
