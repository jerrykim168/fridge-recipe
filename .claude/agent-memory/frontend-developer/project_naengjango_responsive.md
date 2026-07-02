---
name: project-naengjango-responsive
description: Mobile-first responsive/touch/a11y conventions established for the naengjango UI (breakpoints, hover-guarding, touch targets)
metadata:
  type: project
---

Responsive conventions for "냉장고를 부탁해" UI (app/page.module.css, components/step3.module.css). See [[project-naengjango]] for overall structure and agent division of labor.

**Approach:** mobile-first. Base styles target ~375px; layers added upward via `min-width` media queries. Breakpoints in use: 400px (narrow-phone tweaks, max-width), 480px (dialog centers), 640px (roomier cards + larger title), 768px (tablet rhythm), 1280px (desktop header spacing). Content max-width capped at 720px so desktop just centers.

**Touch vs hover — important pattern:** all `:hover` rules are wrapped in `@media (hover: hover)` and paired with a matching `:active` rule, so touch taps get press feedback but never leave a stuck hover state. If you add a new hover style, follow this pattern (there are ~10 such guarded blocks). Global `touch-action: manipulation` + `-webkit-tap-highlight-color: transparent` set on interactive elements in globals.css.

**Touch targets:** buttons min-height 44px (already a project norm). Chip remove buttons are 32px visual but extend hit area to ~44px via an `::after { inset: -6px }` pseudo-element overlay — reuse this trick rather than inflating small controls.

**iOS specifics:** `.input` font-size is `16px` on mobile (prevents Safari zoom-on-focus), tightened to 0.95rem at >=640px. Safe-area insets respected on `.page` padding and the dialog backdrop. AuthDialog bottom-aligns + slide-up on mobile (<480px), centers + fades on larger screens; uses `100dvh` with `100vh` fallback.

**Why:** dedicated mobile-optimization pass (2026-07-02). Base a11y (focus-visible, reduced-motion, live regions, focus trap) was already solid before this pass — do not rebuild it.
**How to apply:** when adding UI, keep it mobile-first, guard hovers, hit 44px targets, and use 16px inputs on mobile. Verified in-browser at 375px and 768px.
