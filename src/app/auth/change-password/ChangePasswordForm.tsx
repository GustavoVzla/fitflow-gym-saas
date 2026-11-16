"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

export default function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          Nueva contraseña
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          Confirmar contraseña
        </label>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a6fc7] disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Guardar y entrar
          </>
        )}
      </button>
    </form>
  );
}
