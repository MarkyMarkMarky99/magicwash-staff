---
last_audited: 2026-08-26
audit_sources:
  - src/shared/layouts/FormOverlay.vue
  - src/features/appointments/components/AppointmentForm.vue
  - src/features/price-list/pages/PriceListFormPage.vue
---

# Form Pattern

## Shell

Use `FormOverlay` for routed overlay forms; do not create another `<form>` inside it.

Prefer shared controls:

- `FormInput`
- `FormTextarea`
- `FormOptionGrid`
- `FormSwitch`
- `FormLabel`

Create feature-specific controls only for specialized interactions.

## Form Boundary

Keep the form in `<Entity>FormPage.vue` when one page owns it or create/edit can share the same page.

Extract `<Entity>Form.vue` when the same form body is reused by multiple flows.

Reusable form components own:

- field state and derived state
- validation and payload preparation

Pages own:

- loading
- store/service calls
- API errors
- navigation

Reusable forms must not call APIs or stores directly.

## State

- Keep editable state local with `ref` / `reactive`.
- Use `computed` for derived state.
- Do not mutate store/API objects directly.
- Map existing data into form state with `fillForm()` or `initializeForm()`.

## Validation & Payload

- Maintain one validity state: `isValid` or `canSubmit`.
- Disable submission when invalid or submitting.
- Build the write payload in one place: `createPayload()` or computed `data`.
- Normalize boundary values, such as `"" → null` and `numeric string → number`.

## Placement

- Routed form: `src/features/<feature>/pages/<Entity>FormPage.vue`
- Reusable form body: `src/features/<feature>/components/<Entity>Form.vue`
