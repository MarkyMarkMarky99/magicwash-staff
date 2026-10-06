# Colors

The palette is built from the brand's deep green and the logo (`src/assets/logo.png`): lime
`#a8cc30`, steel teal-blue `#24789c`. Every colour is a token in the `@theme` block of
`src/style.css`; that block is the only place a colour value is written.

## Rules

- Components use theme tokens only: `bg-primary`, `text-on-surface-variant`, `border-outline-variant`,
  with an opacity modifier when needed (`bg-primary/10`).
- Allowed without a token: `white`, `black`, `transparent`, `current`, and their opacity forms, for
  overlays, scrims, and camera UI.
- Not allowed in `src/`: hex, `rgb()`/`rgba()`/`hsl()` values, arbitrary colour classes
  (`bg-[#…]`), and Tailwind's built-in palette (`red-500`, `emerald-600`, `slate-100`, …). This
  includes scoped CSS and inline styles; scoped CSS reads `var(--color-…)`.
- Shadows follow the same rule: use a token colour with opacity, e.g.
  `shadow-[0_-4px_16px_color-mix(in_srgb,var(--color-on-surface)_12%,transparent)]`, or a Tailwind
  shadow utility.
- Focus indicators use `lime` (rings, outlines, focus borders, and the icon colour of dark round buttons).
- SVG presentation attributes (`fill`, `stroke`) cannot read `var()`; colour SVG with classes such as
  `fill-lime` / `stroke-on-surface`. Canvas reads the token with `getComputedStyle` and applies
  opacity through `globalAlpha`.
- The one literal exception: `GlassLens.vue` keeps `flood-color="rgb(128,128,128)"`, the neutral
  value of a displacement map. It is a filter input, not a design colour.
- A colour the palette lacks is added to `@theme` first, named by role, then used. Never add a
  one-off token for a single component.

## Palette roles

| Role | Tokens | Use |
|---|---|---|
| Brand | `primary`, `on-primary`, `primary-container`, `secondary` | Headers, primary actions, brand surfaces |
| Accent | `lime` (on dark brand surfaces), `secondary-container` / `on-secondary-container` (light lime tint on light surfaces) | Highlights, selected states, accent badges |
| Surfaces | `background`, `surface`, `surface-container-lowest` … `-highest`, `surface-variant` | Page and card backgrounds |
| Text and lines | `on-surface`, `on-surface-variant`, `outline`, `outline-variant` | Body text, secondary text, borders |
| Status | `error`, `warning`, `success`, `info`, each with `-container` and `on-…` | Status only; never decoration |
| Rank medals | `medal-gold`, `medal-silver`, `medal-bronze` | 1st–3rd place icons on rankings only |

## Retired colours

- Mint / aqua (`#9df5df`, `#94e5d5`): removed. Use `lime` on dark surfaces and
  `secondary-container` on light surfaces.
- Tertiary brown (`#703321`, `#8d4a36`): removed. Warnings use the `warning` family; emphasis uses
  `primary`.
- Royal blue info (`#1d4ed8`): replaced by the logo steel blue.
