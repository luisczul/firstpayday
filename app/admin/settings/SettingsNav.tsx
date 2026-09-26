import Link from "next/link";

const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/devices", label: "Tablets" },
  { href: "/admin/settings/members", label: "Parents" },
  { href: "/admin/settings/billing", label: "Billing" },
];

export function SettingsNav({ active }: { active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 ring-1 ring-line" aria-label="Settings">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold whitespace-nowrap ${
            active === t.href ? "bg-maple text-white" : "text-ink-soft hover:bg-paper"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
