import { brand } from "@/lib/brand";
import { appUrl } from "@/lib/env";

export const FAQ: [string, string][] = [
  ["How much does it cost?", "Your first kid is free forever, with every feature. Each additional kid is $5 CAD per month. New families get 14 days free with as many kids as they want."],
  ["Do my kids need an account or email?", "No. Kids never log in and never type anything. They tap their face on the family tablet. Only parents have accounts."],
  ["Does it move real money?", "No. It's an allowance ledger: it tracks what each kid earned and what you paid out in cash or to their savings account."],
  ["What if two kids tap the same chore?", "House chores go to whoever taps first, and the card disappears for everyone else right away. Personal chores can be done by each kid separately."],
  ["Can I pay per unit, like per floor or per room?", "Yes. Set a unit and a maximum (for example $5 per floor, up to 3). Kids pick how many they did, and you can adjust the number before approving."],
  ["Can my partner approve chores too?", "Yes. Invite a co-parent by email and approve from any phone, tablet or computer."],
  ["Where is my data stored?", "In Canada. You can export or delete everything at any time. No ads, no selling data."],
];

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function landingJsonLd() {
  const url = appUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: brand.name,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, iPad, Android tablet",
        url,
        description:
          "Chore chart and allowance app for kids: a kitchen-tablet chore board where kids mark paid chores done and parents approve from their phone.",
        offers: [
          { "@type": "Offer", name: "First kid", price: "0", priceCurrency: "CAD" },
          {
            "@type": "Offer",
            name: "Each additional kid",
            price: "5.00",
            priceCurrency: "CAD",
            priceSpecification: { "@type": "UnitPriceSpecification", price: "5.00", priceCurrency: "CAD", billingDuration: "P1M", unitText: "kid" },
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
      { "@type": "Organization", name: brand.legalEntityName, url, email: brand.supportEmail },
    ],
  };
}
