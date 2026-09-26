import { notFound, redirect } from "next/navigation";
import { getParentContext, getUser } from "@/lib/auth/session";
import { HomeStep } from "./HomeStep";
import { KidsStep } from "./KidsStep";
import { ChoresStep } from "./ChoresStep";
import { TabletStep } from "./TabletStep";

const STEPS = ["home", "kids", "chores", "tablet"] as const;
type Step = (typeof STEPS)[number];

export default async function OnboardingStep({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!STEPS.includes(step as Step)) notFound();
  const { user } = await getUser();
  if (!user) redirect("/signup");
  const ctx = await getParentContext();
  if (!ctx && step !== "home") redirect("/onboarding/home");

  const index = STEPS.indexOf(step as Step);
  return (
    <div className="mx-auto mt-6">
      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={`h-2 flex-1 rounded-full ${i <= index ? "bg-maple" : "bg-line"}`} aria-current={i === index ? "step" : undefined} />
        ))}
      </ol>
      {step === "home" ? (
        <HomeStep
          initial={ctx ? { name: ctx.household.name, timezone: ctx.household.timezone, currency: ctx.household.currency, locale: ctx.locale } : null}
        />
      ) : null}
      {step === "kids" && ctx ? <KidsLoader /> : null}
      {step === "chores" && ctx ? <ChoresLoader /> : null}
      {step === "tablet" && ctx ? <TabletStep /> : null}
    </div>
  );
}

async function KidsLoader() {
  const ctx = (await getParentContext())!;
  const { data: kids } = await ctx.supabase
    .from("kids")
    .select("id, name, color")
    .eq("household_id", ctx.household.id)
    .is("archived_at", null)
    .order("sort_order");
  return <KidsStep existing={kids ?? []} />;
}

async function ChoresLoader() {
  const ctx = (await getParentContext())!;
  const [{ data: templates }, { data: chores }] = await Promise.all([
    ctx.supabase.from("chore_templates").select("*").eq("locale", ctx.household.locale).order("sort_order"),
    ctx.supabase.from("chores").select("template_key").eq("household_id", ctx.household.id),
  ]);
  const existing = (chores ?? []).map((c) => c.template_key).filter((k): k is string => Boolean(k));
  return (
    <ChoresStep
      templates={templates ?? []}
      existingKeys={existing}
      currency={ctx.household.currency}
      locale={ctx.locale}
    />
  );
}
