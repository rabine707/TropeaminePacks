# Figma redesign V1

Editable design: https://www.figma.com/design/H9KfEgaRwOK9cvbDbeSPSr?node-id=25-3257

Use **V1 / System** and **V1 / Screens**. Original concept frames, the actual Binder study, and the mobile Binder study remain intact. The Figma AI study is a reference, not the implementation authority.

The design includes 67 desktop, mobile, and flow frames with native text, auto-layout, reusable components, color/spacing variables, and real pack/card artwork. Typography is DM Sans in the new screens; unavailable Georgia in earlier studies was preserved. Existing artwork masters were reused without regeneration.

## Implementation

- Shared dark plum surfaces, pink primary actions, and gold foil/reward accents.
- Home uses real collection totals and the existing card renderer. Pack selection reuses the real three pack definitions and settlement path.
- Mobile Binder status controls remain accessible. Collected, Missing, Recent, and edition filters understand foil-only ownership; acquisition order survives cloud hydration. Slot numbers use the card number rather than the set code.
- Guest pack recaps explicitly say their cards are not saved, and repeating a free demo stays free. The intended public Felicity preview works; her back remains fully visible.
- Password recovery reaches the new update page through the existing PKCE callback. External post-auth redirect destinations are rejected. Error/success feedback has accessible status roles.
- Albums, odds, Showcase, authentication, and admin surfaces share the new visual foundations. Existing authenticated operations and database rules are retained.

## Validation and release boundary

Production build, TypeScript, 20 unit tests, and whitespace checks pass. Browser checks covered mobile and desktop Home, Binder status/series views, public card front/back/fullscreen, pack selection, reveal and four-card recap, repeating the free demo, sign-in feedback, expired recovery, and empty Showcase state.

Actual account sign-in, a password change, cloud pack spending/crafting, privileged admin edits, and a Showcase export from an owned collection still need signed-in validation. No production merge, deployment alias change, schema migration, or currency adjustment is part of this branch.
