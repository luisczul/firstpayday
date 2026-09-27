"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteHousehold, updateHouseholdSettings } from "@/app/actions/household";
import { setMyDisplayName, setMyPin, setMyReviewEmails, setMyWeeklyReport } from "@/app/actions/members";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { Stepper } from "@/components/ui/Stepper";
import { FamilyTaxCard } from "@/components/admin/FamilyTaxCard";
import { LOCALES, LOCALE_NAMES, weekdayName, type Locale } from "@/lib/i18n";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";

type Household = {
  name: string;
  timezone: string;
  currency: string;
  locale: Locale;
  week_starts_on: number;
  admin_timeout_minutes: number | null;
  kid_idle_seconds: number | null;
  savings_match_percent: number | null;
  theme: "fall" | "plain";
  weekly_report_dow: number;
  weekly_report_hour: number;
};

const WEEK = [0, 1, 2, 3, 4, 5, 6];

export function GeneralSettings(props: {
  household: Household;
  displayName: string;
  email: string;
  hasPin: boolean;
  reviewEmails: boolean;
  weeklyReport: boolean;
  isOwner: boolean;
  readOnly: boolean;
  canMatch: boolean;
  canTheme: boolean;
  familyTax: { enabled: boolean; percent: number };
}) {
  const t = useParentT();
  const uiLocale = useParentLocale();
  const days = WEEK.map((i) => weekdayName(uiLocale, i));
  const hours = Array.from({ length: 24 }, (_, hr) =>
    hr === 0
      ? t("b.general.hourMidnight")
      : hr === 12
        ? t("b.general.hourNoon")
        : hr < 12
          ? t("b.general.hourAm", { h: hr, h24: hr })
          : t("b.general.hourPm", { h: hr - 12, h24: hr }),
  );
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
            if (h.admin_timeout_minutes === null || h.kid_idle_seconds === null || h.savings_match_percent === null) {
              return setMsg({ tone: "bad", text: t("b.general.fillNumbers") });
            }
            const values = { ...h, admin_timeout_minutes: h.admin_timeout_minutes, kid_idle_seconds: h.kid_idle_seconds, savings_match_percent: h.savings_match_percent };
            start(async () => {
              const r = await updateHouseholdSettings(values);
              setMsg(r.ok ? { tone: "good", text: t("b.common.saved") } : { tone: "bad", text: r.message });
            });
          }}
        >
          <fieldset disabled={props.readOnly} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t("b.general.householdName")}>
              <Input value={h.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
            </Field>
            <Field label={t("b.general.timezone")}>
              <Select value={h.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label={t("b.general.currency")}>
              <Select value={h.currency} onChange={(e) => set("currency", e.target.value)}>
                {["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "MXN", "BRL"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={t("b.general.language")}>
              <Select value={h.locale} onChange={(e) => set("locale", e.target.value as Locale)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("b.general.weekStarts")} hint={t("b.general.weekStartsHint")}>
              <Select value={h.week_starts_on} onChange={(e) => set("week_starts_on", Number(e.target.value))}>
                {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </Select>
            </Field>
            <Field label={t("b.general.theme")}>
              <Select value={h.theme} onChange={(e) => set("theme", e.target.value as "fall" | "plain")}>
                <option value="fall">{t("b.general.themeFall")}</option>
                <option value="plain" disabled={!props.canTheme}>{t("b.general.themePlain")}{props.canTheme ? "" : t("b.general.familyPlusTag")}</option>
              </Select>
            </Field>
            <Field label={t("b.general.adminTimeout")}>
              <Stepper label={t("b.general.adminTimeoutStepper")} min={1} max={240} value={h.admin_timeout_minutes} onChange={(v) => set("admin_timeout_minutes", v)} />
            </Field>
            <Field label={t("b.general.kidIdle")} hint={t("b.general.kidIdleHint")}>
              <Stepper label={t("b.general.kidIdleStepper")} min={15} max={900} value={h.kid_idle_seconds} onChange={(v) => set("kid_idle_seconds", v)} />
            </Field>
            <Field label={t("b.general.savingsMatch")} hint={props.canMatch ? t("b.general.savingsMatchHint") : t("b.general.familyPlusFeature")}>
              <Stepper label={t("b.general.savingsMatchStepper")} min={0} max={200} value={h.savings_match_percent} disabled={!props.canMatch} onChange={(v) => set("savings_match_percent", v)} />
            </Field>
            <Field label={t("b.general.weeklyReport")} hint={t("b.general.weeklyReportHint")}>
              <div className="flex items-center gap-2">
                <Select aria-label={t("b.general.weeklyDay")} className="min-w-0 flex-1" value={h.weekly_report_dow} onChange={(e) => set("weekly_report_dow", Number(e.target.value))}>
                  {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </Select>
                <span className="shrink-0 font-semibold text-ink-soft">{t("b.general.at")}</span>
                <Select aria-label={t("b.general.weeklyHour")} className="min-w-0 flex-1" value={h.weekly_report_hour} onChange={(e) => set("weekly_report_hour", Number(e.target.value))}>
                  {hours.map((label, i) => <option key={i} value={i}>{label}</option>)}
                </Select>
              </div>
            </Field>
            <div className="flex items-end gap-3 md:col-span-2">
              <Button type="submit" disabled={pending}>{t("b.general.saveSettings")}</Button>
              {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
            </div>
          </fieldset>
        </form>
      </Card>

      <FamilyTaxCard initial={props.familyTax} currency={h.currency} locale={h.locale} readOnly={props.readOnly} />

      <MeCard displayName={props.displayName} email={props.email} hasPin={props.hasPin} reviewEmails={props.reviewEmails} weeklyReport={props.weeklyReport} />

      {props.isOwner ? <DangerZone name={props.household.name} /> : null}
    </div>
  );
}

function MeCard({
  displayName,
  email,
  hasPin,
  reviewEmails,
  weeklyReport,
}: {
  displayName: string;
  email: string;
  hasPin: boolean;
  reviewEmails: boolean;
  weeklyReport: boolean;
}) {
  const t = useParentT();
  const [name, setName] = useState(displayName);
  const [notify, setNotify] = useState(reviewEmails);
  const [weekly, setWeekly] = useState(weeklyReport);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="mb-1 font-display text-xl font-bold">{t("b.me.title")}</h2>
      <p className="mb-4 text-sm text-ink-soft">{email}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setMyDisplayName(name);
              setMsg(r.ok ? { tone: "good", text: t("b.me.nameSaved") } : { tone: "bad", text: r.message });
            });
          }}
        >
          <Field label={t("b.me.yourName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("b.me.namePlaceholder")} maxLength={40} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>{t("b.common.save")}</Button>
        </form>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setMyPin(pin);
              setPin("");
              setMsg(r.ok ? { tone: "good", text: pin ? t("b.me.pinSet") : t("b.me.pinRemoved") } : { tone: "bad", text: r.message });
            });
          }}
        >
          <Field label={`${t("b.me.parentPin")} ${hasPin ? t("b.me.pinTagSet") : t("b.me.pinTagOptional")}`} hint={t("b.me.pinHint")}>
            <Input inputMode="numeric" pattern="\d{4,6}|" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••" autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>{pin ? t("b.me.setPin") : hasPin ? t("b.common.remove") : t("b.me.setPin")}</Button>
        </form>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-maple"
          checked={notify}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setNotify(next);
            start(async () => {
              const r = await setMyReviewEmails(next);
              if (!r.ok) setNotify(!next);
              setMsg(r.ok ? { tone: "good", text: next ? t("b.me.reviewOn") : t("b.me.reviewOff") } : { tone: "bad", text: r.message });
            });
          }}
        />
        <span>
          <span className="font-semibold">{t("b.me.reviewLabel")}</span>
          <span className="block text-sm text-ink-soft">{t("b.me.reviewHint")}</span>
        </span>
      </label>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-maple"
          checked={weekly}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setWeekly(next);
            start(async () => {
              const r = await setMyWeeklyReport(next);
              if (!r.ok) setWeekly(!next);
              setMsg(r.ok ? { tone: "good", text: next ? t("b.me.weeklyOn") : t("b.me.weeklyOff") } : { tone: "bad", text: r.message });
            });
          }}
        />
        <span>
          <span className="font-semibold">{t("b.me.weeklyLabel")}</span>
          <span className="block text-sm text-ink-soft">{t("b.me.weeklyHint")}</span>
        </span>
      </label>
      {msg ? <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
    </Card>
  );
}

function DangerZone({ name }: { name: string }) {
  const t = useParentT();
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="ring-danger/40">
      <h2 className="font-display text-xl font-bold text-danger">{t("b.danger.title")}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t("b.danger.body")}</p>
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
        <Field label={t("b.danger.typeToConfirm", { name })}>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="danger" disabled={pending || confirm !== name}>{t("b.danger.delete")}</Button>
      </form>
      {msg ? <div className="mt-3"><Alert tone="bad">{msg}</Alert></div> : null}
    </Card>
  );
}
