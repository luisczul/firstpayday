import { billingEnabled } from "@/lib/billing/plans";
import { brand } from "@/lib/brand";
import { appUrl } from "@/lib/env";
import { localePath, marketing, type SiteLang } from "@/lib/i18n/marketing";

/** Home-page FAQ in a language (the cost answer follows the billing switch). */
export function faqFor(lang: SiteLang): [string, string][] {
  const m = marketing(lang);
  return [[m.faqCost.q, billingEnabled() ? m.faqCost.paid : m.faqCost.free], ...m.faq];
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function faqJsonLd(lang: SiteLang, faq: [string, string][]) {
  return {
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export function landingJsonLd(lang: SiteLang = "en") {
  const base = appUrl();
  const url = `${base}${localePath(lang, "/")}`;
  const offers = billingEnabled()
    ? [
        { "@type": "Offer", name: "First kid", price: "0", priceCurrency: "CAD" },
        {
          "@type": "Offer",
          name: "Each additional kid",
          price: "5.00",
          priceCurrency: "CAD",
          priceSpecification: { "@type": "UnitPriceSpecification", price: "5.00", priceCurrency: "CAD", billingDuration: "P1M", unitText: "kid" },
        },
      ]
    : [{ "@type": "Offer", price: "0", priceCurrency: "CAD" }];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: brand.name,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, iPad, Android tablet",
        inLanguage: ["en", "fr", "es", "pt-BR"],
        url,
        description: marketing(lang).jsonLdDescription,
        offers,
      },
      faqJsonLd(lang, faqFor(lang)),
      { "@type": "Organization", name: brand.legalEntityName, url: base, email: brand.supportEmail },
    ],
  };
}
