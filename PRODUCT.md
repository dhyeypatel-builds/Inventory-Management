# Product

## Register

product

## Users

The owner and counter staff of a tyre shop. Non-designers, often non-technical, working a full shift on their feet. Two contexts:
- **Back-office / desktop**: the owner managing catalog, inventory, customers, reports, settings.
- **Front-counter / tablet**: staff running the point-of-sale (POS) during a customer interaction, often quickly, sometimes with a queue waiting.

The job to be done: keep an accurate picture of tyre stock, sell tyres fast and correctly, and know at a glance what is running low or selling well.

## Product Purpose

TyreStock is an inventory + point-of-sale system for a single tyre business (Phase 1 MVP, RBAC-ready for later multi-role use). It exists so a shop owner can replace spreadsheets and paper invoices with one tool that tracks every tyre variant, every stock movement, and every sale, and surfaces low-stock and best-seller signals automatically. Success looks like: a sale is rung up in under a minute, stock is never silently wrong, and the owner trusts the dashboard enough to act on it.

## Brand Personality

Industrial workshop. Confident, mechanical, tactile, honest. Three words: **sturdy, precise, no-nonsense**. It should feel like a well-made piece of garage equipment, a torque wrench, not a consumer app. Voice is plain and direct: it tells you the stock count, not "you're all set!". Warmth comes from competence, not decoration.

## Anti-references

- Generic shadcn/slate starter look (near-black primary, default radius, Inter, no point of view). This is the current state and the thing we are explicitly leaving behind.
- AI-purple / blue-glow SaaS gradients, glassmorphism, hero-metric template cards.
- Cutesy small-business app warmth (pastel, rounded-everything, emoji, exclamation marks).
- Cream / beige / paper "editorial warmth" palettes.

## Design Principles

1. **The number is the hero.** SKUs, quantities, prices and invoice totals are the real content. They get a tabular mono treatment and the strongest hierarchy. Chrome recedes; data advances.
2. **Hazard-amber means action.** One accent, used only for primary actions and live state (the amber CTA, the low-stock warning). Never decoration. If everything is amber, nothing is.
3. **Hard edges, honest surfaces.** Crisp hairline borders and defined panels over soft shadows and floating cards. The interface looks engineered, not airbrushed.
4. **Calm tool, one signature moment.** Every screen is quiet and fast and gets out of the way; the POS checkout + printed invoice is the one flow we make genuinely satisfying, because it is run dozens of times a day.
5. **Earned familiarity over novelty.** Standard table / form / nav affordances done crisply. Staff should never have to learn an invented control. The tool disappears into the task.

## Accessibility & Inclusion

- WCAG 2.1 AA. Body text ≥4.5:1, large text/UI ≥3:1, verified against the steel-grey surfaces (the amber accent is used as a fill behind near-black text, never as light text on white).
- Stock status is never communicated by color alone: out-of-stock / low-stock carry an icon + label, not just red/amber.
- Full keyboard operability for the POS flow (search, add, set qty, confirm) and visible focus rings on every interactive element.
- `prefers-reduced-motion` honored: state transitions become instant/crossfade, no choreography.
- Tablet POS uses touch targets ≥44px.
