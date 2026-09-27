# feat/push-drawer

- `App.vue` renders `NavSidebar` behind the `.app-column` shell; open state is `?menu=1` via `src/shared/composables/use-nav-drawer.ts` (push to open, Back closes, menu links replace the entry).
- Shell slides `translate-x-[min(78%,320px)]`, radius 36px, transition on `translate` (Tailwind v4 translate utilities use the `translate` property, not `transform`).
- Drawer is 40px wider than the shift so rounded corners reveal the menu, not the outer layer.
- Drawer has no close X by user choice: tap the shifted page, the menu button, Back or Esc.
- Codex reported 2 unrelated unit-test failures (CloseButton, appointment store); not verified against main.
- Next: push for an iPhone home-screen Preview check, then merge.
