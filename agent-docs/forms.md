## Architecture Rules

- Form components live in `src/components/forms/*.vue`.
- Shared form UI lives in `src/components/forms/shared/`.
- `src/components/forms/*.vue` must be input-only.
- Form body components should render only fields/body content.
- Form body components should not import `FormLayout` or `FormOverlayLayout`.
- Do not add shared/internal form components directly under `src/components/forms/`.
- Put shared/internal form components under `src/components/forms/shared/`.

## Data Contract

- Every form component must expose `data`.
- Every form component should expose `isValid`.
- Use `defineExpose({ data, isValid })`.
- Parent reads form payload through a template ref.
- `data` must be ready for parent submit/backend usage.

## Submit Rules

- Do not call backend, stores, router submit actions, or APIs inside form components.
- Do not keep submit/loading/saved/error handling inside form components.
- Parent owns submit actions, backend calls, redirects, loading, and errors.

## Form Layout

- Use `src/layouts/FormOverlayLayout.vue` for form pages or overlays.
- `FormOverlayLayout` owns header, body slot, footer, and submit button design.
- `FormOverlayLayout` emits `submit`; parent handles the action.
- `FormOverlayLayout` receives `canSubmit` from `formRef.isValid`.
- `FormOverlayLayout` receives labels/icons through props.

```vue
<FormOverlayLayout
  title="Create New Order"
  submit-label="Create Order"
  submit-icon="add_circle"
  :can-submit="formRef?.isValid"
  @submit="handleSubmit"
>
  <CreateOrderForm ref="formRef" />
</FormOverlayLayout>
```

## Dynamic Dev Route

- Dynamic dev form route is `#/forms/:formName`.
- Dynamic form route loads files from `src/components/forms/*.vue`.
- Dynamic form route wraps forms with `FormOverlayLayout`.

## Current Forms

- `CreateOrderForm.vue` owns only order input fields and exposes order `data`.
- `NewBookingForm.vue` wraps shared `AppointmentScheduleForm.vue`.
- `RescheduleAppointmentForm.vue` wraps shared `AppointmentScheduleForm.vue`.
