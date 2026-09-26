"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { enableKioskOnThisDevice, renameDevice, revokeDevice } from "@/app/actions/devices";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";

interface Device {
  id: string;
  name: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function DevicesList({ devices, limit, onKiosk }: { devices: Device[]; limit: number; onKiosk: boolean; locale: "en" | "fr" }) {
  const router = useRouter();
  const [name, setName] = useState("Kitchen tablet");
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = devices.filter((d) => !d.revoked_at);

  return (
    <div className="flex flex-col gap-6">
      {!onKiosk ? (
        <Card>
          <h2 className="font-display text-xl font-bold">Use this device as the kids&apos; tablet</h2>
          <p className="mt-1 text-sm text-ink-soft">You&apos;ll be logged out here and the kids&apos; board will open. Tap Parent on the board to come back.</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="max-w-xs" aria-label="Tablet name" />
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await enableKioskOnThisDevice(name);
                  if (r && !r.ok) setError(r.message);
                })
              }
            >
              🧒 Set up this device
            </Button>
          </div>
        </Card>
      ) : (
        <Alert tone="good">This device is a kids&apos; tablet. Use “Back to Kids Mode” at the top when you&apos;re done.</Alert>
      )}
      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div>
        <h2 className="mb-3 font-display text-xl font-bold">
          Tablets <span className="text-base text-ink-soft">({active.length} of {limit})</span>
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
                    aria-label="Tablet name"
                    maxLength={60}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== d.name) start(async () => void (await renameDevice(d.id, v)));
                    }}
                    className="w-full rounded-lg bg-transparent font-bold focus:bg-paper focus:outline-none"
                  />
                )}
                <span className="block text-xs text-ink-soft">
                  {d.last_seen_at ? `Last seen ${formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true })}` : "Never seen"}
                </span>
              </span>
              {d.revoked_at ? (
                <Badge>Disconnected</Badge>
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
                    Yes, disconnect
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                </span>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmRevoke(d.id)}>Revoke</Button>
              )}
            </li>
          ))}
          {devices.length === 0 ? <p className="text-ink-soft">No tablets yet.</p> : null}
        </ul>
      </div>
    </div>
  );
}
