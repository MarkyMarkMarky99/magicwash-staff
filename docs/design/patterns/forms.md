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
- `FormToggleInput` for an optional text field that stays hidden until its switch is on
- `FormLabel`

Create feature-specific controls only for specialized interactions.

## Vertical spacing

The rule covers spacing between fields; display blocks (cards, panels, lists, heading+caption pairs) keep their own internal spacing.

Shared field component roots have no outer margin or outer padding. Keep the 6px space between
labels and controls inside the component, and preserve padding inside visible control boxes.

Containers own sibling spacing: use `flex flex-col gap-4` (16px) for fields and any notices,
headings, standalone helper/error paragraphs, or custom rows mixed into the field stack. Use
`flex flex-col gap-6` (24px) for a stack of sections, where each section has its own heading and
groups fields; fields inside each section still use the 16px stack. Multi-column field rows use
`grid gap-4` (16px on both axes).

Group a helper or error message tied to one field with that field in a `flex flex-col gap-1.5`
wrapper (6px). Do not use negative margins, per-field margin classes, or deep tag/child-class
selectors to space children. Outer page and overlay body padding belongs to the shell.

## Form Boundary

Keep the form in `<Entity>FormPage.vue` when one page owns it or create/edit can share the same page.

Extract `<Entity>Form.vue` when the same form body is reused by multiple flows.

Reusable form components own:

- field state and derived state
- validation and payload preparation

Pages own:

- loading and validating route context from query ids through `src/data/`
- store/service calls
- API errors
- navigation

Reusable forms must not call APIs or stores directly.

## State

- Keep editable state local with `ref` / `reactive`.
- Use `computed` for derived state.
- Do not mutate store/API objects directly.
- Map existing data into form state with `fillForm()` or `initializeForm()`.
- Form pages are never cached. Add each form page's component name to the `KeepAlive` `exclude`
  list in `src/App.vue`; uncached pages use `onMounted`, not `onActivated` or `onDeactivated`.

## Navigation

Cross-feature hosts open routed forms with `router.push` and the shared location builders in
`src/shared/navigation/form-routes.ts`. Query ids are the durable context boundary, so routed form
pages can load after refresh or from a deep link without handoff stores.

Cancel and X controls call `useCloseRoute(fallback)`. It returns to an in-app origin with
`router.back()` and replaces a fresh deep link with the feature fallback. A form's successful-save
destination is an explicit policy owned by its feature and does not use the shared close helper.

## Validation & Payload

- Maintain one validity state: `isValid` or `canSubmit`.
- Disable submission when invalid or submitting.
- Build the write payload in one place: `createPayload()` or computed `data`.
- Normalize boundary values, such as `"" → null` and `numeric string → number`.

## Placement

- Routed form: `src/features/<feature>/pages/<Entity>FormPage.vue`
- Reusable form body: `src/features/<feature>/components/<Entity>Form.vue`
