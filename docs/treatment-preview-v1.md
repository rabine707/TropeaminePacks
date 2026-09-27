# Treatment Preview v1

Prototype spec for the Tropeamine Packs card-treatment system. This branch is intentionally isolated from production while the visual treatments are tuned.

## Treatments

- Base — original uploaded card artwork, untouched.
- Holo — directional rainbow diffraction.
- Heartthrob — two original irregular SVG heart masks, with staggered subtle double heartbeats. Foil color and illumination move through the fixed surface pattern; no Unicode wallpaper.
- Unhinged — a fine irregular triangular cracked-ice mask, with translucent facets and hairline boundaries.
- Slow Burn — copper/orange/gold oil-slick interference rings, with restrained plum undertones.
- Aftercare — champagne/pearl bands and microscopic diamond dust that catches the moving light.

## Interaction

`components/treatment-card.tsx` owns the shared interaction engine. The original `Art` renderer and image URL remain unchanged. Base, missing cards, and card backs bypass the engine. Felicity's existing detail selector exposes all five finishes as previews; it does not grant ownership.

The untransformed stage normalizes pointer coordinates. A frame-rate-independent animation loop drives bounded rotation, a moving specular light, and opposing diffraction coordinates through CSS custom properties, without React renders on pointer movement. The loop stops at rest and is cancelled on unmount. Changing treatment remounts the engine at neutral.

Mouse hover and captured touch/pen drags share this path. Drag sideways on mobile; vertical gestures remain available for scrolling and pinch zoom is preserved. Pointer up, cancellation, capture loss, blur and mouse exit restore neutral lighting. Arrow keys move the light; Home resets it. Reduced motion removes rotation and heartbeat while keeping controllable light.

The finish is clipped to the card. Its alpha fades over the baked-in header, title and footer to preserve readability. There are no automatic sweeps, flame particles, or floating symbols. Device orientation remains future work.

## Original material assets and references

All four SVG files in `public/treatments/` were generated specifically for this prototype: two sets of scattered Bézier hearts, jittered triangular facets, and microscopic dust. They contain no third-party or branded artwork. Existing card images are neither edited nor copied into these assets.

Architectural references (techniques only; no source code or assets copied):

- https://github.com/simeydotme/pokemon-cards-css — transforms, gradients and blending for foil.
- https://github.com/bpisano/Sticker — material parameters, light reflection and interaction.
- https://github.com/jerinjohnk/RNShaderCard — coupling card rotation with highlight position.

## Verification

Run `npm run typecheck`, `npm run build`, and `npm test`.

For browser regression, start the local app and open it using `agent-browser --session treatments open http://127.0.0.1:3107/discover`. Use an isolated, signed-out browser. The existing collection lock still applies: for a local test only, add Felicity's catalog ID to the local demo wallet's `owned` array, reload, and open her detail dialog. Do not seed a signed-in browser, since the existing account shell syncs collection changes.

Get the browser endpoint with `agent-browser --session treatments get cdp-url`, then run `node scripts/verify-treatments.mjs <cdp-url> [screenshot-directory]`. This dependency-free CDP check expects that open detail dialog. It exercises all five finishes with desktop mouse input and Chromium mobile touch emulation, verifies light/tilt coupling, original image preservation, release/cancel/exit reset, keyboard input, reduced motion, vertical scrolling and Base bypass. Screenshots are optional. Actual iOS/Android hardware and device orientation are not covered.

Verified at 1280×900 desktop and 390×844 mobile emulation. All interaction assertions, build, type check and seven existing tests pass. The build retains the repository's existing Edge Runtime deprecation warning.

The eventual card-detail selector is:

Base | Holo | Heartthrob | Unhinged | Slow Burn | Aftercare

## Economy locked for implementation after visual approval

Slot 5: Holo 70%, Heartthrob 14%, Unhinged 8%, Slow Burn 5%, Aftercare 3%.

Treatments are permanent per-character unlocks, not inventory quantities. Repeated treatment pulls convert to character-specific Duplicates, separate from account Shards.

Craft costs in Duplicates: Holo 3, Heartthrob 5, Unhinged 10, Slow Burn 15, Aftercare 25.

Duplicate treatment conversion: Holo +1, Heartthrob +2, Unhinged +3, Slow Burn +4, Aftercare +6.
