import "server-only";
import { asLocale, type Locale } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { parseSubtasks } from "@/lib/schedule/checklist";
import { choreTextFor, translateChoreText } from "@/lib/translate";

/** The languages a home actually uses: its own, plus any language a kid's board is set to. */
export async function neededLocales(householdId: string): Promise<{ home: Locale; needed: Locale[] }> {
  const admin = createAdminClient();
  const [{ data: home }, { data: kids }] = await Promise.all([
    admin.from("households").select("locale").eq("id", householdId).single(),
    admin.from("kids").select("locale").eq("household_id", householdId).is("archived_at", null),
  ]);
  const homeLocale = asLocale(home?.locale);
  const needed = [...new Set([homeLocale, ...(kids ?? []).flatMap((k) => (k.locale ? [asLocale(k.locale)] : []))])];
  return { home: homeLocale, needed };
}

/**
 * Make sure every chore reads in every language this home uses. Runs in the background after a
 * kid's (or the home's) language changes; only chores missing one of those languages go to Claude.
 * `rebase`: the home language changed, so the parent's copy switches to the new home language too.
 */
export async function ensureChoreLanguages(householdId: string, opts: { rebase?: boolean } = {}): Promise<{ translated: number; missing: number }> {
  const { home, needed } = await neededLocales(householdId);
  if (needed.length < 2 && !opts.rebase) return { translated: 0, missing: 0 };
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("chores")
    .select("id, title, description, unit_label, note_for_kids, subtasks, translations")
    .eq("household_id", householdId)
    .limit(500);

  const base = (t: NonNullable<ReturnType<typeof choreTextFor>>) => ({
    title: t.title,
    description: t.description,
    unit_label: t.unit_label,
    note_for_kids: t.note_for_kids,
    ...(t.subtasks ? { subtasks: t.subtasks as unknown as { [k: string]: Json }[] } : {}),
  });

  let translated = 0;
  const missing = (rows ?? []).filter((r) => needed.some((l) => !choreTextFor(r.translations, l)));
  // Home language changed: chores that already have it just switch the parent's copy (no Claude call).
  if (opts.rebase) {
    for (const r of rows ?? []) {
      const mine = choreTextFor(r.translations, home);
      if (mine && !missing.includes(r)) await admin.from("chores").update(base(mine)).eq("household_id", householdId).eq("id", r.id);
    }
  }
  for (let i = 0; i < missing.length; i += 5) {
    const done = await Promise.all(
      missing.slice(i, i + 5).map(async (r) => {
        const steps = parseSubtasks(r.subtasks);
        const t = await translateChoreText({
          title: r.title,
          description: r.description || null,
          unit_label: r.unit_label || null,
          note_for_kids: r.note_for_kids || null,
          ...(steps.length ? { subtasks: steps } : {}),
        });
        if (!t) return false;
        const mine = t[home];
        const { error } = await admin
          .from("chores")
          .update({ ...(mine ? base(mine) : {}), translations: t as unknown as { [k: string]: Json } })
          .eq("household_id", householdId)
          .eq("id", r.id);
        return !error;
      }),
    );
    translated += done.filter(Boolean).length;
  }
  return { translated, missing: missing.length };
}

/**
 * A custom reward ("helped me carry the groceries") reads in the kid's language: when the kid's
 * board uses another language than the home, translate its name and description in the background.
 */
export async function translateReward(householdId: string, entryId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ledger_entries")
    .select("id, kid_id, title, note, kids(locale), households(locale)")
    .eq("household_id", householdId)
    .eq("id", entryId)
    .maybeSingle();
  if (!row?.title) return false;
  const kidLocale = row.kids?.locale ? asLocale(row.kids.locale) : null;
  if (!kidLocale || kidLocale === asLocale(row.households?.locale)) return false;
  const t = await translateChoreText({ title: row.title, description: row.note || null, unit_label: null, note_for_kids: null });
  if (!t) return false;
  const { error } = await admin.from("ledger_entries").update({ translations: t as unknown as Json }).eq("id", row.id);
  return !error;
}
