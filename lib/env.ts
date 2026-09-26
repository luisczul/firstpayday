// Tiny accessor so a missing variable fails loudly with its name (never its value).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** Public base URL: APP_URL, else the brand domain in Vercel production, else the preview URL, else localhost. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return "https://firstpayday.app";
  const preview = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return preview ? `https://${preview}` : "http://localhost:3000";
}
