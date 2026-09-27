# fix/sidebar-safe-area

- `NavSidebar.vue` header row adds `env(safe-area-inset-top)` like `AppHeader`, so Menu + close clear the iPhone status bar.
- Not done on purpose: the white band under `BottomNavBar` on iPhone; cause unproven (likely `100dvh` in standalone). Web research running; needs an on-device measurement before any change.
