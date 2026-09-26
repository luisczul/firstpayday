import Link from "next/link";
import { brand } from "@/lib/brand";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { SiteFooter, SiteHeader } from "./SiteChrome";

const DEMO_CARDS = [
  { emoji: "🧽", title: "Baseboards", price: "$5 / floor", color: "#B8431F", badge: "✨ NEW!" },
  { emoji: "🚗", title: "Car mats & vacuum", price: "$5", color: "#E08A1E" },
  { emoji: "🍖", title: "Clean the barbecue", price: "$8", color: "#7A3B4A" },
  { emoji: "🧺", title: "Laundry manager", price: "$5", color: "#6B7A2E" },
];

function TabletMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-[2.2rem] bg-ink p-3 shadow-[var(--shadow-pop)]" aria-label="The kids' board on a tablet">
      <div className="paper-texture overflow-hidden rounded-[1.6rem] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber font-display text-2xl font-bold text-white ring-4 ring-card">M</span>
          <span className="font-display text-3xl font-bold text-ink">Mateo</span>
          <span className="ml-auto rounded-2xl bg-card px-4 py-1.5 text-right shadow-[var(--shadow-card)]">
            <span className="block font-display text-2xl font-bold text-moss">$42.00</span>
            <span className="block text-xs font-bold text-amber">$12.00 waiting for check</span>
          </span>
        </div>
        <p className="mb-2 font-display text-xl font-bold text-maple">✨ New!</p>
        <div className="flex gap-3 overflow-hidden">
          {DEMO_CARDS.map((c) => (
            <div key={c.title} className="relative h-40 w-36 shrink-0 overflow-hidden rounded-2xl bg-card p-3 pl-5 shadow-[var(--shadow-card)] ring-1 ring-line">
              <span className="absolute inset-y-0 left-0 w-2" style={{ background: c.color }} />
              <span className="absolute top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-xs font-black">{c.price}</span>
              <span className="mt-6 block text-3xl">{c.emoji}</span>
              <span className="mt-1 block font-display text-base leading-tight font-bold">{c.title}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <span className="rounded-2xl bg-moss px-6 py-2.5 text-lg font-black text-white shadow-[0_4px_0_#4a5620]">I did it! ✅</span>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  ["Do my kids need an account or email?", "No. Kids never log in and never type anything. They tap their face on the family tablet. Only parents have accounts."],
  ["Does it move real money?", "No. It's a ledger: it tracks what each kid earned and what you paid out in cash or to their savings account."],
  ["What if two kids tap the same chore?", "House chores go to whoever taps first, and the card disappears for everyone else right away."],
  ["Can my partner approve chores too?", "Yes. Invite a co-parent by email and approve from any phone or computer."],
  ["What happens after the free trial?", "Nothing is deleted. The board goes read-only until you pick a plan: kids can still see their balances."],
  ["Where is my data stored?", "In Canada. You can export or delete everything at any time."],
];

export function Landing() {
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
          <div>
            <h1 className="font-display text-5xl leading-[1.05] font-extrabold text-ink md:text-6xl">
              Paid chores, <span className="text-maple">on the kitchen tablet.</span>
            </h1>
            <p className="mt-5 text-xl text-ink-soft">
              Kids tap their face, pick a chore card and hit “I did it!”. You approve from your phone. The money lands in their bank. No passwords, no arguments about who did what.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-full bg-maple px-7 py-4 text-lg font-black text-white shadow-[0_4px_0_#8a3217]">Start your free trial</Link>
              <Link href="/pricing" className="rounded-full bg-card px-7 py-4 text-lg font-black text-ink ring-1 ring-line">See pricing</Link>
            </div>
            <p className="mt-3 text-sm text-ink-soft">14 days free · no credit card · set up in 3 minutes</p>
          </div>
          <TabletMockup />
        </section>

        <section className="py-12">
          <h2 className="text-center font-display text-4xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["👧👦", "Add your kids", "A first name and an optional photo. That's it."],
              ["🧹", "Pick chores", "Start from ready-made chores, set your prices and how often they come back."],
              ["✅", "Kids tap, you approve, they save", "Approve or send it back with a note. Balances update live."],
            ].map(([emoji, title, body], i) => (
              <div key={title} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
                <span className="text-4xl">{emoji}</span>
                <p className="mt-3 text-sm font-black text-amber">STEP {i + 1}</p>
                <h3 className="font-display text-2xl font-bold">{title}</h3>
                <p className="mt-2 text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 py-12 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["🌙", "Chores come back on schedule", "Baseboards every 14 days, garbage every week. Done cards disappear and come back on their own."],
            ["🛠", "“Needs fixing” loop", "Send a chore back with “Missed a spot”. Your kid sees it and taps “Fixed it!”."],
            ["💵", "Payouts & savings match", "Record cash or savings deposits. Optionally match what they save."],
            ["🔒", "Kid-proof tablet", "No text boxes, big buttons, auto-return to “Who's here?” so siblings don't mix up."],
            ["📱", "Approve from anywhere", "Parents get a live approval queue on any phone, tablet or computer."],
            ["🇨🇦", "English & français", "Built in both languages. Data stored in Canada."],
          ].map(([emoji, title, body]) => (
            <div key={title} className="rounded-3xl bg-card/70 p-6 ring-1 ring-line">
              <span className="text-3xl">{emoji}</span>
              <h3 className="mt-2 font-display text-xl font-bold">{title}</h3>
              <p className="mt-1 text-ink-soft">{body}</p>
            </div>
          ))}
        </section>

        <section className="py-12 text-center">
          <h2 className="font-display text-4xl font-bold">Simple pricing</h2>
          <p className="mt-3 text-lg text-ink-soft">
            Family from ${(PLAN_PRICES.family.monthly / 100).toFixed(2)}/month · Family Plus from ${(PLAN_PRICES.family_plus.monthly / 100).toFixed(2)}/month (CAD, + tax)
          </p>
          <Link href="/pricing" className="mt-5 inline-block font-black text-maple underline">Compare plans →</Link>
        </section>

        <section className="mx-auto max-w-3xl py-12">
          <h2 className="mb-6 text-center font-display text-4xl font-bold">Questions</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-2xl bg-card p-5 ring-1 ring-line">
                <summary className="cursor-pointer font-bold">{q}</summary>
                <p className="mt-2 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="my-10 rounded-[2rem] bg-maple px-6 py-12 text-center text-white">
          <h2 className="font-display text-4xl font-bold">Turn chores into their first paycheck.</h2>
          <Link href="/signup" className="mt-6 inline-block rounded-full bg-gold px-8 py-4 text-lg font-black text-ink">Start free trial</Link>
          <p className="mt-3 text-sm text-white/80">{brand.name} · 14 days free</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
