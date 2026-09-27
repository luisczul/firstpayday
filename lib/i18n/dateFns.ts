import { es, fr, ptBR, type Locale as DateFnsLocale } from "date-fns/locale";
import type { Locale } from "./index";

/** date-fns locale for an app locale (undefined = date-fns default English). */
export function dateFnsLocale(locale: Locale): DateFnsLocale | undefined {
  return locale === "fr" ? fr : locale === "es" ? es : locale === "pt" ? ptBR : undefined;
}
