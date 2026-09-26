import { brand } from "@/lib/brand";

export const metadata = { title: "Set up your home" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-texture min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-6 font-display text-xl font-bold text-maple">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-maple text-lg text-gold">$</span>
        {brand.name}
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-10">{children}</main>
    </div>
  );
}
