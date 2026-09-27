"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { parentT } from "./index";

const Ctx = createContext<Locale>("en");

/** Wraps parent pages (AdminShell, onboarding) so client components can translate without props. */
export function ParentLocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useParentLocale(): Locale {
  return useContext(Ctx);
}

/** const t = useParentT(); t("b.chores.title") */
export function useParentT() {
  const locale = useContext(Ctx);
  return useMemo(() => parentT(locale), [locale]);
}
