// SEO landing pages: real, useful content for what parents search for.

export interface SeoSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface SeoPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: SeoSection[];
  faq: [string, string][];
}

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "chore-chart-app",
    title: "Chore Chart App for Kids (iPad & tablet)",
    description:
      "A chore chart app that lives on the kitchen tablet. Kids tap their face, pick a chore card and mark it done; parents approve from their phone. First kid free.",
    h1: "A chore chart app your kids will actually use",
    intro:
      "Paper chore charts get ignored, and chore apps built for phones don't work for younger kids. Chore Board turns the family tablet into a big, colorful chore chart: kids tap their face, see their chores as cards, and tap “I did it!”. You check it from your phone.",
    sections: [
      {
        heading: "Why a tablet chore chart works better",
        bullets: [
          "It's always in the kitchen: no hunting for a phone or a login.",
          "Kids never type a password: they tap their own face.",
          "Big cards with emoji and prices, readable for 6-year-olds.",
          "It returns to “Who's here?” after 90 seconds, so siblings don't mix up.",
        ],
      },
      {
        heading: "Chores that disappear and come back on schedule",
        paragraphs: [
          "Once a chore is done it leaves the board and returns on its own: daily, weekly, or every N days (baseboards every 14 days, garbage every Monday). Kids see a “Coming back soon” row, so they know more money is on the way.",
          "Whole-house chores go to the first kid who taps them, and the card disappears for everyone else immediately. Personal chores (like tidying your own closet) can be done by each kid.",
        ],
      },
      {
        heading: "Parents stay in control",
        bullets: [
          "Approve, or send it back with “Missed a spot”; the kid sees it under “Needs fixing”.",
          "Pay per unit: $5 per floor, up to 3 floors. Adjust the quantity before approving.",
          "Pause chores, set seasonal ones (fall garden clean-up), or assign a chore to one kid.",
        ],
      },
    ],
    faq: [
      ["Does it work on an iPad?", "Yes. It's built for iPad in landscape and works on Android tablets too. Add it to the home screen and it opens full-screen like an app."],
      ["How much is it?", "Your first kid is free forever. Each additional kid is $5 CAD per month."],
    ],
  },
  {
    slug: "allowance-app-for-kids",
    title: "Allowance App for Kids: Track Earnings & Payouts",
    description:
      "An allowance tracker where kids earn money for chores. Every approved chore adds to their balance; record cash payouts or savings deposits. First kid free.",
    h1: "An allowance app that ties money to effort",
    intro:
      "Instead of a flat weekly allowance, many families pay for extra chores. Chore Board keeps a running balance for each kid: approved chores add money, payouts subtract it, and kids always see what's in their bank and what's “waiting for check”.",
    sections: [
      {
        heading: "How the allowance ledger works",
        bullets: [
          "Each approved chore adds an earning to the kid's balance.",
          "Record payouts as cash, bank deposit or savings account.",
          "Optional savings match: add 50¢ for every $1 they earn.",
          "Every entry is permanent. Corrections are separate adjustments, so the history always adds up.",
        ],
      },
      {
        heading: "Teaching money, not just chores",
        paragraphs: [
          "Kids see two numbers: money in their bank and money waiting for a parent's check. That gap teaches that work gets reviewed before it pays, and the “Needs fixing” loop teaches doing it right the first time.",
        ],
      },
      {
        heading: "No real money moves",
        paragraphs: [
          "Chore Board is a ledger, not a bank. You hand over cash or transfer to their savings account yourself and record it in a tap. Kids have no accounts and no email.",
        ],
      },
    ],
    faq: [
      ["Can I export the history?", "Yes. Export every chore, earning and payout as a CSV file at any time."],
      ["Can both parents record payouts?", "Yes. Invite a co-parent by email; both can approve chores and record payouts."],
    ],
  },
  {
    slug: "paid-chores-list",
    title: "Paid Chores List: How Much to Pay Kids for Chores",
    description:
      "A practical list of paid chores for kids with suggested prices, from shoe organizing ($2) to cleaning the terrace ($10), and how often each should repeat.",
    h1: "Paid chores list, with prices that work",
    intro:
      "These are the extra chores (beyond everyday responsibilities) a real family pays for, with prices in CAD and how often each one comes back. Use them as a starting point; every price is editable in Chore Board.",
    sections: [
      {
        heading: "Suggested chores and prices",
        table: {
          head: ["Chore", "Price", "Repeats"],
          rows: [
            ["Entryway shoe station", "$2", "Weekly"],
            ["Garbage boss (all bins + curbside)", "$5", "Weekly"],
            ["Laundry manager (wash, fold, deliver)", "$5", "Weekly"],
            ["Switches, handles & remotes", "$5 per floor", "Weekly"],
            ["Sous-chef night", "$5", "Weekly, each kid"],
            ["Bathroom deep clean", "$7", "Weekly"],
            ["Car mats & vacuum", "$5", "Every 14 days"],
            ["Garage sweep", "$5", "Every 14 days"],
            ["Baseboards", "$5 per floor", "Every 14 days"],
            ["Kitchen cabinets", "$5", "Every 14 days"],
            ["Clean the barbecue", "$8", "Every 14 days"],
            ["Clean the terrace", "$10", "Every 14 days"],
            ["Basement toy audit", "$6", "Every 90 days"],
            ["Garden close-down", "$8", "Once, in the fall"],
            ["Summer wrap-up", "$10", "Once, in the fall"],
            ["Winter closet swap", "$6", "Once, each kid"],
          ],
        },
      },
      {
        heading: "Tips for pricing chores",
        bullets: [
          "Price by effort and time: roughly $5 for a 20–30 minute job.",
          "Pay per unit for big jobs: $5 per floor lets a kid do one floor or all three.",
          "Use cooldowns so high-paying chores can't be farmed every day.",
          "Describe “done” clearly (“every baseboard, with a wet towel”) so reviews are fair.",
        ],
      },
    ],
    faq: [
      ["Should chores be paid at all?", "Many families keep everyday tasks unpaid and pay for extra jobs. The list above is extra chores only."],
      ["Can I change the prices?", "Yes. Every chore and price is editable, and you can add your own."],
    ],
  },
];
