"use client";

import { useState, useTransition } from "react";
import {
  Users,
  UserPlus,
  UserMinus,
  Wallet,
  CalendarCheck,
  TrendingUp,
  Download,
  Lock,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from "lucide-react";
import {
  REPORT_CATEGORIES,
  formatCurrency,
  rowsToCsv,
  type KpiSummary,
  type ReportDetail,
  type ReportMeta,
} from "./types";
import { loadReportAction } from "./actions";
import type { ReportKey } from "./data";

type Props = { initialKpis: KpiSummary };

export default function InformesClient({ initialKpis }: Props) {
  const [isPending, startTransition] = useTransition();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.title, true]))
  );
  const [activeReport, setActiveReport] = useState<ReportMeta | null>(null);
  const [activeDetail, setActiveDetail] = useState<ReportDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const kpiCards = [
    {
      label: "Socios activos",
      value: initialKpis.activeMembers.toLocaleString("es-ES"),
      icon: Users,
      color: "text-blue-600 bg-blue-50 ring-blue-100",
    },
    {
      label: "Altas este mes",
      value: initialKpis.newMembersThisMonth.toLocaleString("es-ES"),
      icon: UserPlus,
      color: "text-emerald-600 bg-emerald-50 ring-emerald-100",
    },
    {
      label: "Bajas este mes",
      value: initialKpis.cancelledThisMonth.toLocaleString("es-ES"),
      icon: UserMinus,
      color: "text-red-600 bg-red-50 ring-red-100",
    },
    {
      label: "Ingresos del mes",
      value: formatCurrency(initialKpis.revenueThisMonth),
      icon: Wallet,
      color: "text-amber-600 bg-amber-50 ring-amber-100",
    },
    {
      label: "Reservas 30d",
      value: initialKpis.bookingsLast30.toLocaleString("es-ES"),
      icon: CalendarCheck,
      color: "text-purple-600 bg-purple-50 ring-purple-100",
    },
    {
      label: "Asistencia 30d",
      value: `${initialKpis.attendanceRate}%`,
      icon: TrendingUp,
      color: "text-sky-600 bg-sky-50 ring-sky-100",
    },
  ];

  const openReport = (r: ReportMeta) => {
    setActiveReport(r);
    setActiveDetail(null);
    setLoadError(null);
    if (r.available === "v2") return;
    startTransition(async () => {
      const res = await loadReportAction(r.key as ReportKey);
      if (res.error) {
        setLoadError(res.error);
        return;
      }
      setActiveDetail(res.detail ?? null);
    });
  };

  const closeReport = () => {
    setActiveReport(null);
    setActiveDetail(null);
    setLoadError(null);
  };

  const downloadCsv = () => {
    if (!activeReport || !activeDetail) return;
    const { filename, content } = rowsToCsv(
      activeDetail,
      `${activeReport.key}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCell = (
    value: string | number | null,
    type?: "text" | "number" | "currency" | "date"
  ) => {
    if (value == null) return <span className="text-slate-400">—</span>;
    if (type === "currency" && typeof value === "number") return formatCurrency(value);
    if (type === "number" && typeof value === "number") return value.toLocaleString("es-ES");
    return String(value);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Informes</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs en tiempo real y 9 informes operativos. Exporta a CSV y comparte con tu equipo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${k.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {k.label}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Categorías */}
      <div className="space-y-4">
        {REPORT_CATEGORIES.map((cat) => {
          const expanded = openCats[cat.title];
          return (
            <div
              key={cat.title}
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenCats((prev) => ({ ...prev, [cat.title]: !expanded }))
                }
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{cat.title}</h3>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">
                    {cat.reports.length}
                  </span>
                </div>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              {expanded && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.reports.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => openReport(r)}
                        className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-800">{r.name}</h4>
                          {r.available === "v1" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              Disponible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
                              <Lock className="h-3 w-3" />
                              Plan Pro
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{r.description}</p>
                        <span className="mt-1 text-xs font-semibold text-[#3b8bea] group-hover:text-[#2a6fc7]">
                          {r.available === "v1" ? "Ver informe →" : "Ver detalles"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal informe */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{activeReport.name}</h2>
                <p className="text-xs text-slate-500">{activeReport.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {activeReport.available === "v1" &&
                  activeDetail &&
                  activeDetail.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadCsv}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                  )}
                <button
                  type="button"
                  onClick={closeReport}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              {activeReport.available === "v2" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                    <Lock className="h-7 w-7 text-[#3b8bea]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    Incluido en plan Pro
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-slate-600">
                    Este informe avanzado forma parte de nuestro plan Pro con analíticas IA y
                    cohortes. Habla con tu responsable de cuenta para activarlo.
                  </p>
                </div>
              ) : isPending || !activeDetail ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : loadError ? (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError}
                </div>
              ) : activeDetail.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    No hay datos para el periodo seleccionado.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {activeDetail.columns.map((c) => (
                          <th key={c.key} className="px-3 py-2">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDetail.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          {activeDetail.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2 text-slate-700">
                              {renderCell(row[c.key], c.type)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-[11px] text-slate-400">
                    {activeDetail.rows.length} fila{activeDetail.rows.length === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
