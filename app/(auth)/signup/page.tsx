import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create your free account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Create your free account"
      footer={
        <>
          Already have an account? <Link href="/login" className="font-bold text-maple">Log in</Link>
        </>
      }
    >
      <p className="-mt-2 mb-5 text-ink-soft">Your first kid is free forever. No credit card.</p>
      <SignupForm next={next} />
    </AuthShell>
  );
}
