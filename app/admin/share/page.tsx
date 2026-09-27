import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { Card, PageHeader } from "@/components/ui";
import { SettingsNav } from "../settings/SettingsNav";
import { ShareForm } from "./ShareForm";
import { SentList } from "./SentList";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("c.share.title") };
}

export default async function SharePage() {
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const { data: sent } = await ctx.supabase
    .from("share_invites")
    .select("id, email, sent_at, last_sent_at, send_count, joined_at")
    .eq("household_id", ctx.household.id)
    .order("last_sent_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title={t("c.share.title")} subtitle={t("c.share.subtitle")} />
      <SettingsNav active="/admin/share" locale={ctx.locale} />
      <Card className="mb-6">
        <p className="mb-5 rounded-2xl bg-paper p-4 text-ink">{t("c.share.intro")}</p>
        <ShareForm defaultName={ctx.membership.display_name ?? ""} defaultLocale={ctx.locale} />
      </Card>
      <section>
        <h2 className="mb-3 font-display text-2xl font-bold">{t("c.share.listTitle")}</h2>
        <SentList rows={sent ?? []} />
      </section>
    </>
  );
}
