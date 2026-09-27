import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { parentT } from "@/lib/i18n/parent";
import { ParentLocaleProvider } from "@/lib/i18n/parent/client";
import { onboardingLocale } from "./locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: parentT(await onboardingLocale())("a.onb.metaTitle") };
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const locale = await onboardingLocale();
  return (
    <ParentLocaleProvider locale={locale}>
      <div className="paper-texture min-h-dvh">
        <header className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-6 font-display text-xl font-bold text-maple">
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-maple text-lg text-gold">$</span>
          {brand.name}
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-10">{children}</main>
      </div>
    </ParentLocaleProvider>
  );
}
