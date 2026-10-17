# Creator Studio Add Card

The `/admin` Add Card button now opens a Supabase-backed draft form instead of the browser-only editor. Select series, set, existing character, unique card number, optional front/back artwork and rarity. Known author, character bio and book scope fill automatically. Advanced Options edits only the new card's description and book range.

## Data and authorization

- Every catalog and save server action validates the signed-in user with `auth.getUser()` and checks `creator_roles` for admin.
- Storage uploads retain the existing private `card-art` bucket, authenticated browser client, existing RLS and `newCardArtPath` convention. Uploads use `upsert:false`; accepted files are JPEG/PNG/WebP up to 20 MB with signature validation.
- The additive `admin_create_card_draft` RPC uses SECURITY INVOKER and an empty search path, checks admin again, validates set/character membership under the chosen series and performs one transaction.
- The RPC only inserts. Existing IDs and globally unique card numbers are rejected. Shared series/character/set records and CK01 cards are never updated. Card publication and variant availability are always false. No pack memberships are created.
- Successful uploads remain in component state across failed saves, so retries reuse those uploads. Ambiguous saves can be checked in Saved drafts. Closing the form releases local previews; unfinished form fields are not persisted across reloads.
- The existing `/admin/cards` manager and its editing/upload paths remain available and unchanged. The existing `admin_save_card` function is unchanged.

## Release

Production was inspected read-only. CK01 has 10 cards; CK02 is an unpublished set with 0 cards. `catalog_is_admin`, catalog admin RLS and Storage admin policies already exist in the target project `jtpgqrqvzrapptdmyepm`.

1. Review and approve the new migration `20261016235050_creator_card_drafts.sql` and application release.
2. Apply only this additive migration to the verified target. Do not run the bootstrap schema or blindly replay historical migrations. It creates an endpoint and its execution grants; it inserts no catalog rows.
3. Merge/release the tested commit to the verified Vercel project. Git deployments are disabled in `vercel.json`, so a push alone does not publish the change.
4. Verify the deployed commit and domain. Confirm non-admin denial, CK02 visibility to admins, a real authenticated artwork upload and draft save. A live test creates a draft and uploaded files; use explicitly approved test artwork and a unique test number.
5. Compare CK01 cards and assets with a pre-release snapshot, and verify the new card is unpublished, unavailable and absent from pack memberships.

Rollback the app first if necessary. The new RPC can then be dropped without deleting cards or artwork. Do not delete uploaded files or draft records as part of rollback.

## Validation

- TypeScript check and production build.
- `npm test`: 38 tests, including metadata validation, artwork signatures and character defaults.
- `npm run test:schema`: 34 tests, including synthetic Postgres/RLS checks for create-only CK02 drafts, CK01 preservation, duplicate rejection, admin authorization, cross-series rejection and atomic rollback of invalid/missing artwork.
- Isolated local browser fixture: series-dependent options, CK02 choice, character defaults, collapsed Advanced Options, duplicate feedback, simulated failed/successful saves, saved draft listing and responsive layout at 390×844 and 1280×1080.
- Browser saves were simulated in a separate local fixture. No real authenticated Storage upload or new draft save was performed against production. No migration or deployment was applied during implementation.
