import {LegalShell} from '@/components/legal-shell';
import {SUPPORT_EMAIL} from '@/lib/account-policy';
import {pageMetadata} from '@/lib/site-metadata';
export const metadata=pageMetadata('Contact & beta feedback','Send tester feedback, privacy requests, and artwork-rights concerns to Tropeamine.','/contact');
export default function Contact(){return <LegalShell title="Let’s hear it." kicker="BETA FEEDBACK · SUPPORT" updated="October 14, 2026">
 <p>Tropeamine is a small beta collecting project. Tell us what feels good, what feels confusing, or what breaks.</p><p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
 <h2>Tester feedback</h2><p>Include the page, what you expected, what happened, and your device/browser. Screenshots are helpful; remove email addresses, personal details, and sign-in information before sharing. Never send passwords or verification codes.</p>
 <h2>Privacy, content removal & account deletion</h2><p>Start in <a href="/account/privacy">Privacy & account</a>, or email us for access, correction, deletion, or removal of content you posted. If you believe an account belongs to a child under 13, contact us so we can investigate. We may ask you to authenticate through the site to protect your account.</p>
 <h2>Artwork & rights concerns</h2><p>Send the card or page link, identify the material, and explain your concern or connection to the rights. We review reports and may remove material. Tropeamine’s fan-made disclaimer does not establish a license or guarantee fair use.</p>
 <h2>Beta content</h2><p>Accounts require age 13+. Cards offered in this beta are non-explicit, but the source books may contain sexual references, violence, and strong language. Please do not submit graphic sexual material or private information in feedback or community suggestions.</p>
</LegalShell>;}
