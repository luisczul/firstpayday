"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { enableKioskOnThisDevice, renameDevice, revokeDevice } from "@/app/actions/devices";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { type Locale } from "@/lib/i18n";
import { dateFnsLocale } from "@/lib/i18n/dateFns";
import { useParentT } from "@/lib/i18n/parent/client";

interface Device {
  id: string;
  name: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface TabletUsage {
  total: number;
  last7: number;
  last30: number;
  /** Already formatted in the household currency. */
  money: string;
  topKids: { name: string; count: number }[];
}

function UsageLine({ usage }: { usage: TabletUsage | undefined }) {
  const t = useParentT();
  if (!usage) return <span className="mt-1 block text-xs text-ink-soft">{t("b.devices.noChores")}</span>;
  const chores = (n: number) => t(n === 1 ? "b.devices.choreOne" : "b.devices.choreMany", { n });
  return (
    <span className="mt-1 block text-xs text-ink-soft">
      <span className="font-bold text-ink">{chores(usage.total)}</span> · {t("b.devices.thisWeek", { n: usage.last7 })} ·{" "}
      {t("b.devices.last30", { n: usage.last30 })} · {usage.money}
      {usage.topKids.length > 0 ? (
        <span className="block">{t("b.devices.mostly", { kids: usage.topKids.map((k) => `${k.name} (${k.count})`).join(", ") })}</span>
      ) : null}
    </span>
  );
}

export function DevicesList({
  devices,
  usage,
  unknown,
  mostUsedId,
  limit,
  onKiosk,
  locale,
}: {
  devices: Device[];
  usage: Record<string, TabletUsage>;
  unknown: TabletUsage | null;
  mostUsedId: string | null;
  limit: number;
  onKiosk: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const t = useParentT();
  const [name, setName] = useState(() => t("b.devices.defaultName"));
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = devices.filter((d) => !d.revoked_at);

  return (
    <div className="flex flex-col gap-6">
      {!onKiosk ? (
        <Card>
          <h2 className="font-display text-xl font-bold">{t("b.devices.useTitle")}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t("b.devices.useBody")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="max-w-xs" aria-label={t("b.devices.tabletName")} />
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await enableKioskOnThisDevice(name);
                  if (r && !r.ok) setError(r.message);
                })
              }
            >
              {t("b.devices.setUp")}
            </Button>
          </div>
        </Card>
      ) : (
        <Alert tone="good">{t("b.devices.isKiosk")}</Alert>
      )}
      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div>
        <h2 className="mb-3 font-display text-xl font-bold">
          {t("b.devices.tablets")} <span className="text-base text-ink-soft">{t("b.devices.ofLimit", { n: active.length, limit })}</span>
        </h2>
        <ul className="flex flex-col gap-3">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
              <span className="text-3xl" aria-hidden>📱</span>
              <span className="min-w-0 flex-1">
                {d.revoked_at ? (
                  <span className="block font-bold text-ink-soft line-through">{d.name}</span>
                ) : (
                  <input
                    defaultValue={d.name}
                    aria-label={t("b.devices.tabletName")}
                    maxLength={60}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== d.name) start(async () => void (await renameDevice(d.id, v)));
                    }}
                    className="w-full rounded-lg bg-transparent font-bold focus:bg-paper focus:outline-none"
                  />
                )}
                <span className="block text-xs text-ink-soft">
                  {d.last_seen_at
                    ? t("b.devices.lastSeen", { ago: formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: dateFnsLocale(locale) }) })
                    : t("b.devices.neverSeen")}
                </span>
                <UsageLine usage={usage[d.id]} />
              </span>
              {d.id === mostUsedId ? <Badge tone="good">{t("b.devices.mostUsed")}</Badge> : null}
              {d.revoked_at ? (
                <Badge>{t("b.devices.disconnected")}</Badge>
              ) : confirmRevoke === d.id ? (
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await revokeDevice(d.id);
                        if (!r.ok) setError(r.message);
                        setConfirmRevoke(null);
                        router.refresh();
                      })
                    }
                  >
                    {t("b.devices.yesDisconnect")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>{t("b.common.cancel")}</Button>
                </span>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmRevoke(d.id)}>{t("b.devices.revoke")}</Button>
              )}
            </li>
          ))}
          {unknown ? (
            <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper-deep/40 p-4 ring-1 ring-line">
              <span className="text-3xl" aria-hidden>❔</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-soft">{t("b.devices.unknown")}</span>
                <span className="block text-xs text-ink-soft">{t("b.devices.unknownBody")}</span>
                <UsageLine usage={unknown} />
              </span>
            </li>
          ) : null}
          {devices.length === 0 ? <p className="text-ink-soft">{t("b.devices.none")}</p> : null}
        </ul>
      </div>
    </div>
  );
}
