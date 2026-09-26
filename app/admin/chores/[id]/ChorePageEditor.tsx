"use client";

import { useRouter } from "next/navigation";
import { ChoreEditor, type EditableChore } from "@/components/admin/ChoreEditor";

export function ChorePageEditor({ chore, kids }: { chore: EditableChore; kids: { id: string; name: string; color: string }[] }) {
  const router = useRouter();
  return <ChoreEditor initial={chore} kids={kids} onSaved={() => router.push("/admin/chores")} />;
}
