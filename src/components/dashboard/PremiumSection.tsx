"use client";

import type { ComponentType, SVGProps } from "react";
import { Check, Sparkles } from "lucide-react";

type Plan = "Smart" | "Pro";

interface PreviewCard {
  title: string;
  body: string;
}

interface PremiumSectionProps {
  title: string;
  subtitle: string;
  plan: Plan;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  benefits: string[];
  preview?: PreviewCard[];
  availability?: string;
}

const PLAN_COLORS: Record<Plan, { ring: string; bg: string; text: string; gradient: string }> = {
  Smart: {
    ring: "ring-violet-200",
    bg: "bg-violet-50",
    text: "text-violet-700",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  Pro: {
    ring: "ring-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    gradient: "from-blue-500 to-cyan-500",
  },
};

export default function PremiumSection({
  title,
  subtitle,
  plan,
  icon: Icon,
  benefits,
  preview,
  availability = "Disponible en Q2 2026",
}: PremiumSectionProps) {
  const colors = PLAN_COLORS[plan];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${colors.gradient} p-8 text-white shadow-sm`}
      >
        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Incluido en plan {plan}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-xl text-sm text-white/90">{subtitle}</p>
            <p className="mt-4 text-xs font-medium text-white/70">{availability}</p>
          </div>
          <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur md:flex">
            <Icon className="h-10 w-10" />
          </div>
        </div>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Beneficios */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">¿Qué incluye?</h3>
          <ul className="mt-3 space-y-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${colors.bg} ${colors.ring} ring-1`}
                >
                  <Check className={`h-3 w-3 ${colors.text}`} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Estado</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>
              Tu plan actual no incluye este módulo. Cuando lo activemos, todos los datos de tu
              gimnasio se conectarán automáticamente sin migración manual.
            </p>
            <div className={`rounded-lg ${colors.bg} px-3 py-2.5`}>
              <p className={`text-xs font-semibold ${colors.text}`}>
                ¿Te interesa activarlo antes?
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Habla con tu responsable de cuenta para pre-reservar y priorizar tu onboarding.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview cards */}
      {preview && preview.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Vista previa</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {preview.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {p.title}
                </p>
                <p className="mt-2 text-sm text-slate-700">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
