# Staff registration and management

A Google account that is not on the `Staff` allow-list registers itself, then waits for an admin to approve it. Admins approve and maintain staff from a list. There is no self-edit after registration: only admins change a staff row.

Backend contract: `contracts/staff/staff-api.schema.ts`. Routes: `GET /api/staff/me`, `POST /api/staff`, public `GET /api/staff`, and admin-only `GET /api/staff/:staffId`, `PATCH /api/staff/:staffId`. The public list returns every row in the existing response, including pending/inactive rows and all columns; a supplied invalid token still returns 401. The app prefetches it at load to map StaffIds to names. All staff GETs bypass the response cache (`/api/staff` is in `NEVER_CACHE`), so an approval is visible on the next read.

## Login states

`auth.store.ts` drives them; `LoginPage.vue` renders them. See `docs/architecture/frontend/project-structure.md` for the sequence.

- `GET /api/auth/me` succeeds: `signedIn`; the response includes `staffId`. The login reader reads A:I. Frontend writes record the signed-in StaffId as actor, or `unknown` when signed out; `?by=` is ignored.
- 403 then `GET /api/staff/me` returns 404: `unregistered`. Signing in navigates (replace) to `/staff/register`. Opening `/login` while still unregistered shows a register button and a logout button instead of redirecting, so Back from the form cannot loop.
- 403 then a row with `role = null` or `active = false`: `pending`. The login page shows "ลงทะเบียนแล้ว รอผู้ดูแลอนุมัติ" and a logout button. A pending user is never `signedIn`.
- 403 then a row that is active with a role: contradictory, treated as an error and signed out.
- 401 or any other error: error on the login page and sign-out, as before.

## Routes

- `/staff` (`staff-list`): admin list.
- `/staff/register` (`staff-register`): self-registration, same `StaffFormPage.vue` as edit.
- `/staff/:staffId/edit` (`staff-edit`): admin edit; `meta.parent` is `staff-list`.

Route names and builders live in `src/shared/navigation/form-routes.ts`.

## Form

`StaffFormPage.vue` is one page for both modes, chosen by the presence of `staffId`. It is excluded from `KeepAlive` by name.

- Email is a read-only display in both modes: the signed-in Google email on create, the row's email on edit.
- Name, phone, and address are editable in both modes. Phone is a `tel` input holding text, so a leading zero survives.
- Staff ID is shown read-only on edit only.
- Role, position, start date, and active are shown on edit only. Role starts unselected for a pending row, and an unset role is never sent.
- Create posts name, phone, and address as validated by `registerStaffBodySchema`; the server takes the email from the Google token. On success the store enters `pending` and the page replaces itself with `/login`.
- Edit sends only changed fields to `PATCH`. Submit stays disabled until something changed and the payload passes `updateStaffBodySchema`.
- An admin editing their own row cannot change role or active (the backend answers 409), so those controls are disabled for that row.
- A create 409 means the account is already registered: the store re-checks the session, which lands on the pending state.

## Access

Only an admin (`status = signedIn` and `staff.role = admin`) sees the nav entry, the list, and the edit form. The list and edit pages replace themselves with `/` for anyone else once the session check settles; the backend independently answers 403 for admin-only detail and edit requests.

## List

`StaffListPage.vue` follows the list page pattern. It fetches the whole collection once from `GET /api/staff` (no paging, no cap) through `src/data/staff/staff.store.ts` and re-reads it every time the page is activated. The `status` query (`pending`, `active`, `inactive`; absent means all) selects the tab and is replace-only. Rows with no role sort first and carry a warning background and a "รออนุมัติ" badge; an approved but disabled row shows "ปิดใช้งาน". Tapping a pending row opens the edit form, where the admin approves it; tapping any other row opens the staff profile (`docs/features/staff/profile.md`).
