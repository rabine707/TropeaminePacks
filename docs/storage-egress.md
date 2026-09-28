# Storage egress investigation — September 28, 2026

## Confirmed cause

Started from open PR #27, branch `fix/reveal-heading-fit-after-merge`, commit `939a1c5`. Supabase edge logs for **September 27, 00:00–24:00 UTC** show:

| card-art requests | Count | Unique artwork paths | Response bytes |
| --- | ---: | ---: | ---: |
| GET, cache MISS | 1,321 | 22 | 3,779,533,897 (3.52 GiB) |
| GET, cache HIT | 14 | 8 | 37,621,628 |
| Successful signing/upload POSTs | 5,930 | 84 | 3,020,108 |

Every one of the 1,321 misses used a distinct request URL. The GET cache hit rate was **1.05%**. Of the missed bytes, 3,775,845,249 were front/other filenames; just one identified back request accounted for 3,688,648 bytes. Front browsing and URL churn explain the reported spike; the current pack-wide preload was an additional avoidable cost, not the dominant cause of that historical day.

`loadLiveCards` minted new six-hour signed URLs for both sides of every card each time the account shell mounted. Navigation/full reloads therefore changed image cache keys. Supabase treats every signed token as a separate CDN entry. Browser state saved these URLs but the next catalog load replaced them. The UI used `next/image unoptimized`, so small browsing tiles still downloaded original PNGs. Its existing native lazy loading did not provide smaller representations.

Live Storage is private. All 56 stored objects have upload metadata `max-age=3600`; simply increasing that setting would not fix URL churn. Sample HEAD responses returned `no-cache`, while sampled GET responses lacked Cache-Control. Neither was providing a dependable browser freshness window. No bucket, database, policy, or existing image was modified in this investigation.

## Image-path audit and implementation

| Path | Previous behavior | New behavior |
| --- | --- | --- |
| Catalog hydration | Signs every front/back, serial card loop | Metadata only; stable asset-ID + object-revision URLs |
| Home, discover, series, owned binder tiles | Original images in small tiles | 560px WebP at quality 85, mounted only within 200px of viewport |
| Missing binder slots | Placeholder | Still no image requests |
| Card detail/fullscreen/flip | Original image | Same original bytes, requested for the viewed side |
| Pack opening | Preloads all five mystery backs plus all pulled fronts/backs | Current front prepared behind mystery face; current back prepared once front is shown |
| Reveal all / recap | All backs already preloaded | Browsing fronts only for skipped cards; click opens original |
| Foil/treatments | Shared art plus local CSS/SVG effects | Same effects, sequence, geometry and assets |
| Admin selected-card previews | Two private signed originals on edit | Unchanged private previews; never enters shared public cache |
| Admin artwork replacements | Overwrites the existing path | New UUID object revision and update of asset row, retaining live policy path shape |
| Demo upload / pack wrappers / set artwork | Local data URLs or repository assets | Unchanged |
| Collection celebration helper | Unused helper references original | No active whole-catalog image fetch exists there |

`/api/card-art/[id]` uses a publishable-key client with **no user cookies or service-role key**. Every cold request checks anonymous RLS plus SFW rating, availability, published card/set/series, asset ID, and exact current object revision. Adult, unpublished, stale-revision, malformed, and error responses are not cached. Arbitrary image URLs, dimensions and extra cache-busting parameters are rejected. Auth-refresh middleware excludes this route so it cannot add Set-Cookie or private cache headers.

Successful artwork responses have `public, max-age=3600, s-maxage=3600`: one hour in the browser and Vercel CDN. This shifts repeated delivery to Vercel's CDN; it does not eliminate hosting bandwidth. Published art can remain in those caches during the freshness window after an unpublish, so immediate withdrawal requires cache invalidation as well. The private bucket and adult/admin access model remain intact. No long-lived public bucket URLs or permanent signed bearer tokens are introduced.

Browsing transformations are supported by the live project and were verified. If a thumbnail request fails, the component falls back to the original. Full-size images never use a transform. Replacement uploads retain old objects rather than deleting them automatically; obsolete-object cleanup is separate.

## Measured results

| Sample | Original | Browse | Reduction |
| --- | ---: | ---: | ---: |
| Front | 1,299,851 bytes | 127,116 bytes | 90.22% |
| Back (diagnostic only; browsing uses fronts) | 1,213,471 bytes | 126,490 bytes | 89.58% |

Both originals were SHA-256 identical through the new route. All four previously viewed catalog thumbnails reported **transferSize = 0** on return navigation. The seven-card catalog mounted only four nearby images at the tested viewport; missing binder slots made zero artwork requests. A newly opened pack requested one full front instead of the whole pack's artwork. Reveal-all fetched no skipped backs.

These are measured per-image and per-flow savings, **not a forecast that the entire daily bill falls by 90%**. First-time original viewing still transfers the full original. Shared CDN savings depend on deployed cache hits and visitor traffic, and must be checked after release.

## Validation

- TypeScript and production build pass; 13 application/delivery tests and 2 schema tests pass.
- Delivery tests cover stable/revised URLs, upload path compatibility, original byte preservation, thumbnail options, all visibility filters, unsupported inputs, failures and no-store errors.
- Live read-only checks confirm bucket privacy, anonymous SFW access, admin asset-update policy and compatibility of revision names with the actual upload policy.
- Browser checks: home/catalog/detail, lazy loading, zero-byte revisit, missing binder slots, all five mystery/front/back sequences, fifth-slot foil, recap, reveal-all, and mobile detail; no runtime exceptions.
- All five desktop treatment light/tilt/reset checks, keyboard and reduced-motion checks pass with the legacy verifier scoped to the open dialog. Its mobile drag section is not claimed as passing: existing horizontal detail-swipe behavior flips the card during that legacy test. Treatment and swipe code were not changed.
- Reproduce the guest reveal checks with `node scripts/verify-card-egress.mjs <browser-CDP-url> http://127.0.0.1:3128 [screenshot-directory]`.
- Existing PR also had a missing `UserRound` import; fixed to make its production build pass.
- No production merge, database migration, live upload, or manual deployment performed.

## Files

- `lib/card-art.ts`: stable URLs, browse URLs, immutable upload names.
- `lib/card-art-delivery.ts`, `app/api/card-art/[id]/route.ts`: access-checked cached delivery.
- `components/card-image.tsx`: near-viewport mounting and thumbnail fallback.
- `components/account-collection-shell.tsx`: stop signing the whole catalog.
- `components/collection-app.tsx`: browse/original selection and bounded reveal preparation; missing import fix.
- `app/admin/cards/card-manager.tsx`: revision uploads with checked asset-pointer update.
- `proxy.ts`: bypass session refresh for public artwork delivery.
- `scripts/verify-card-egress.mjs`: guest-browser reveal regression checks.
- `lib/card-art.test.ts`, `package.json`: automated regression coverage.

## References

- [Supabase signed URL cache keys](https://supabase.com/docs/guides/storage/cdn/smart-cdn)
- [Supabase image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Vercel response cache headers](https://vercel.com/docs/caching/cache-control-headers)
