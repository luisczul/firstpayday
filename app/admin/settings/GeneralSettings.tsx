"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteHousehold, updateHouseholdSettings } from "@/app/actions/household";
import { setMyDisplayName, setMyPin } from "@/app/actions/members";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type Household = {
  name: string;
  timezone: string;
  currency: string;
  locale: "en" | "fr";
  week_starts_on: number;
  admin_timeout_minutes: number;
  kid_idle_seconds: number;
  savings_match_percent: number;
  theme: "fall" | "plain";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function GeneralSettings(props: {
  household: Household;
  displayName: string;
  email: string;
  hasPin: boolean;
  isOwner: boolean;
  readOnly: boolean;
  canMatch: boolean;
  canTheme: boolean;
}) {
  const [h, setH] = useState(props.household);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [h.timezone];
    }
  }, [h.timezone]);
  const set = <K extends keyof Household>(k: K, v: Household[K]) => setH((x) => ({ ...x, [k]: v }));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateHouseholdSettings(h);
              setMsg(r.ok ? { tone: "good", text: "Saved" } : { tone: "bad", text: r.message });
            });
          }}
        >
          <fieldset disabled={props.readOnly} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Household name">
              <Input value={h.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Timezone">
              <Select value={h.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={h.currency} onChange={(e) => set("currency", e.target.value)}>
                {["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "MXN"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Language">
              <Select value={h.locale} onChange={(e) => set("locale", e.target.value as "en" | "fr")}>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </Select>
            </Field>
            <Field label="Week starts on" hint="Weekly chores come back at 00:00 on this day.">
              <Select value={h.week_starts_on} onChange={(e) => set("week_starts_on", Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Theme">
              <Select value={h.theme} onChange={(e) => set("theme", e.target.value as "fall" | "plain")}>
                <option value="fall">🍂 Fall</option>
                <option value="plain" disabled={!props.canTheme}>Plain{props.canTheme ? "" : " (Family Plus)"}</option>
              </Select>
            </Field>
            <Field label="Admin timeout on the kids' tablet (minutes)">
              <Input type="number" min={1} max={240} value={h.admin_timeout_minutes} onChange={(e) => set("admin_timeout_minutes", Number(e.target.value))} />
            </Field>
            <Field label="Kid idle timeout (seconds)" hint="Board returns to “Who's here?” after this.">
              <Input type="number" min={15} max={900} value={h.kid_idle_seconds} onChange={(e) => set("kid_idle_seconds", Number(e.target.value))} />
            </Field>
            <Field label="Savings match %" hint={props.canMatch ? "0 = off. 50 means +$0.50 for every $1 earned." : "Family Plus feature."}>
              <Input type="number" min={0} max={200} value={h.savings_match_percent} disabled={!props.canMatch} onChange={(e) => set("savings_match_percent", Number(e.target.value))} />
            </Field>
            <div className="flex items-end gap-3 md:col-span-2">
              <Button type="submit" disabled={pending}>Save settings</Button>
              {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
            </div>
          </fieldset>
        </form>
      </Card>

      <MeCard displayName={props.displayName} email={props.email} hasPin={props.hasPin} />

      {props.isOwner ? <DangerZone name={props.household.name} /> : null}
    </div>
  );
}

function MeCard({ displayName, email, hasPin }: { displayName: string; email: string; hasPin: boolean }) {
  const [name, setName] = useState(displayName);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="mb-1 font-display text-xl font-bold">You</h2>
      <p className="mb-4 text-sm text-ink-soft">{email}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setMyDisplayName(name);
              setMsg(r.ok ? { tone: "good", text: "Name saved" } : { tone: "bad", text: r.message });
            });
          }}
        >
          <Field label="Your name (shown on the tablet PIN pad)">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mom, Dad, Cami…" maxLength={40} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
        </form>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setMyPin(pin);
              setPin("");
              setMsg(r.ok ? { tone: "good", text: pin ? "PIN set" : "PIN removed" } : { tone: "bad", text: r.message });
            });
          }}
        >
          <Field label={`Parent PIN ${hasPin ? "(set)" : "(optional)"}`} hint="4–6 digits to unlock the kids' tablet faster. Leave empty to remove.">
            <Input inputMode="numeric" pattern="\d{4,6}|" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••" autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>{pin ? "Set PIN" : hasPin ? "Remove" : "Set PIN"}</Button>
        </form>
      </div>
      {msg ? <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
    </Card>
  );
}

function DangerZone({ name }: { name: string }) {
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="ring-danger/40">
      <h2 className="font-display text-xl font-bold text-danger">Danger zone</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Deleting the household permanently removes every kid, chore, submission and ledger entry. Export your history first if you want a copy.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await deleteHousehold(confirm);
            if (r && !r.ok) setMsg(r.message);
          });
        }}
      >
        <Field label={`Type “${name}” to confirm`}>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="danger" disabled={pending || confirm !== name}>Delete household</Button>
      </form>
      {msg ? <div className="mt-3"><Alert tone="bad">{msg}</Alert></div> : null}
    </Card>
  );
}
