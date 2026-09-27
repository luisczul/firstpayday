import type { Locale } from "@/lib/i18n";

/** One area's parent-side strings: English is the source; every locale must have every key. */
export type Dict = Record<string, string>;
export type AreaDicts<K extends string = string> = Record<Locale, Record<K, string>>;
