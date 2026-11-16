"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Loader2, Mail, Sparkles, AlertTriangle } from "lucide-react";
import { createGymAsAdmin, type GymPlan, type NewGymResult, type PaymentMode } from "./actions";

const PLAN_OPTIONS: Array<{ value: GymPlan; label: string; price: string }> = [
  { value: "base", label: "Base", price: "€99/mes" },
  { value: "smart", label: "Smart", price: "€149/mes" },
  { value: "pro", label: "Pro", price: "€199/mes" },
  { value: "premium", label: "Premium (custom)", price: "€249/mes" },
  { value: "app_pro", label: "App Pro (custom)", price: "€349/mes" },
  { value: "enterprise", label: "Enterprise", price: "custom" },
];

const PAYMENT_MODE_OPTIONS: Array<{
  value: PaymentMode;
  label: string;
  hint: string;
  badge: string;
  enabled: boolean;
}> = [
  {
    value: "manual",
    label: "Manual (cash)",
    hint: "Sin Stripe · registro manual de cobros",
    badge: "Disponible",
    enabled: true,
  },
  {
    value: "direct_keys",
    label: "Direct Keys",
    hint: "El gym pega sus propias claves Stripe",
    badge: "Disponible",
    enabled: true,
  },
  {
    value: "connect_express",
    label: "Connect Express",
    hint: "Onboarding Stripe hosted en FitFlow",
    badge: "Fase 2",
    enabled: false,
  },
  {
    value: "connect_standard",
    label: "Connect Standard",
    hint: "OAuth con cuenta Stripe existente",
    badge: "Fase 3",
    enabled: false,
  },
  {
    value: "managed",
    label: "Managed (FitFlow)",
    hint: "FitFlow cobra y paga al gym",
    badge: "Fase 4",
    enabled: false,
  },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function NewGymClient() {
  const [isPending, startTransition] = useTransition();
  const [clientEmail, setClientEmail] = useState("");
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState<GymPlan>("base");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("manual");
  const [gymPhone, setGymPhone] = useState("");
  const [gymEmail, setGymEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [result, setResult] = useState<NewGymResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? gymSlug : slugify(gymName);

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const res = await createGymAsAdmin({
        clientEmail,
        gymName,
        gymSlug: effectiveSlug,
        plan,
        paymentMode,
        gymPhone: gymPhone || undefined,
        gymEmail: gymEmail || undefined,
        tempPassword: customPassword || undefined,
      });
      setResult(res);
    });
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const resetForm = () => {
    setClientEmail("");
    setGymName("");
    setGymSlug("");
    setSlugTouched(false);
    setPlan("base");
    setPaymentMode("manual");
    setGymPhone("");
    setGymEmail("");
    setCustomPassword("");
    setResult(null);
  };

  const emailTemplate = (r: Extract<NewGymResult, { ok: true }>) =>
    `Hola,

Tu cuenta en FitFlow ya está lista.

Acceso: ${r.loginUrl}
Email: ${r.email}
Contraseña temporal: ${r.tempPassword}

Al iniciar sesión por primera vez, el sistema te pedirá cambiar la contraseña por una propia.

Un saludo,
Equipo FitFlow`;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
          <Sparkles className="h-3.5 w-3.5" />
          Alta asistida
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Nueva cuenta de cliente
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Crea un gym + owner de golpe. El cliente recibirá credenciales temporales y se le
          forzará a cambiar password en el primer login.
        </p>
      </div>

      {result?.ok ? (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Cuenta creada correctamente
              </h3>
              <p className="text-xs text-emerald-700">
                Copia las credenciales y envíalas al cliente por el canal que prefieras.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-white p-4 ring-1 ring-emerald-200">
            {[
              { key: "url", label: "URL de acceso", value: result.loginUrl },
              { key: "email", label: "Email", value: result.email },
              { key: "password", label: "Password temporal", value: result.tempPassword, mono: true },
            ].map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {f.label}
                  </p>
                  <p className={`truncate text-sm text-slate-800 ${f.mono ? "font-mono" : ""}`}>
                    {f.value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(f.key, f.value)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {copied === f.key ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === f.key ? "Copiado" : "Copiar"}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white p-4 ring-1 ring-emerald-200">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Mail className="h-3.5 w-3.5" />
                Plantilla de email
              </p>
              <button
                type="button"
                onClick={() => copy("email-template", emailTemplate(result))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {copied === "email-template" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "email-template" ? "Copiado" : "Copiar email"}
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {emailTemplate(result)}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
            >
              Crear otro
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          {result && !result.ok && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email del cliente *
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Plan *</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as GymPlan)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} — {p.price}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Modo de pago *
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              {PAYMENT_MODE_OPTIONS.map((mode) => {
                const isSelected = paymentMode === mode.value;
                const base =
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors";
                const selected = "border-[#3b8bea] bg-blue-50 ring-1 ring-[#3b8bea]";
                const unselected = "border-slate-200 bg-white hover:bg-slate-50";
                const disabled = "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60";
                return (
                  <label
                    key={mode.value}
                    className={`${base} ${
                      !mode.enabled ? disabled : isSelected ? selected : unselected
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMode"
                      value={mode.value}
                      checked={isSelected}
                      disabled={!mode.enabled}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="mt-0.5 h-4 w-4 text-[#3b8bea] focus:ring-[#3b8bea]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{mode.label}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                            mode.enabled
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          }`}
                        >
                          {mode.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{mode.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Por defecto se asigna <span className="font-mono">manual</span>. El modo puede
              cambiarse más tarde desde el detalle del gym.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Nombre del gym *
              </label>
              <input
                type="text"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="Demo Studio Madrid"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Slug (URL interna)
              </label>
              <input
                type="text"
                value={effectiveSlug}
                onChange={(e) => {
                  setGymSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="demo-studio-madrid"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Se auto-genera desde el nombre si lo dejas vacío.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Teléfono del gym (opcional)
              </label>
              <input
                type="tel"
                value={gymPhone}
                onChange={(e) => setGymPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email público del gym (opcional)
              </label>
              <input
                type="email"
                value={gymEmail}
                onChange={(e) => setGymEmail(e.target.value)}
                placeholder="info@example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Por defecto usa el email del cliente.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Password temporal (opcional)
            </label>
            <input
              type="text"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Dejar vacío = se genera automático"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              El cliente cambiará esta contraseña en su primer login.
            </p>
          </div>

          <div className="flex items-center justify-end border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !clientEmail || !gymName}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a6fc7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Crear cuenta
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
