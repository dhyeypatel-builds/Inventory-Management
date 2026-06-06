# Design

TyreStock visual system: **Light Industrial**. A bright, engineered control surface. Cool steel-grey neutrals, crisp hairline borders, hazard-amber for action, near-black mono numerals for data. Calm and dense by default; the POS + invoice is the one crafted moment.

## Theme

Light, single theme (dark mode deferred). Token system is OKLCH and channel-based (`L C H` stored in CSS vars, consumed as `oklch(var(--token) / <alpha-value>)`) so opacity utilities keep working and a dark theme can be added later by swapping channel values.

## Color

Stored as space-separated OKLCH channels in `frontend/src/index.css`.

### Neutrals (cool steel)
| Role | OKLCH (L C H) | Use |
|---|---|---|
| `--background` | `0.985 0.002 250` | Page background, faint cool steel (never pure white, never cream) |
| `--card` / `--popover` | `1 0 0` | Panels, pure white, sit above bg with a hairline border |
| `--surface-2` | `0.966 0.004 250` | Sidebar, toolbars, the second neutral layer |
| `--secondary` | `0.945 0.005 250` | Subtle button / chip fills |
| `--muted` | `0.955 0.004 250` | Muted fills, table header band |
| `--muted-foreground` | `0.505 0.014 256` | Secondary text (verified ≥4.5:1 on white) |
| `--foreground` | `0.225 0.012 256` | Primary text, near-black steel |
| `--border` / `--input` | `0.905 0.004 250` | Hairline borders, input outlines |

### Accent + semantic
| Role | OKLCH (L C H) | Use |
|---|---|---|
| `--primary` | `0.705 0.172 58` | Hazard amber. Primary CTAs only. |
| `--primary-foreground` | `0.205 0.02 60` | Near-black, sits ON amber (caution-sign contrast) |
| `--ring` | `0.705 0.172 58` | Focus ring (amber) |
| `--destructive` | `0.555 0.205 27` | Out-of-stock, destructive actions |
| `--success` | `0.62 0.13 150` | In-stock |
| `--warning` | `0.70 0.16 65` | Low-stock (amber family, distinct from destructive) |

**Rules:** one accent (amber), used for primary action + live state only. Amber is always a fill behind near-black text, never light text on white. Status is icon+label, never color alone. Tinted shadows (steel hue), never pure black.

## Typography

Two families, paired on the sans/mono contrast axis (not two similar sans).

- **`--font-sans`: "Archivo Variable"**, system-ui fallback. All UI: headings, labels, body, buttons. Grotesque with industrial-signage character; legible down to 12px.
  - Headings: heavy weight (650–800) + tight tracking (`-0.02em`), `text-wrap: balance`. Fixed rem scale (no fluid clamp in product UI). Scale ratio ~1.2.
  - Body/UI: 14px base, weight 400–500.
- **`--font-mono`: "JetBrains Mono Variable"**, ui-monospace fallback. The data face: SKUs, quantities, prices, invoice numbers, money columns. Always tabular. This is what makes "the number is the hero" literal.

Imported via `@fontsource-variable/*` in `frontend/src/main.tsx`.

## Shape & materials

- **Radius: 4px (`--radius: 0.25rem`)** for buttons, inputs, cards, panels. Hard, mechanical. **Exception, documented:** status badges are full-pill. That is the only mixed-radius rule.
- Borders over shadows. Default panel = white + `1px` hairline border. Shadows are rare, steel-tinted, and only for true overlays (popover, dialog, sheet).
- No glassmorphism, no gradient text, no side-stripe accent borders, no nested cards.

## Motion

- 150–250ms, ease-out. Motion conveys state only (saving, stock delta, add-to-cart, toast), never decoration. No page-load choreography.
- `prefers-reduced-motion`: instant/crossfade fallback everywhere.

## Components

shadcn/ui primitives (we own the code), retuned to the tokens above. Every interactive element ships default / hover / focus / active / disabled / loading. Tables get skeleton loaders (not spinners) and teaching empty states. Primary button = amber fill + black text + `active:translate-y-px` tactile press.

## Layout

- App shell: persistent left sidebar (desktop) on `--surface-2`, top bar, mobile bottom-nav. Content max-width generous (data wants room).
- Responsive is structural (collapse sidebar, stack POS columns), not fluid type.
- POS: two-column on desktop/tablet (cart left, customer+totals right), single column under 768px.
