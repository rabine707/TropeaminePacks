# Beta account safeguards and release review

Prepared October 14, 2026. This branch is implemented and locally verified. The new migration has **not** been applied to production, and this branch has **not** been merged or deployed. No tester invitations or support emails were sent.

## Combined release in PR #52

PR #52 includes these account safeguards together with compact, lazy artwork
previews. Card detail, backs, fullscreen, Studio canvases and exports retain
original quality; see [artwork delivery by view](../artwork-quality.md).

The combined branch passes 35 application tests, 32 database tests, typecheck and
the Next 16.3.8 production build. Database integration tests apply request limits
both before and after account safety, checking consent, submission limits,
withdrawn-content filtering and deletion of account quota rows. The request-limit
migration now preserves the existing public community wrapper instead of
overwriting account-policy checks on a fresh ordered install. Its already-applied
production version does not need to be rerun: applying the pending beta migration
after it installs the guarded wrapper.

Combined local browser checks used the disposable loopback Auth/database adapter:
signup policy appears before credentials, existing sign-in redirects to policy
acknowledgment, and privacy/removal/deletion controls remain reachable before
acknowledgment. No real account deletion or production mutation was tested.

The release sequence below still applies. The pending migration and server-only
secrets are required; merging the combined PR alone is not a complete release.

## Collector experience

- Accounts use a 13+ policy with a neutral age-range selection and explicit Terms/Privacy acknowledgment before the signup form requests credentials. This is a project policy and self-declaration, not identity verification or a certification that all content is suitable for every teenager. Under-18 users are asked to review the Terms with a parent/guardian.
- Mature-theme notices appear in signup, the homepage and legal pages. Explicit editions are unavailable to collectors in this beta, including direct Data API and Storage reads. Creators retain access to manage original assets.
- Existing collectors acknowledge the policy without resetting cards, currency or claimed rewards. First acknowledgment makes their profile private; they may deliberately publish it afterward.
- Privacy & account supports profile visibility, removal of the collector's submissions/notes/votes/showcase, and account deletion after recent sign-in and an exact DELETE confirmation.
- Content removal preserves earned rewards and independently contributed shared requests. Attribution is removed; already downloaded or reposted copies cannot be recalled.
- Support, feedback, privacy/deletion and rights reports use **RSI.projects707@gmail.com**. Links open the visitor's email application; the website does not send a message automatically.

## Server protections

The signed policy cookie is HttpOnly, SameSite=Lax, secure on HTTPS, expires after 15 minutes, and uses a server-only HMAC secret. Sensitive POST routes compare the browser Origin to the public Host, not Next's internal hostname. They verify the authenticated account and do not accept a deletion target ID from the browser.

The authoritative declaration lives in a private database table, separate from editable Auth user metadata. Email registration triggers reject missing/invalid policy metadata before creating an Auth account. Google can create an Auth identity before the application callback; that identity has no collection/community access until policy acknowledgment succeeds. This limitation must remain visible in any privacy assessment; the implementation does not guarantee that no Google identity or infrastructure log can exist before consent.

Restrictive RLS policies intersect existing ownership policies. Database triggers also guard economy writes from legacy SECURITY DEFINER RPCs. Public profile lookup requires current policy acceptance. A signed-in account reporting an under-13 age range receives a server-side restriction and its profile is hidden; reselecting another age does not restore eligibility. Creators can see the account identifier and report time in the privacy-review queue. They must investigate promptly and handle removal; a queue alone does not complete that operational obligation.

Deletion uses a verified Supabase account, matching verified claims, an active Auth session and a recent authentication-method timestamp (15 minutes). Token refresh alone is insufficient. The server checks catalog upload ownership and the last creator role before globally revoking sessions and deleting the current Auth user. Cleanup runs inside that Auth deletion transaction. Failure rolls back database cleanup; if session revocation already succeeded, the UI accurately reports that sign-in is required again.

Owned collection/account rows cascade. Curated shared requests and creator-action attribution can remain anonymized. The current browser clears only Tropeamine storage and Supabase Auth keys, preserving unrelated storage. Other devices' drafts, provider backups/logs and externally downloaded copies have separate retention boundaries. Accounts owning Storage uploads or the last creator role need an explicit support-assisted transfer before deletion; the code never removes shared catalog artwork as a shortcut.

## Verification

| Check | Result | Boundary |
| --- | --- | --- |
| Unit tests | 35 passed | Signed proof, origin validation, recent authentication, deletion sequencing, existing economy/art/export behavior |
| Database tests | 23 passed | Ephemeral PostgreSQL-compatible PGlite; deployed-shape fixture and normalized blueprint; RLS, definer guards, restriction, cleanup and rollback |
| TypeScript | Passed | `npm run typecheck` and production build |
| Production build | Passed | Next 16.3.8; existing Edge Runtime deprecation warning remains |
| Dependency audit | 0 vulnerabilities reported | Full `npm audit` after patching Next/sharp/source-map-js; not a comprehensive security certification |
| Browser | Passed locally | Existing-account acknowledgment/private default, content removal, deletion result, synthetic email registration and mocked OAuth callback, anonymous age-block/retry |
| Responsive check | Passed locally | Privacy page fits 375px and 390px without horizontal overflow; main buttons are 48px tall; desktop inspected at 1440px |
| Catalog review | Inventory complete | 67 published SFW cards / 134 browse-size images; rights are not cleared |

Browser QA used the real built Next app with `scripts/beta-browser-fixture.mjs`, a disposable loopback-only Auth/Data API adapter backed by the real migration in PGlite. It uses synthetic accounts and placeholder catalog responses. It is not a verification of real Supabase Auth, Google, email delivery, deployed Vercel behavior, physical-device Safari, or production catalog loading. The adapter serializes database requests; this is not a multi-connection race test.

Screenshots: [signup](signup-mobile.png), [privacy mobile](privacy-mobile.png), [privacy desktop](privacy-desktop.png), [age-block result](age-block-mobile.png), [synthetic deletion result](deletion-result-mobile.png), [contact](contact-desktop.png). The request-only fixture audit records methods/paths, never real credentials or request bodies.

The React review checked hook ordering, effect dependencies, semantic form labels, busy/confirmation controls, status announcements, client/server secret separation and independent Auth requests in parallel. New account actions remain user-triggered; there are no automatic deletion or publication effects.

## Rights and legal review

The creator confirmed no author/publisher permissions have been obtained. See [the complete catalog inventory and review flags](CATALOG-REVIEW.md), including the Lady Rendral/Elysara mismatch. Fan-made notices and a free hobby beta do not establish a license. Fair use requires a fact-specific assessment; the Copyright Office explains why noncommercial use alone does not resolve it. [U.S. Copyright Office guidance](https://www.copyright.gov/fair-use/more-info.html).

The 13+ policy reduces deliberate collection from children under 13; it is not a blanket exemption or legal guarantee. Audience, marketing and actual knowledge matter under COPPA. Consult the revised Rule rather than relying only on older FAQs. [FTC COPPA Rule and current materials](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa).

Have California-qualified counsel review unresolved copyright/trademark uses, actual audience/content, privacy disclosures, minors' content-removal obligations and any age-assurance requirements before claiming compliance. This branch supplies technical safeguards and an inventory for that review, not a legal opinion. No age declaration establishes that a work is legally non-obscene.

## Release sequence — approval required

1. Review the code, migration and catalog rights inventory. Resolve the card identity mismatch and decide whether uncleared assets should remain in a limited beta, be replaced or be withheld with legal guidance. Do not represent them as licensed.
2. Use a separate staging Supabase project to verify actual email confirmation, OAuth redirects, session revocation and deletion with disposable accounts. Do not test destructive account actions using the creator or real collectors.
3. Configure `ACCOUNT_POLICY_SIGNING_SECRET` (random, at least 32 characters) and `SUPABASE_SECRET_KEY` **server-side only**. Do not put either in NEXT_PUBLIC variables, the browser, repository or URLs. `.env.example` documents names; the local `.env.local` used synthetic values and is ignored by Git.
4. Confirm the two existing community migrations are already installed, back up the database, and review `supabase/migrations/20261014044307_beta_account_safety.sql`. Apply only this additive migration, never blindly rerun `schema.sql`. Installation preserves existing wallets, collection rows, claims and artwork, but it changes registration, eligibility, FK deletion behavior and public-profile availability.
5. Coordinate migration and deployment in a short controlled release window. Applying this migration while old signup code is still live will reject old email signup metadata; deploying the new code without the migration will fail closed. Keep invitations paused until both sides are installed and verified.
6. Verify the deployed commit, existing-account acknowledgment without balance loss, new signup/OAuth, private/public profile access, explicit-asset denial, minor-content removal, and synthetic deletion in the staging project. Confirm creator access and the privacy review queue. Verify contact links and mobile navigation on the actual release.
7. After release approval and successful live verification, invite a small initial tester group with the guide below. No invitation has been sent by this task.

Rollback needs a reviewed database plan: rolling back only the app can break registration, and indiscriminately dropping eligibility policies would reopen access. Do not remove safeguards or revert foreign keys without understanding the affected data. Stop new signup/invitations and use support while investigating a failed release.

## Tester feedback guide

Share the deployed beta URL only after release verification. Explain that it is an unofficial fan-made collecting beta, accounts are 13+, source books contain mature themes, and the offered cards are non-explicit. Ask testers to read the content notice and account terms before registering.

Ask them to try browsing, binder filters, free/virtual pack flows, Showcase Studio, profile visibility and the feedback link. For privacy/deletion testing, use an account they are willing to lose and explain the permanent effect. Do not ask for passwords, verification codes or identity documents.

Feedback format: page/link; device/browser; expected behavior; actual behavior; reproduction steps; optional screenshot with private details removed. Send to RSI.projects707@gmail.com.

Separate known audit backlog: the mobile navigation's seventh Showcase item can clip in the six-slot layout, and collection/grid positioning and loading performance still need the broader design audit fixes. These account safeguards do not close that visual/performance backlog. Use the visible Showcase Studio link while reviewing navigation.
