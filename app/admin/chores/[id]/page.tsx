import { notFound } from "next/navigation";
import { z } from "zod";
import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { PageHeader } from "@/components/ui";
import { asClaimWindow } from "@/lib/schedule/claims";
import { parseSubtasks } from "@/lib/schedule/checklist";
import { ChorePageEditor } from "./ChorePageEditor";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.chores.editChore") };
}

export default async function ChorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireParent();
  const [{ data: chore }, { data: assignees }, { data: kids }] = await Promise.all([
    ctx.supabase.from("chores").select("*").eq("household_id", ctx.household.id).eq("id", id).maybeSingle(),
    ctx.supabase.from("chore_assignees").select("kid_id").eq("chore_id", id),
    ctx.supabase.from("kids").select("id, name, color").eq("household_id", ctx.household.id).is("archived_at", null).order("sort_order"),
  ]);
  if (!chore) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={chore.title} />
      <ChorePageEditor
        chore={{
          ...chore,
          repeat_kind: chore.repeat_kind as "once" | "daily" | "weekly" | "every_n_days",
          scope: chore.scope as "household" | "per_kid",
          assignee_ids: (assignees ?? []).map((a) => a.kid_id),
          subtasks: parseSubtasks(chore.subtasks),
          claim_window: asClaimWindow(chore.claim_window),
        }}
        kids={kids ?? []}
      />
    </div>
  );
}
