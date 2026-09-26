import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      footer={
        <>
          New here? <Link href="/signup" className="font-bold text-maple">Create a free account</Link>
        </>
      }
    >
      <LoginForm next={next ?? "/admin"} linkError={error === "link"} />
    </AuthShell>
  );
}
