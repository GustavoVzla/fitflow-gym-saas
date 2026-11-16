"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminSignoutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const signout = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    });
  };

  return (
    <button
      type="button"
      onClick={signout}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" />
      Salir
    </button>
  );
}
