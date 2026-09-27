import "server-only";
import { LOCALES, type Locale } from "@/lib/i18n";
import { MAX_SECTION_LABEL, MAX_SUBTASK_TITLE, sectionsOf, type Subtask } from "@/lib/schedule/checklist";

/** The chore text a kid reads. */
export interface ChoreText {
  title: string;
  description: string | null;
  unit_label: string | null;
  note_for_kids: string | null;
  /** Checklist steps ({id, title, section?}); ids never change between languages. */
  subtasks?: Subtask[];
}

export type ChoreTranslations = Partial<Record<Locale, ChoreText>>;

function apiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || null;
}

const SYSTEM = `You translate short chore cards for a kids' chore app (kids aged 5-14).
You receive a JSON object with the chore text written by a parent, in English, French, Spanish or Portuguese.
Reply with ONLY a JSON object, no prose, shaped exactly like:
{"en":{"title":...,"description":...,"unit_label":...,"note_for_kids":...},"fr":{...same keys...},"es":{...same keys...},"pt":{...same keys...}}
Rules:
- "en" = English, "fr" = French, "es" = Spanish, "pt" = Brazilian Portuguese.
- Detect which language the parent wrote in; keep the parent's text verbatim for that language and translate it into the three others.
- Simple, warm, kid-friendly wording. Canadian French is fine; use neutral Latin American Spanish and Brazilian Portuguese. Keep emojis, numbers and names as they are.
- null stays null. unit_label is a short singular noun (e.g. "floor" / "plancher" / "piso" / "andar").
- Title stays short (max 80 characters).
- If the input has "subtasks" (checklist steps, [{"id","title"}]) and "sections" (step group headings), also return, in every language,
  "subtasks": [{"id":...,"title":...}] with the same ids in the same order, and "sections": [...] in the same order.
  Keep each step short (max 80 characters) and each section short (max 40 characters); keep emojis at the start of sections.`;

/**
 * English, French, Spanish and Portuguese versions of a chore's text, via Claude. Returns null when no
 * key is configured or the call fails: saving a chore must never depend on it.
 */
export async function translateChoreText(text: ChoreText): Promise<ChoreTranslations | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(promptInput(text)) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("translateChoreText", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = body.content?.find((c) => c.type === "text")?.text ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    return sanitize(JSON.parse(json), text);
  } catch (e) {
    console.error("translateChoreText", e);
    return null;
  }
}

/** What Claude reads: subtasks without their sections, plus the unique section list. */
function promptInput(text: ChoreText) {
  const { subtasks, ...rest } = text;
  if (!subtasks?.length) return rest;
  return { ...rest, subtasks: subtasks.map((s) => ({ id: s.id, title: s.title })), sections: sectionsOf(subtasks) };
}

/** Translated steps, matched by id; a missing step or section keeps the parent's text. */
function sanitizeSubtasks(t: Record<string, unknown>, original: Subtask[]): Subtask[] {
  const titles = new Map<string, string>();
  if (Array.isArray(t.subtasks)) {
    for (const s of t.subtasks as Record<string, unknown>[]) {
      const title = s && typeof s.id === "string" ? str(s.title, MAX_SUBTASK_TITLE) : null;
      if (title) titles.set(s.id as string, title);
    }
  }
  const sections = sectionsOf(original);
  const trSections = Array.isArray(t.sections) ? t.sections : [];
  return original.map((s) => {
    const title = titles.get(s.id) ?? s.title;
    if (!s.section) return { id: s.id, title };
    return { id: s.id, title, section: str(trSections[sections.indexOf(s.section)], MAX_SECTION_LABEL) ?? s.section };
  });
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function sanitize(parsed: unknown, original: ChoreText): ChoreTranslations | null {
  if (!parsed || typeof parsed !== "object") return null;
  const out: ChoreTranslations = {};
  for (const l of LOCALES) {
    const t = (parsed as Record<string, Record<string, unknown> | undefined>)[l];
    if (!t) return null;
    const title = str(t.title, 80);
    if (!title) return null;
    out[l] = {
      title,
      description: original.description ? str(t.description, 400) : null,
      unit_label: original.unit_label ? str(t.unit_label, 30) : null,
      note_for_kids: original.note_for_kids ? str(t.note_for_kids, 200) : null,
      ...(original.subtasks?.length ? { subtasks: sanitizeSubtasks(t, original.subtasks) } : {}),
    };
  }
  return out;
}

/** The text to show in `locale`, if the chore has a stored translation for it. */
export function choreTextFor(translations: unknown, locale: Locale): ChoreText | null {
  if (!translations || typeof translations !== "object") return null;
  const t = (translations as ChoreTranslations)[locale];
  return t && typeof t.title === "string" ? t : null;
}
