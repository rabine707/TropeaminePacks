# Figma redesign V1

Editable design: https://www.figma.com/design/H9KfEgaRwOK9cvbDbeSPSr?node-id=25-3257

Use **V1 / System** and **V1 / Screens**. Original concept frames, the actual Binder study, and the mobile Binder study remain intact. The Figma AI study is a reference, not the implementation authority.

The design includes 67 desktop, mobile, and flow frames with native text, auto-layout, reusable components, color/spacing variables, and real pack/card artwork. Typography is DM Sans in the new screens; unavailable Georgia in earlier studies was preserved. Existing artwork masters were reused without regeneration.

## Implementation

- Shared dark plum surfaces, pink primary actions, and gold foil/reward accents.
- Home uses real collection totals and the existing card renderer. Pack selection reuses the real three pack definitions and settlement path.
- Mobile Binder status controls remain accessible. Collected, Missing, Recent, and edition filters understand foil-only ownership; acquisition order survives cloud hydration. Slot numbers use the card number rather than the set code.
- Choosing Foil or Base editions now displays that edition even when a different finish was saved. Missing base cards have a direct crafting confirmation in the Binder.
- Quick Create and Studio accept foil-only card ownership without treating a treatment-only record as an owned card.
- Guest pack recaps explicitly say their cards are not saved, and repeating a free demo stays free. The intended public Felicity preview works; her back remains fully visible.
- Password recovery reaches the new update page through the existing PKCE callback. External post-auth redirect destinations are rejected. Error/success feedback has accessible status roles.
- Albums, odds, Showcase, authentication, and admin surfaces share the new visual foundations. Existing authenticated operations and database rules are retained.

## Validation and release boundary

Production build, TypeScript, 22 unit tests, and whitespace checks pass. Browser checks covered mobile and desktop Home, Binder status/series views, public card front/back/fullscreen, pack selection, reveal and four-card recap, repeating the free demo, sign-in feedback, expired recovery, and empty Showcase state.

Signed-in verification confirmed collection hydration, edition counts, recent acquisitions, an explicitly approved base craft and saved pack, and persistence after reload. A 3240 × 3240 Showcase PNG was exported from existing account picks and retrieved successfully. The recovery form and admin editor were inspected while signed in.

Password submission and live catalog edits were not performed. No production merge, production alias change, schema migration, or administrative currency adjustment is part of this branch.
