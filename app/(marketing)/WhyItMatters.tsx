import { marketing, type SiteLang } from "@/lib/i18n/marketing";

/** Why paid chores matter for kids: shown on the home page and next to the signup form. */
export function WhyItMatters({ compact = false, lang = "en" }: { compact?: boolean; lang?: SiteLang }) {
  const { why } = marketing(lang);
  if (compact) {
    return (
      <div className="mt-8">
        <h2 className="text-center font-display text-2xl font-bold text-ink">{why.title}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {why.reasons.map(([emoji, title, body]) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-card/70 p-4 ring-1 ring-line">
              <span className="text-3xl" aria-hidden>{emoji}</span>
              <span>
                <b className="block font-display text-lg text-ink">{title}</b>
                <span className="text-sm text-ink-soft">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <section className="py-12">
      <h2 className="text-center font-display text-4xl font-bold">{why.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-ink-soft">{why.lead}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {why.reasons.map(([emoji, title, body]) => (
          <div key={title} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
            <span className="text-4xl" aria-hidden>{emoji}</span>
            <h3 className="mt-3 font-display text-2xl font-bold">{title}</h3>
            <p className="mt-2 text-ink-soft">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
