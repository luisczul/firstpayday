import { brand } from "@/lib/brand";
import { LegalPage } from "../LegalPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 26, 2026">
      <p>{brand.legalEntityName} (“we”) runs {brand.name}. This policy explains what we collect and why. We wrote it with Quebec&apos;s Law 25, PIPEDA and COPPA in mind.</p>
      <h2>Kids have no accounts</h2>
      <p>
        Children never create accounts, never log in and never give us an email address. The only information about a child is what a parent enters and controls: a <b>first name</b>, an <b>optional photo</b>, and their <b>chore and money history</b> inside the household.
      </p>
      <h2>What we collect from parents</h2>
      <ul>
        <li>Account: email address and a password (stored hashed by our authentication provider).</li>
        <li>Household settings: name, timezone, currency, language.</li>
        <li>Billing: handled by Stripe. We never see or store your full card number.</li>
        <li>Tablet identity: a random token stored in a cookie so the kids&apos; tablet stays connected.</li>
      </ul>
      <h2>Where it&apos;s stored</h2>
      <p>Your data is stored in Canada (Supabase, region ca-central-1). Photos are private and served through short-lived signed links.</p>
      <h2>No ads, no selling</h2>
      <p>We don&apos;t show advertising, we don&apos;t sell or rent data, and we don&apos;t use analytics or ad cookies. The only cookies are the ones needed to log you in and keep the tablet connected.</p>
      <h2>Your control</h2>
      <p>Parents can export their history as CSV and delete the whole household (every kid, photo and record) from Settings at any time. Canceling a subscription never deletes data; inactive canceled households may be removed after 12 months, with an email warning 30 days before.</p>
      <h2>Contact</h2>
      <p>Privacy questions or requests: <a href={`mailto:${brand.supportEmail}`} className="font-bold text-maple">{brand.supportEmail}</a>.</p>
    </LegalPage>
  );
}
