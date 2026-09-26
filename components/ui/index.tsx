import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Small in-house kit for the parent side (SPEC §2).

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const variants: Record<Variant, string> = {
  primary: "bg-maple text-white hover:bg-maple/90 shadow-[0_3px_0_#8a3217]",
  success: "bg-moss text-white hover:bg-moss/90 shadow-[0_3px_0_#4a5620]",
  secondary: "bg-card text-ink ring-1 ring-line hover:bg-paper-deep",
  ghost: "text-ink-soft hover:bg-paper-deep",
  danger: "bg-card text-danger ring-1 ring-danger/40 hover:bg-danger/5",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "min-h-9 px-3 text-sm", md: "min-h-11 px-4 text-base", lg: "min-h-14 px-6 text-lg" };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  const sizes = { sm: "min-h-9 px-3 text-sm", md: "min-h-11 px-4 text-base", lg: "min-h-14 px-6 text-lg" };
  return `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition ${sizes[size]} ${variants[variant]}`;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {hint && !error ? <span className="text-xs text-ink-soft">{hint}</span> : null}
      {error ? <span className="text-xs font-bold text-danger">{error}</span> : null}
    </label>
  );
}

const inputBase =
  "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink placeholder:text-ink-soft/60 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/40";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-20 py-2 ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-line px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>{emoji}</span>
      <p className="mt-3 font-display text-xl font-bold text-ink">{title}</p>
      {children ? <div className="mt-2 text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "good" | "bad" }) {
  const tones = {
    neutral: "bg-paper-deep text-ink-soft",
    warn: "bg-gold/40 text-ink",
    good: "bg-moss/15 text-moss",
    bad: "bg-maple/15 text-maple",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" | "good" }) {
  const tones = { warn: "bg-gold/30 text-ink", bad: "bg-maple/10 text-maple", good: "bg-moss/10 text-moss" };
  return <div role="alert" className={`rounded-xl px-4 py-3 text-sm font-semibold ${tones[tone]}`}>{children}</div>;
}
