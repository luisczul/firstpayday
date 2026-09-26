import { brand } from "@/lib/brand";
import { LegalPage } from "../LegalPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 26, 2026">
      <p>These terms are between you and {brand.legalEntityName}, the seller of {brand.name} subscriptions.</p>
      <h2>The service</h2>
      <p>{brand.name} helps families track paid chores and allowances. It records amounts; it does not hold, move or pay out real money.</p>
      <h2>Accounts</h2>
      <p>You must be an adult to create an account. You&apos;re responsible for your account, for the kids&apos; tablets you connect, and for the information you enter about your children.</p>
      <h2>Trial, billing and cancellation</h2>
      <ul>
        <li>The first kid in a household is free. Each additional kid is $5 CAD per month, plus applicable taxes, billed monthly until canceled.</li>
        <li>New households get a 14-day free trial with any number of kids and no card required.</li>
        <li>Adding or archiving kids changes the subscription quantity, prorated.</li>
        <li>You can cancel any time from Settings → Billing; access continues until the end of the paid period. After that a household with more than one active kid becomes read-only until it subscribes again or archives down to one kid.</li>
      </ul>
      <h2>Your data</h2>
      <p>You own your data. You can export or delete it at any time. See the Privacy Policy for details.</p>
      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse the service, try to access other households&apos; data, or interfere with its operation.</p>
      <h2>Liability</h2>
      <p>The service is provided “as is”. To the extent allowed by law, our liability is limited to the amount you paid in the 12 months before a claim.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${brand.supportEmail}`} className="font-bold text-maple">{brand.supportEmail}</a></p>
    </LegalPage>
  );
}
