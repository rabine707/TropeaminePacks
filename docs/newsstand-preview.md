# Newsstand homepage preview

Visit `/preview/newsstand` on this branch's deployment. `/` remains the current homepage. The preview is marked noindex and has an explicit return link; no navigation entry replaces Home.

The concept combines an independent magazine stand and bookshop: cream newsprint, walnut rack edges, ink typography, burgundy actions, and brass accents. It includes Cover Story, On the Rack, a Sports Romance release feature, Fresh This Week, Editor's Picks, After Dark, and a binder invitation.

## Data and interactions

- Uses AccountCollectionShell's existing catalog/auth/collection hydration, and CollectionApp's Art renderer, card dialog, favorite handler, and preferences dialog.
- Shared `lib/packs.ts` contains the unchanged pack definitions. `/packs?pack=sports-romance-1` selects the existing Sports Romance pack. Other pack links retain their usual default.
- Sports covers come from real pack memberships. When illustrated Sports cards are unavailable, the cover rack uses current catalog artwork and labels it accordingly.
- Fresh This Week is an editorial section showing the most recent illustrated catalog entries in the existing load order; it does not claim timestamp-based weekly filtering.
- Editor's Picks prioritizes the user's favorites, then Legendary entries. No popularity or sales numbers are invented.
- The homepage shows SFW cards only, including exclusion of the live loader's Mature Content tag. After Dark opens existing preferences without opting anyone in.
- Every cover and pick uses a normal button; favorites, navigation, and preferences work by tap or keyboard. No required hover or long press.
- CSS is scoped to the preview class, including footer/body styling. The preview component is loaded separately with a dynamic import.

## Verification

- Typecheck and production build pass.
- Both schema checks pass; 13 of 14 existing unit tests pass. The failing browse-art test on main expects 560 x 840 / quality 32 while main's implementation uses 768 x 1152 / quality 82. Artwork delivery and its tests were left unchanged.
- Browser checks with the real public catalog: illustrated Sports covers, 22-card Sports pool, mobile menu, card dialog/front/back, reversible favorites, preferences, and Sports Romance deep link.
- Responsive checks at mobile, wider mobile, tablet, and desktop widths show no horizontal overflow. Current homepage retains its existing layout after leaving the preview.
- Signed-in pack settlement, crafting, Google OAuth, and account mutations are unchanged and were not exercised by this visual-preview task.

No merge, production deployment, schema migration, or live homepage replacement is part of this preview.
