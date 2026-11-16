"use client";

import Link from "next/link";
import {
  Users,
  CreditCard,
  TrendingUp,
  UserMinus,
  Clock,
  ChevronRight,
  Calendar,
} from "lucide-react";
import type { DashboardData } from "./dashboard-types";
import { formatEUR, formatDateShort } from "./dashboard-types";
import OnboardingChecklist from "./OnboardingChecklist";

type Props = { data: DashboardData };

const typeColors: Record<string, string> = {
  premium: "bg-amber-100 text-amber-700",
  dinamico: "bg-blue-100 text-[#3b8bea]",
  salud: "bg-emerald-100 text-emerald-700",
  personal_1h: "bg-purple-100 text-purple-700",
  personal_30min: "bg-purple-100 text-purple-700",
  grupal: "bg-slate-100 text-slate-700",
};

const typeLabel: Record<string, string> = {
  premium: "Premium",
  dinamico: "Dinámico",
  salud: "Salud",
  personal_1h: "Personal",
  personal_30min: "Personal",
  grupal: "Grupal",
};

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: "blue" | "green" | "amber" | "red";
}) {
  const palette = {
    blue: { bg: "bg-blue-50", text: "text-[#3b8bea]", ring: "ring-blue-100" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
    red: { bg: "bg-red-50", text: "text-red-500", ring: "ring-red-100" },
  }[color];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${palette.bg} ring-1 ${palette.ring}`}
        >
          <Icon className={`h-5 w-5 ${palette.text}`} />
        </div>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-[3px] w-full ${
          color === "blue"
            ? "bg-[#3b8bea]"
            : color === "green"
              ? "bg-emerald-500"
              : color === "amber"
                ? "bg-amber-500"
                : "bg-red-500"
        } opacity-0 transition-opacity group-hover:opacity-100`}
      />
    </div>
  );
}

function SectionHeader({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {action && href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-[#3b8bea] hover:text-[#2a6fc7]"
        >
          {action}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function DashboardView({ data }: Props) {
  const { gymId, kpis, upcomingClasses, recentPayments, revenueByMonth, tariffDistribution, onboarding } = data;
  const maxRevenue = Math.max(...revenueByMonth.map((d) => d.amount), 1);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Onboarding checklist — hidden when all 6 steps done OR user dismissed (persisted DB) */}
      {gymId && <OnboardingChecklist onboarding={onboarding} gymId={gymId} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Socios activos"
          value={kpis.activeMembers.toString()}
          sub={`de ${kpis.totalMembers} registrados`}
          icon={Users}
          color="blue"
        />
        <KPICard
          label="Ingresos este mes"
          value={formatEUR(kpis.monthRevenue)}
          icon={CreditCard}
          color="green"
        />
        <KPICard
          label="Ticket medio"
          value={formatEUR(kpis.averageTicket)}
          icon={TrendingUp}
          color="amber"
        />
        <KPICard
          label="Churn rate"
          value={`${kpis.churnRate.toFixed(2).replace(".", ",")}%`}
          sub={
            kpis.leftThisMonth === 0
              ? "Sin bajas este mes"
              : `${kpis.leftThisMonth} baja${kpis.leftThisMonth === 1 ? "" : "s"} este mes`
          }
          icon={UserMinus}
          color={kpis.churnRate > 5 ? "red" : "green"}
        />
      </div>

      {/* Row: Upcoming Classes + Revenue Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
          <SectionHeader title="Próximas clases" action="Ver reservas" href="/reservas" />
          {upcomingClasses.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No hay próximas clases programadas</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Crea plantillas en Clases y Tarifas y genera instancias
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <Clock className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{cls.className}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            typeColors[cls.classType] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {typeLabel[cls.classType] ?? cls.classType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {cls.startTime}–{cls.endTime} ·{" "}
                        {cls.instructorName ?? "Sin instructor"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {cls.bookedCount}/{cls.maxSpots}
                    </p>
                    <p className="text-[10px] text-slate-400">plazas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <SectionHeader title="Ingresos últimos 4 meses" />
          <div className="mt-4 flex items-end justify-between gap-3" style={{ height: 160 }}>
            {revenueByMonth.map((d, idx) => {
              const heightPct = d.amount > 0 ? (d.amount / maxRevenue) * 100 : 3;
              return (
                <div
                  key={`${d.year}-${d.month}-${idx}`}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[11px] font-semibold text-slate-600">
                    {d.amount > 0 ? `${Math.round(d.amount)} €` : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      d.amount > 0
                        ? "bg-gradient-to-t from-[#3b8bea] to-[#5da0ef]"
                        : "bg-slate-100"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: 4 }}
                  />
                  <span className="text-[11px] text-slate-400">{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row: Payments Table + Tariff Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
          <SectionHeader title="Últimos pagos cobrados" action="Ver todos" href="/pagos" />
          {recentPayments.length === 0 ? (
            <div className="py-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Sin pagos completados todavía</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pr-4">Socio</th>
                    <th className="pb-3 pr-4">Concepto</th>
                    <th className="pb-3 pr-4 text-right">Importe</th>
                    <th className="pb-3 pr-4">Fecha</th>
                    <th className="pb-3">Método</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-slate-800">{p.memberName}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{p.description}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-800">
                        {formatEUR(p.amount)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{formatDateShort(p.paidAt)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {p.methodLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <SectionHeader title="Tarifas activas" />
          {tariffDistribution.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Sin socios con tarifa asignada</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Asigna tarifas desde la sección Socios
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-4">
                {tariffDistribution.map((t) => (
                  <div key={t.group}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{t.group}</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {t.percentage}%{" "}
                        <span className="text-xs text-slate-400">({t.count})</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${t.percentage}%`,
                          backgroundColor: t.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {tariffDistribution.map((t) => (
                  <div key={t.group} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-[11px] text-slate-500">{t.group}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
