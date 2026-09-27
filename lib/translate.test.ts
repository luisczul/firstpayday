import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { choreTextFor, translateChoreText } = await import("./translate");

const reply = (text: string, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("translateChoreText", () => {
  const input = { title: "Ranger le garage", description: "Mets les vélos contre le mur.", unit_label: null, note_for_kids: null };

  const four =
    'Here: {"en":{"title":"Tidy the garage","description":"Put the bikes against the wall.","unit_label":"x","note_for_kids":null},' +
    '"fr":{"title":"Ranger le garage","description":"Mets les vélos contre le mur.","unit_label":null,"note_for_kids":null},' +
    '"es":{"title":"Ordena el garaje","description":"Pon las bicis contra la pared.","unit_label":null,"note_for_kids":null},' +
    '"pt":{"title":"Arrume a garagem","description":"Coloque as bicicletas encostadas na parede.","unit_label":null,"note_for_kids":null}}';

  it("returns all four languages from Claude's JSON", async () => {
    vi.stubEnv("ANTHROPIC_KEY", "test");
    const fetch = reply(four);
    vi.stubGlobal("fetch", fetch);
    const t = await translateChoreText(input);
    expect(t?.en).toEqual({ title: "Tidy the garage", description: "Put the bikes against the wall.", unit_label: null, note_for_kids: null });
    expect(t?.fr?.title).toBe("Ranger le garage");
    expect(t?.es?.title).toBe("Ordena el garaje");
    expect(t?.pt).toEqual({ title: "Arrume a garagem", description: "Coloque as bicicletas encostadas na parede.", unit_label: null, note_for_kids: null });
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.system).toMatch(/Spanish/);
    expect(body.system).toMatch(/Portuguese/);
  });

  it("rejects a reply missing Spanish or Portuguese", async () => {
    vi.stubEnv("ANTHROPIC_KEY", "test");
    vi.stubGlobal(
      "fetch",
      reply('{"en":{"title":"Tidy"},"fr":{"title":"Ranger"},"es":{"title":"Ordena"}}'),
    );
    expect(await translateChoreText(input)).toBeNull();
    vi.stubGlobal("fetch", reply('{"en":{"title":"Tidy"},"fr":{"title":"Ranger"},"es":{"title":""},"pt":{"title":"Arrume"}}'));
    expect(await translateChoreText(input)).toBeNull();
  });

  it("never blocks a save: no key, HTTP error, or junk all give null", async () => {
    vi.stubEnv("ANTHROPIC_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await translateChoreText(input)).toBeNull();
    vi.stubEnv("ANTHROPIC_KEY", "test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply("", 500));
    expect(await translateChoreText(input)).toBeNull();
    vi.stubGlobal("fetch", reply("sorry"));
    expect(await translateChoreText(input)).toBeNull();
    vi.stubGlobal("fetch", reply('{"en":{"title":""},"fr":{"title":"x"}}'));
    expect(await translateChoreText(input)).toBeNull();
  });
});

describe("translateChoreText with subtasks", () => {
  const input = {
    title: "Routine du soir",
    description: null,
    unit_label: null,
    note_for_kids: null,
    subtasks: [
      { id: "teeth", title: "Brosse-toi les dents", section: "🌅 Matin" },
      { id: "bath", title: "Prends ton bain", section: "🌙 Soir" },
      { id: "story", title: "L'heure du conte" },
    ],
  };
  const lang = (title: string, subs: string, sections: string) => `{"title":"${title}","description":null,"unit_label":null,"note_for_kids":null,"subtasks":${subs},"sections":${sections}}`;

  it("sends steps and sections, and translates them by id in all four languages", async () => {
    vi.stubEnv("ANTHROPIC_KEY", "test");
    const fetch = reply(
      `{"en":${lang("Evening routine", '[{"id":"teeth","title":"Brush your teeth"},{"id":"bath","title":"Take a bath"},{"id":"story","title":"Story time"}]', '["🌅 Morning","🌙 Evening"]')},` +
        `"fr":${lang("Routine du soir", '[{"id":"teeth","title":"Brosse-toi les dents"},{"id":"bath","title":"Prends ton bain"},{"id":"story","title":"L\'heure du conte"}]', '["🌅 Matin","🌙 Soir"]')},` +
        `"es":${lang("Rutina de la noche", '[{"id":"bath","title":"Báñate"},{"id":"story","title":"Hora del cuento"},{"id":"zzz","title":"extra"}]', '["🌅 Mañana"]')},` +
        `"pt":${lang("Rotina da noite", '"junk"', "null")}}`,
    );
    vi.stubGlobal("fetch", fetch);
    const t = await translateChoreText(input);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const sent = JSON.parse(body.messages[0].content);
    expect(sent.subtasks).toEqual([
      { id: "teeth", title: "Brosse-toi les dents" },
      { id: "bath", title: "Prends ton bain" },
      { id: "story", title: "L'heure du conte" },
    ]);
    expect(sent.sections).toEqual(["🌅 Matin", "🌙 Soir"]);
    expect(body.system).toMatch(/subtasks/);
    expect(t?.en?.subtasks).toEqual([
      { id: "teeth", title: "Brush your teeth", section: "🌅 Morning" },
      { id: "bath", title: "Take a bath", section: "🌙 Evening" },
      { id: "story", title: "Story time" },
    ]);
    // Missing step or section: the parent's text stays; unknown ids are ignored.
    expect(t?.es?.subtasks).toEqual([
      { id: "teeth", title: "Brosse-toi les dents", section: "🌅 Mañana" },
      { id: "bath", title: "Báñate", section: "🌙 Soir" },
      { id: "story", title: "Hora del cuento" },
    ]);
    expect(t?.pt?.subtasks).toEqual(input.subtasks);
  });

  it("does not send or return subtasks for a plain chore", async () => {
    vi.stubEnv("ANTHROPIC_KEY", "test");
    const fetch = reply(`{"en":${lang("A", "[]", "[]")},"fr":${lang("B", "[]", "[]")},"es":${lang("C", "[]", "[]")},"pt":${lang("D", "[]", "[]")}}`);
    vi.stubGlobal("fetch", fetch);
    const t = await translateChoreText({ ...input, subtasks: [] });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.parse(body.messages[0].content).subtasks).toBeUndefined();
    expect(t?.en).toEqual({ title: "A", description: null, unit_label: null, note_for_kids: null });
  });
});

describe("choreTextFor", () => {
  it("picks the kid's language when saved", () => {
    const tr = { fr: { title: "Laver le chien", description: null, unit_label: null, note_for_kids: null } };
    expect(choreTextFor(tr, "fr")?.title).toBe("Laver le chien");
    expect(choreTextFor(tr, "en")).toBeNull();
    expect(choreTextFor({}, "fr")).toBeNull();
    expect(choreTextFor(null, "fr")).toBeNull();
    const all = { es: { title: "Lava al perro", description: null, unit_label: null, note_for_kids: null }, pt: { title: "Dê banho no cachorro", description: null, unit_label: null, note_for_kids: null } };
    expect(choreTextFor(all, "es")?.title).toBe("Lava al perro");
    expect(choreTextFor(all, "pt")?.title).toBe("Dê banho no cachorro");
  });
});
