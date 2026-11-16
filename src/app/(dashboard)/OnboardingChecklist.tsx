"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  X,
  Building2,
  Users,
  CreditCard,
  Calendar,
  RefreshCw,
  UserPlus,
  SkipForward,
  Check,
  RotateCcw,
} from "lucide-react";
import type { OnboardingProgress, StepOverride } from "./dashboard-types";
import {
  dismissOnboardingAction,
  markStepSkippedAction,
  markStepCompletedManuallyAction,
  clearStepOverrideAction,
  type OnboardingStepKey,
} from "./onboarding-actions";

type Props = {
  onboarding: OnboardingProgress;
  gymId: string;
};

type StepUiKey =
  | "profileComplete"
  | "hasInstructors"
  | "hasTariffs"
  | "hasClasses"
  | "hasInstances"
  | "hasMembers";

interface Step {
  key: StepUiKey;
  /** Backend key for Server Actions (maps to 'profile'/'instructors'/etc) */
  backendKey: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  done: boolean;
}

export default function OnboardingChecklist({ onboarding, gymId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [dismissError, setDismissError] = useState<string | null>(null);

  // Hide when all 6 steps are done (auto-hide, no config needed)
  if (onboarding.allDone) return null;
  // Hide when the gym owner chose "No volver a mostrar" (persisted in DB
  // via migration 0024 → gym_onboarding_progress.dismissed_at). Old
  // "isRecentGym < 30 days" auto-hide removed — it made Demo Studio lose
  // the checklist before finishing setup.
  if (onboarding.dismissedAt) return null;

  const onDismiss = () => {
    setDismissError(null);
    startTransition(async () => {
      const res = await dismissOnboardingAction(gymId);
      if (!res.ok) setDismissError(res.error);
      // On success, revalidatePath('/') refreshes dashboard → checklist gone.
    });
  };

  const runStepAction = (
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    setDismissError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setDismissError(res.error ?? "Error");
    });
  };

  const steps: Step[] = [
    {
      key: "profileComplete",
      backendKey: "profile",
      title: "Completa el perfil del gym",
      description: "Añade teléfono, dirección y CIF para facturación",
      href: "/configuracion",
      cta: "Ir a Configuración",
      icon: Building2,
      done: onboarding.profileComplete,
    },
    {
      key: "hasInstructors",
      backendKey: "instructors",
      title: "Añade tus instructores",
      description: "Crea el equipo técnico que impartirá las clases",
      href: "/clases-tarifas",
      cta: "Ir a Instructores",
      icon: Users,
      done: onboarding.hasInstructors,
    },
    {
      key: "hasTariffs",
      backendKey: "tariffs",
      title: "Define tus tarifas",
      description: "Mensualidades, bonos o cuotas puntuales",
      href: "/clases-tarifas",
      cta: "Ir a Tarifas",
      icon: CreditCard,
      done: onboarding.hasTariffs,
    },
    {
      key: "hasClasses",
      backendKey: "classes",
      title: "Crea tu horario de clases",
      description: "Plantillas semanales (ej: Lunes 10:00 CrossFit con Juan)",
      href: "/clases-tarifas",
      cta: "Ir a Clases",
      icon: Calendar,
      done: onboarding.hasClasses,
    },
    {
      key: "hasInstances",
      backendKey: "instances",
      title: "Genera las instancias de clase",
      description: "Crea las fechas concretas desde tus plantillas para los próximos 14 días",
      href: "/clases-tarifas",
      cta: "Ir a Clases",
      icon: RefreshCw,
      done: onboarding.hasInstances,
    },
    {
      key: "hasMembers",
      backendKey: "members",
      title: "Añade tu primer socio",
      description: "Registra los miembros que quieres empezar a gestionar",
      href: "/socios",
      cta: "Ir a Socios",
      icon: UserPlus,
      done: onboarding.hasMembers,
    },
  ];

  const progressPct = Math.round(
    (onboarding.completedCount / onboarding.totalCount) * 100
  );

  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
      {/* Dismiss button — persists to DB via Server Action */}
      <button
        onClick={onDismiss}
        disabled={isPending}
        title="No volver a mostrar esta guía"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-600 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
      {dismissError && (
        <p className="absolute right-12 top-4 text-[11px] font-medium text-red-600">
          {dismissError}
        </p>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b8bea] to-[#6366f1] shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 pr-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Empieza aquí</h2>
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
              {onboarding.completedCount}/{onboarding.totalCount} completado
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {nextStep
              ? `Siguiente paso: ${nextStep.title}.`
              : "Estás a punto de terminar, solo quedan los últimos pasos."}{" "}
            Configura tu gym en minutos.
          </p>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-white ring-1 ring-blue-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3b8bea] to-[#6366f1] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps grid */}
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {steps.map((step) => {
          const override: StepOverride | undefined =
            onboarding.stepOverrides[step.backendKey];
          const isSkipped = override?.skipped === true;
          const isManual = override?.manually_completed === true;
          const hasOverride = isSkipped || isManual;

          return (
            <StepCard
              key={step.key}
              step={step}
              isSkipped={isSkipped}
              isManual={isManual}
              hasOverride={hasOverride}
              isPending={isPending}
              onSkip={() =>
                runStepAction(() => markStepSkippedAction(gymId, step.backendKey))
              }
              onMarkManual={() =>
                runStepAction(() =>
                  markStepCompletedManuallyAction(gymId, step.backendKey)
                )
              }
              onClearOverride={() =>
                runStepAction(() => clearStepOverrideAction(gymId, step.backendKey))
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  step,
  isSkipped,
  isManual,
  hasOverride,
  isPending,
  onSkip,
  onMarkManual,
  onClearOverride,
}: {
  step: Step;
  isSkipped: boolean;
  isManual: boolean;
  hasOverride: boolean;
  isPending: boolean;
  onSkip: () => void;
  onMarkManual: () => void;
  onClearOverride: () => void;
}) {
  const Icon = step.icon;
  const doneBorder = step.done
    ? "border-emerald-200 bg-white/60"
    : "border-slate-200 bg-white hover:border-[#3b8bea] hover:shadow-sm";

  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border p-3 transition-all ${doneBorder}`}
    >
      <div className="shrink-0 pt-0.5">
        {step.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <Circle className="h-5 w-5 text-slate-300 group-hover:text-[#3b8bea]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${
              step.done ? "text-slate-400" : "text-[#3b8bea]"
            }`}
          />
          <Link
            href={step.href}
            className={`text-sm font-semibold truncate hover:underline ${
              step.done ? "text-slate-500" : "text-slate-800"
            } ${step.done && !hasOverride ? "line-through" : ""}`}
            title={step.cta}
          >
            {step.title}
          </Link>
          {isManual && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
              <Check className="h-2.5 w-2.5" />
              Manual
            </span>
          )}
          {isSkipped && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
              <SkipForward className="h-2.5 w-2.5" />
              Omitido
            </span>
          )}
        </div>
        {!step.done && !hasOverride && (
          <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
        )}
        {/* Override controls: botones pequeños debajo del step */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {!hasOverride && !step.done && (
            <>
              <button
                type="button"
                onClick={onMarkManual}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                title="Marcar como hecho manualmente (fuera del sistema)"
              >
                <Check className="h-2.5 w-2.5" />
                Hecho manualmente
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
                title="Omitir este paso (no aplica para mi gym)"
              >
                <SkipForward className="h-2.5 w-2.5" />
                Omitir
              </button>
            </>
          )}
          {hasOverride && (
            <button
              type="button"
              onClick={onClearOverride}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 disabled:opacity-50"
              title="Quitar marca y volver al estado normal"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Quitar marca
            </button>
          )}
        </div>
      </div>
      {!step.done && !hasOverride && (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#3b8bea]" />
      )}
    </div>
  );
}
