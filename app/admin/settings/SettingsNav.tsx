import Link from "next/link";
import { billingEnabled } from "@/lib/billing/plans";
import type { Locale } from "@/lib/i18n";
import { parentT, type ParentKey } from "@/lib/i18n/parent";

const TABS: { href: string; key: ParentKey }[] = [
  { href: "/admin/settings", key: "b.tabs.general" },
  { href: "/admin/settings/promotions", key: "b.tabs.promotions" },
  { href: "/admin/settings/devices", key: "b.tabs.tablets" },
  { href: "/admin/settings/members", key: "b.tabs.parents" },
  { href: "/admin/settings/billing", key: "b.tabs.billing" },
  { href: "/admin/support", key: "b.tabs.help" },
];

export function SettingsNav({ active, locale }: { active: string; locale: Locale }) {
  const t = parentT(locale);
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 ring-1 ring-line" aria-label={t("b.common.settings")}>
      {TABS.filter((tab) => billingEnabled() || tab.href !== "/admin/settings/billing").map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold whitespace-nowrap ${
            active === tab.href ? "bg-maple text-white" : "text-ink-soft hover:bg-paper"
          }`}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
