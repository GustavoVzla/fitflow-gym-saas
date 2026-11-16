"use client";

import Link from "next/link";
import { Workflow, Bell, ArrowRight } from "lucide-react";
import PremiumSection from "@/components/dashboard/PremiumSection";

export default function AutomatizacionesPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              Los avisos básicos ya están operativos en tu plan actual
            </p>
            <p className="mt-1 text-xs text-emerald-800/90">
              Bienvenida, recordatorio de clase, tarifa por vencer, cumpleaños, pago vencido y
              socios inactivos son plantillas ya disponibles y operativas desde el primer día.
              Configúralas en{' '}
              <Link
                href="/configuracion/avisos"
                className="underline font-medium hover:text-emerald-950"
              >
                Configuración › Avisos
              </Link>
              .
            </p>
            <Link
              href="/configuracion/avisos"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 hover:text-emerald-950"
            >
              Ir a Avisos automáticos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <PremiumSection
        title="Automatizaciones IA"
        subtitle="Layer IA avanzado sobre los avisos básicos: editor visual sin código, WhatsApp nativo, retry inteligente tras pago fallido, sugerencias de reactivación basadas en patrones de tu DB y métricas por workflow."
        plan="Smart"
        icon={Workflow}
        benefits={[
          "Editor visual drag & drop — diseña flujos complejos sin tocar código",
          "WhatsApp multicanal — además del email e in-app que ya tienes en Avisos",
          "Retry inteligente tras pago fallido — reintentos graduales con aviso a contabilidad",
          "Sugerencias IA de reactivación basadas en patrones de asistencia y pago",
          "Métricas por workflow: aperturas, clicks, conversión y ROI",
          "15+ plantillas avanzadas listas para copiar y personalizar",
        ]}
        preview={[
          {
            title: "Recuperar bajas con IA",
            body: "La IA detecta socios en riesgo de baja (asistencia irregular + retraso en pago) y lanza secuencia de 3 mensajes con descuento condicional.",
          },
          {
            title: "Pago fallido con retry inteligente",
            body: "Retry automático en 3 y 7 días, aviso previo al socio, escalado a contabilidad si falla, todo auditable.",
          },
          {
            title: "Editor visual multicanal",
            body: "Diseña flujos que combinan WhatsApp + email + notificación in-app con condiciones (si no abre el email, envía WhatsApp a las 24h).",
          },
        ]}
      />
    </div>
  );
}
