"use client";

import { ParentLocaleProvider } from "@/lib/i18n/parent/client";
import { InstallApp } from "@/components/InstallApp";
import { parentT } from "@/lib/i18n/parent";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { enableKioskOnThisDevice } from "@/app/actions/devices";
import { logout } from "@/app/(auth)/actions";
import { translator, type Locale, type MessageKey } from "@/lib/i18n";
import { brand } from "@/lib/brand";
import { buttonClass } from "@/components/ui";

const NAV: { href: string; key: MessageKey; icon: string }[] = [
  { href: "/admin/approvals", key: "nav.approvals", icon: "✅" },
  { href: "/admin/chores", key: "nav.chores", icon: "🧹" },
  { href: "/admin/kids", key: "nav.kids", icon: "👧" },
  { href: "/admin/payouts", key: "nav.payouts", icon: "💵" },
  { href: "/admin/history", key: "nav.history", icon: "📜" },
  { href: "/admin/settings", key: "nav.settings", icon: "⚙️" },
];

export function AdminShell(props: {
  householdId: string;
  householdName: string;
  locale: Locale;
  pendingCount: number;
  onKiosk: boolean;
  adminTimeoutMinutes: number;
  readOnly: boolean;
  isOwner: boolean;
  trialDaysLeft: number | null;
  theme: string;
  /** The owner's control panel shortcut; null for every other account. */
  platformHref?: string | null;
  /** Inside the native parent app: no sidebar, top bar or bottom tabs (the app has its own). */
  embedded?: boolean;
  children: React.ReactNode;
}) {
  const tr = translator(props.locale);
  const pt = parentT(props.locale);
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(props.pendingCount);
  const [switching, startSwitch] = useTransition();
  useEffect(() => setPending(props.pendingCount), [props.pendingCount]);

  useEffect(() => {
    document.documentElement.dataset.theme = props.theme;
  }, [props.theme]);

  // Realtime: new/changed submissions refresh the badge and the current page.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void (async () => {
      // Realtime must carry the parent's JWT, or RLS hides every row.
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
      .channel(`household-${props.householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `household_id=eq.${props.householdId}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ledger_entries", filter: `household_id=eq.${props.householdId}` },
        () => router.refresh(),
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production") console.warn("realtime", status, err);
      });
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [props.householdId, router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-paper md:flex">
      {/* Sidebar (tablet / desktop) */}
      {props.embedded ? null : (
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-card/60 px-3 py-5 md:flex">
        <Link href="/admin/approvals" className="mb-6 flex items-center gap-2 px-3 font-display text-xl font-bold text-maple">
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-maple text-lg text-gold">$</span>
          {brand.name}
        </Link>
        <nav className="flex flex-col gap-1" aria-label={pt("b.shell.nav")}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-bold ${
                isActive(n.href) ? "bg-maple text-white" : "text-ink hover:bg-paper-deep"
              }`}
              aria-current={isActive(n.href) ? "page" : undefined}
            >
              <span aria-hidden>{n.icon}</span>
              {tr(n.key)}
              {n.href === "/admin/approvals" && pending > 0 ? (
                <span className={`ml-auto rounded-full px-2 text-sm font-black ${isActive(n.href) ? "bg-white text-maple" : "bg-maple text-white"}`}>
                  {pending}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-1">
          {props.platformHref ? (
            <a href={props.platformHref} data-testid="platform-shortcut" className="flex min-h-10 items-center gap-2 rounded-xl bg-ink px-3 text-sm font-bold text-paper hover:opacity-90">
              🛠️ Control panel
            </a>
          ) : null}
          <Link
            href="/admin/share"
            className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${isActive("/admin/share") ? "bg-maple text-white" : "text-ink-soft hover:bg-paper-deep"}`}
          >
            {pt("c.shell.share")}
          </Link>
          <Link
            href="/admin/support"
            className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${isActive("/admin/support") ? "bg-maple text-white" : "text-ink-soft hover:bg-paper-deep"}`}
          >
            {pt("b.shell.help")}
          </Link>
          <p className="truncate px-2 text-sm font-bold text-ink-soft">{props.householdName}</p>
          <form action={logout}>
            <button className="min-h-10 w-full rounded-xl px-3 text-left text-sm font-bold text-ink-soft hover:bg-paper-deep">
              {tr("nav.logout")}
            </button>
          </form>
        </div>
      </aside>
      )}

      <div className={`flex min-w-0 flex-1 flex-col ${props.embedded ? "" : "pb-24 md:pb-0"}`}>
        {/* Top bar */}
        {props.embedded ? null : (
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur">
          <span className="min-w-0 truncate font-display text-lg font-bold text-ink md:hidden">{props.householdName}</span>
          <div className="ml-auto flex items-center gap-2">
            {props.platformHref ? (
              <a href={props.platformHref} data-testid="platform-shortcut-mobile" aria-label="Control panel" title="Control panel" className={`${buttonClass("ghost", "sm")} md:hidden`}>
                🛠️
              </a>
            ) : null}
            {!props.onKiosk ? <InstallApp lang={props.locale} compact /> : null}
            {props.onKiosk ? (
              <form action="/api/admin-mode/exit" method="post">
                <button className={`${buttonClass("success", "sm")} whitespace-nowrap`}>
                  🧒 <span className="hidden sm:inline">{tr("nav.backToKidsMode")}</span>
                  <span className="sm:hidden">{tr("nav.kidsMode")}</span>
                </button>
              </form>
            ) : (
              <button
                className={`${buttonClass("secondary", "sm")} whitespace-nowrap`}
                disabled={switching}
                onClick={() => {
                  if (window.confirm(pt("b.shell.confirmKiosk"))) {
                    startSwitch(async () => {
                      const r = await enableKioskOnThisDevice();
                      if (r && !r.ok) window.alert(r.message);
                    });
                  }
                }}
              >
                🧒 <span className="hidden sm:inline">{tr("nav.switchToKidsMode")}</span>
                <span className="sm:hidden">{tr("nav.kidsMode")}</span>
              </button>
            )}
            <form action={logout} className="md:hidden">
              <button className={`${buttonClass("ghost", "sm")} whitespace-nowrap`}>{tr("nav.logout")}</button>
            </form>
          </div>
        </header>
        )}

        {props.readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-plum px-4 py-3 text-sm font-semibold text-white">
            <span>{tr("admin.readOnly")}</span>
            {props.isOwner ? (
              <Link href="/admin/settings/billing" className="rounded-lg bg-white px-3 py-1.5 font-black text-plum">
                {tr("admin.upgrade")}
              </Link>
            ) : null}
          </div>
        ) : props.trialDaysLeft !== null && props.trialDaysLeft <= 5 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gold/50 px-4 py-2 text-sm font-bold text-ink">
            <span>{tr("admin.trialLeft", { days: props.trialDaysLeft })}</span>
            {props.isOwner ? <Link href="/admin/settings/billing" className="underline">{tr("admin.upgrade")}</Link> : null}
          </div>
        ) : null}

        {props.onKiosk ? <AdminTimeout minutes={props.adminTimeoutMinutes} locale={props.locale} /> : null}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <ParentLocaleProvider locale={props.locale}>{props.children}</ParentLocaleProvider>
        </main>
      </div>

      {/* Bottom tabs (phone) */}
      {props.embedded ? null : (
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={pt("b.shell.nav")}
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
              isActive(n.href) ? "text-maple" : "text-ink-soft"
            }`}
          >
            <span className="text-xl" aria-hidden>{n.icon}</span>
            {/* Six tabs share a phone's width: keep every label inside its tab. */}
            <span className="w-full truncate px-0.5 text-center tracking-tight">
              {tr(n.key === "nav.settings" ? "nav.settingsShort" : n.key === "nav.approvals" ? "nav.approvalsShort" : n.key)}
            </span>
            {n.href === "/admin/approvals" && pending > 0 ? (
              <span className="absolute top-1.5 right-[22%] rounded-full bg-maple px-1.5 text-[10px] font-black text-white">{pending}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      )}
    </div>
  );
}

/**
 * Kiosk-only Admin Mode timeout (SPEC §7): any interaction renews the
 * server cookie (throttled). A banner counts down the last 60 seconds.
 */
function AdminTimeout({ minutes, locale }: { minutes: number; locale: Locale }) {
  const tr = translator(locale);
  const [until, setUntil] = useState(() => Date.now() + minutes * 60_000);
  const [now, setNow] = useState(() => Date.now());
  const lastPing = useRef(Date.now());

  const ping = useCallback(async () => {
    lastPing.current = Date.now();
    const res = await fetch("/api/admin-mode/ping", { method: "POST" }).catch(() => null);
    if (!res || !res.ok) return window.location.assign("/api/admin-mode/exit");
    const body = (await res.json()) as { until: number };
    setUntil(body.until);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      // Local deadline moves immediately; the server is told at most every 30s.
      setUntil(Date.now() + minutes * 60_000);
      if (Date.now() - lastPing.current > 30_000) void ping();
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true, capture: true });
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity, { capture: true });
      window.clearInterval(id);
    };
  }, [minutes, ping]);

  const left = Math.ceil((until - now) / 1000);
  useEffect(() => {
    if (left <= 0) window.location.assign("/api/admin-mode/exit");
  }, [left]);

  if (left > 60) return null;
  return (
    <div className="sticky top-12 z-40 flex items-center justify-between gap-3 bg-amber px-4 py-3 font-bold text-white" role="alert">
      <span>⏱ {tr("admin.timeoutBanner", { seconds: Math.max(0, left) })}</span>
      <button type="button" onClick={() => void ping()} className="rounded-lg bg-white px-3 py-1.5 text-amber">
        {tr("admin.stay")}
      </button>
    </div>
  );
}
