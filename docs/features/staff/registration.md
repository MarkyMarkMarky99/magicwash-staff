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

- `/staff` (`staff-list`): staff list for every signed-in staff member.
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

Every signed-in staff member (`status = signedIn`, any role) sees the nav entry, the list, and every staff profile. Only an admin (`status = signedIn` and `staff.role = admin`) sees the Edit link and the edit form, including for their own row. The list page replaces itself with `/` for anyone not signed in once the session check settles; the edit page does so for non-admins. A pending row opens the edit form for admins and the profile for others; the backend independently answers 403 for admin-only detail and edit requests.

## List

`StaffListPage.vue` is the daily staff ranking and follows the list page pattern. A `DateTabs` strip picks the Bangkok day (today first). It fetches the whole staff collection from `GET /api/staff` (no paging, no cap) through `src/data/staff/staff.store.ts` and the day's rows from `GET /api/work-transactions?from=day&to=day`, and re-reads both every time the page is activated; changing the day re-reads the scores. There are no status tabs: every row is listed. `rankDay` in `src/features/staff/utils/staff-performance.ts` scores each member with the profile's day summary (points are the profile's standard minutes, labelled pts), sorts by points, gives tied points the same rank, and keeps members without points at the end in name order, unranked. Ranks 1–3 show a gold, silver or bronze medal icon; later ranks show the number. Each row shows points, a bar against the day's top score, and jobs. All text on the page is English; the signed-in member's row is tinted and marked "You". Pending rows carry a "Pending" badge and a warning background, and disabled rows "Disabled"; approved active rows have no badge. For admins, tapping a pending row opens the edit form, where they approve it; tapping any other row opens the staff profile. Non-admins open the staff profile for every row (`docs/features/staff/profile.md`).
