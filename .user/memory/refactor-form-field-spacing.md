# refactor/form-field-spacing

- Cut from `feat/customer-update`; merge that branch first, then this one.
- Rule lives in `docs/design/patterns/forms.md` "Vertical spacing"; 21 forms + FormTextarea/FormToggleInput/FormSwitch changed.
- Before/after screenshots (owner's Chrome, 2026-10-22): `.user/form-spacing/compare.html` (untracked, not committed).
- Not done: real-device phone check; owner reviewed screenshots only.
- Spotted, not fixed: price-list dark price panel hides the `FormPicker` label "บริการ *" (dark text on dark), leaving a blank gap.
