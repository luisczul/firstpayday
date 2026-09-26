import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Start your free trial"
      footer={
        <>
          Already have an account? <Link href="/login" className="font-bold text-maple">Log in</Link>
        </>
      }
    >
      <p className="-mt-2 mb-5 text-ink-soft">14 days free. No credit card needed.</p>
      <SignupForm next={next} />
    </AuthShell>
  );
}
