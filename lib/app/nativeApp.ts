/** The native apps' web views add "FirstPaydayApp/<version> (iOS|Android)" to their user agent. */
export function isNativeApp(userAgent: string | null | undefined): boolean {
  return /\bFirstPaydayApp\//.test(userAgent ?? "");
}
