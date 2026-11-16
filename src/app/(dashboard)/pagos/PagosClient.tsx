"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Download,
  CheckCircle,
  X,
  Search,
  Info,
  XCircle,
  Info as InfoIcon,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import {
  createPaymentAction,
  markPaymentPaidAction,
  cancelPaymentAction,
  createPaymentCheckoutLinkAction,
} from "./actions";
import type {
  PaymentRow,
  MemberOption,
  TariffOption,
  DbPaymentMethod,
} from "./types";
import { METHOD_LABEL, STATUS_LABEL, formatEUR, formatDate } from "./types";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { PAGOS_TOUR } from "@/lib/tours";

type Props = {
  initialPayments: PaymentRow[];
  members: MemberOption[];
  tariffs: TariffOption[];
  seenTourKeys: string[];
  morosos: {
    featureEnabled: boolean;
    blockAfterDays: number | null;
    blockedCount: number;
  };
};

type Tab = "pendientes" | "finalizados" | "sepa";

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.substring(0, 2).toUpperCase() ?? "";
}

export default function PagosClient({
  initialPayments,
  members,
  tariffs,
  seenTourKeys,
  morosos,
}: Props) {
  const router = useRouter();
  const [payments, setPayments] = useState(initialPayments);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => setPayments(initialPayments), [initialPayments]);

  const [activeTab, setActiveTab] = useState<Tab>("pendientes");
  const [search, setSearch] = useState("");
  // Filtros avanzados (paridad LegacyGym). Se aplican sobre el set de la tab activa.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMethod, setFilterMethod] = useState<DbPaymentMethod | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterConcept, setFilterConcept] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const resetFilters = () => {
    setFilterMethod("all");
    setFilterStatus("all");
    setFilterConcept("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };
  const hasActiveFilters =
    filterMethod !== "all" ||
    filterStatus !== "all" ||
    filterConcept !== "all" ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  // Modal nuevo pago
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [formMemberId, setFormMemberId] = useState("");
  const [formTariffId, setFormTariffId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formConcept, setFormConcept] = useState("subscription");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<DbPaymentMethod>("manual");
  const [formDueDate, setFormDueDate] = useState("");
  const [formMarkPaid, setFormMarkPaid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal mark paid (permite elegir método de cobro)
  const [markPaidTarget, setMarkPaidTarget] = useState<PaymentRow | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<DbPaymentMethod>("cash");
  const [markPaidReference, setMarkPaidReference] = useState<string>("");

  // Modal cancel
  const [cancelTarget, setCancelTarget] = useState<PaymentRow | null>(null);

  // Modal checkout link (Fase 1C)
  const [linkModal, setLinkModal] = useState<{
    payment: PaymentRow;
    url: string | null;
    loading: boolean;
    error: string | null;
    copied: boolean;
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const openNewPayment = () => {
    setFormMemberId(members[0]?.id ?? "");
    setFormTariffId("");
    setFormDescription("");
    setFormConcept("subscription");
    setFormAmount("");
    setFormMethod("manual");
    setFormDueDate("");
    setFormMarkPaid(false);
    setFormError(null);
    setNewPaymentOpen(true);
  };
  const closeNewPayment = () => {
    setNewPaymentOpen(false);
    setFormError(null);
  };

  // Al seleccionar tarifa, autocompletar descripción + importe
  const handleTariffChange = (tariffId: string) => {
    setFormTariffId(tariffId);
    if (!tariffId) return;
    const t = tariffs.find((tr) => tr.id === tariffId);
    if (t) {
      const groupPrefix = t.group ? `${t.group} — ` : "";
      setFormDescription(`${groupPrefix}${t.name}`);
      setFormAmount(t.price.toString());
      setFormConcept(t.type === "bonus" ? "bonus" : "subscription");
    }
  };

  const savePayment = () => {
    if (!formMemberId) {
      setFormError("Selecciona un socio");
      return;
    }
    if (!formDescription.trim()) {
      setFormError("La descripción es obligatoria");
      return;
    }
    const amount = parseFloat(formAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Importe inválido");
      return;
    }

    const fd = new FormData();
    fd.set("memberId", formMemberId);
    if (formTariffId) fd.set("tariffId", formTariffId);
    fd.set("description", formDescription.trim());
    fd.set("concept", formConcept);
    fd.set("amount", String(amount));
    fd.set("method", formMethod);
    if (formDueDate) fd.set("dueDate", formDueDate);
    fd.set("markPaidNow", formMarkPaid ? "true" : "false");

    startTransition(async () => {
      const result = await createPaymentAction({}, fd);
      if (result.error) {
        setFormError(result.error);
      } else {
        router.refresh();
        closeNewPayment();
        showToast(result.success ?? "Pago creado");
      }
    });
  };

  const openMarkPaid = (p: PaymentRow) => {
    setMarkPaidTarget(p);
    setMarkPaidMethod(p.method === "manual" ? "cash" : p.method);
    setMarkPaidReference("");
  };
  const closeMarkPaid = () => {
    setMarkPaidTarget(null);
    setMarkPaidReference("");
  };

  const confirmMarkPaid = () => {
    if (!markPaidTarget) return;
    startTransition(async () => {
      const result = await markPaymentPaidAction(
        markPaidTarget.id,
        markPaidMethod,
        markPaidMethod === "bank_transfer" ? markPaidReference : undefined
      );
      if (result.error) {
        showToast(`Error: ${result.error}`, "error");
        return;
      }
      router.refresh();
      closeMarkPaid();
      showToast(result.success ?? "Pago cobrado");
    });
  };

  const openCancel = (p: PaymentRow) => setCancelTarget(p);
  const closeCancel = () => setCancelTarget(null);

  const confirmCancel = () => {
    if (!cancelTarget) return;
    startTransition(async () => {
      const result = await cancelPaymentAction(cancelTarget.id);
      if (result.error) {
        showToast(`Error: ${result.error}`, "error");
        return;
      }
      router.refresh();
      closeCancel();
      showToast(result.success ?? "Pago cancelado");
    });
  };

  // Fase 1C: generar link Stripe Checkout para pago pendiente
  const openLinkModal = (p: PaymentRow) => {
    setLinkModal({ payment: p, url: null, loading: true, error: null, copied: false });
    startTransition(async () => {
      const result = await createPaymentCheckoutLinkAction(p.id);
      if (result.error) {
        setLinkModal((prev) =>
          prev ? { ...prev, loading: false, error: result.error ?? "Error generando link" } : null
        );
        return;
      }
      setLinkModal((prev) =>
        prev ? { ...prev, loading: false, url: result.url ?? null, error: null } : null
      );
    });
  };
  const closeLinkModal = () => setLinkModal(null);

  const copyLink = async () => {
    if (!linkModal?.url) return;
    try {
      await navigator.clipboard.writeText(linkModal.url);
      setLinkModal((prev) => (prev ? { ...prev, copied: true } : null));
      setTimeout(() => {
        setLinkModal((prev) => (prev ? { ...prev, copied: false } : null));
      }, 2000);
    } catch {
      // clipboard denegado (contexto inseguro)
    }
  };

  // Filtrado por tab
  const pending = useMemo(
    () => payments.filter((p) => p.status === "pending" || p.status === "processing"),
    [payments]
  );
  const completed = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.status === "completed" ||
          p.status === "cancelled" ||
          p.status === "refunded" ||
          p.status === "failed"
      ),
    [payments]
  );
  const sepa = useMemo(
    () => payments.filter((p) => p.method === "sepa"),
    [payments]
  );

  const visible = useMemo(() => {
    const source =
      activeTab === "pendientes"
        ? pending
        : activeTab === "finalizados"
          ? completed
          : sepa;

    const term = search.trim().toLowerCase();
    const fromTs = filterDateFrom
      ? new Date(filterDateFrom + "T00:00:00").getTime()
      : null;
    const toTs = filterDateTo
      ? new Date(filterDateTo + "T23:59:59.999").getTime()
      : null;

    return source.filter((p) => {
      // Búsqueda full-text
      if (term) {
        const matchesTerm =
          p.memberName.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          (p.memberEmail?.toLowerCase().includes(term) ?? false);
        if (!matchesTerm) return false;
      }
      // Filtro método
      if (filterMethod !== "all" && p.method !== filterMethod) return false;
      // Filtro estado
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      // Filtro concepto (tipo venta)
      if (filterConcept !== "all") {
        const concept = (p.concept ?? "").toLowerCase();
        if (concept !== filterConcept) return false;
      }
      // Filtro rango fecha (sobre paidAt si existe, si no createdAt)
      if (fromTs || toTs) {
        const ref = p.paidAt ?? p.createdAt;
        if (!ref) return false;
        const ts = new Date(ref).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [
    activeTab,
    pending,
    completed,
    sepa,
    search,
    filterMethod,
    filterStatus,
    filterConcept,
    filterDateFrom,
    filterDateTo,
  ]);

  const totalVisible = visible.reduce((sum, p) => sum + p.amount, 0);
  // Desglose por método del set visible (solo útil en tab Finalizados para cierre contable).
  const totalsByMethod = useMemo(() => {
    const out: Record<DbPaymentMethod, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      bank_transfer: { count: 0, amount: 0 },
      sepa: { count: 0, amount: 0 },
      stripe: { count: 0, amount: 0 },
      manual: { count: 0, amount: 0 },
    };
    for (const p of visible) {
      if (p.status !== "completed") continue;
      out[p.method].count += 1;
      out[p.method].amount += p.amount;
    }
    return out;
  }, [visible]);
  const totalCompletedThisMonth = useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return payments
      .filter((p) => p.status === "completed" && p.paidAt && p.paidAt >= firstOfMonth)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const exportCSV = () => {
    const headers = [
      "Socio",
      "Email",
      "Descripción",
      "Importe",
      "Método",
      "Estado",
      "Vencimiento",
      "Cobrado",
    ];
    const rows = visible.map((p) => [
      p.memberName,
      p.memberEmail ?? "",
      p.description,
      p.amount.toString().replace(".", ","),
      METHOD_LABEL[p.method],
      STATUS_LABEL[p.status],
      p.dueDate ?? "",
      p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-ES") : "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${c}"`).join(";"))].join(
      "\n"
    );
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagos_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <FeatureTour tourKey="pagos-v1" steps={PAGOS_TOUR} seenTourKeys={seenTourKeys} />
      {/* Header */}
      <div data-tour="pagos-header" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pagos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Cobros manuales, SEPA y gestión de facturación. Los pagos completados son
              inmutables (snapshot histórico para contabilidad).
            </p>
          </div>
          <HowItWorksButton steps={PAGOS_TOUR} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            data-tour="pagos-export"
            onClick={exportCSV}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            data-tour="pagos-new-btn"
            onClick={openNewPayment}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Banner política morosos */}
      {morosos.featureEnabled && morosos.blockedCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-red-900">
              {morosos.blockedCount === 1
                ? "1 socio bloqueado por morosidad"
                : `${morosos.blockedCount} socios bloqueados por morosidad`}
            </p>
            <p className="mt-0.5 text-xs text-red-800">
              Política activa: bloqueo automático tras {morosos.blockAfterDays} días
              sin pago. Desbloquea manualmente desde la ficha del socio tras registrar el pago.
            </p>
          </div>
          <Link
            href="/socios?filter=blocked"
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Ver bloqueados
          </Link>
        </div>
      )}
      {morosos.featureEnabled && morosos.blockedCount === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Política de morosos activa (bloqueo tras {morosos.blockAfterDays} días).
            Sin socios bloqueados actualmente.
          </span>
        </div>
      )}
      {!morosos.featureEnabled && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="flex-1">
            <strong className="text-slate-700">Activar bloqueo automático de morosos.</strong>
            {" "}FitFlow puede bloquear reservas a socios con pagos pendientes vencidos hace
            más de N días.
          </span>
          <Link
            href="/configuracion?tab=perfil"
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
          >
            Configurar
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div data-tour="pagos-kpis" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Pendientes"
          value={formatEUR(pending.reduce((s, p) => s + p.amount, 0))}
          subtitle={`${pending.length} pagos`}
          tone="amber"
        />
        <KpiCard
          label="Cobrado este mes"
          value={formatEUR(totalCompletedThisMonth)}
          subtitle="Completados"
          tone="emerald"
        />
        <KpiCard
          label="SEPA programados"
          value={formatEUR(
            sepa.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)
          )}
          subtitle={`${sepa.filter((p) => p.status === "pending").length} domiciliaciones`}
          tone="blue"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          <TabButton
            label="Pendientes"
            count={pending.length}
            active={activeTab === "pendientes"}
            onClick={() => setActiveTab("pendientes")}
          />
          <TabButton
            label="Finalizados"
            count={completed.length}
            active={activeTab === "finalizados"}
            onClick={() => setActiveTab("finalizados")}
          />
          <TabButton
            label="SEPA"
            count={sepa.length}
            active={activeTab === "sepa"}
            onClick={() => setActiveTab("sepa")}
          />
          <a
            href="/pagos/gastos"
            className="relative px-5 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            title="Gestión de gastos operativos del gym"
          >
            Gastos
            <span className="ml-1.5 text-[10px] font-semibold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded ring-1 ring-indigo-200">
              NUEVO
            </span>
          </a>
          <Link
            href="/pagos/facturacion"
            className="relative px-5 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            title="Emitir facturas cumpliendo RD 1619/2012"
          >
            Facturación
            <span className="ml-1.5 text-[10px] font-semibold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded ring-1 ring-indigo-200">
              NUEVO
            </span>
          </Link>
          <Link
            href="/pagos/caja-diaria"
            className="relative px-5 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            title="Arqueo imprimible del día para cierre de caja"
          >
            Caja diaria
            <span className="ml-1.5 text-[10px] font-semibold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded ring-1 ring-indigo-200">
              NUEVO
            </span>
          </Link>
        </div>
      </div>

      {/* Search + Filtros avanzados */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por socio, email o descripción..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-colors ${
            hasActiveFilters
              ? "border-[#3b8bea] bg-blue-50 text-[#3b8bea] hover:bg-blue-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Info className="h-4 w-4" />
          Filtros{hasActiveFilters && <span className="rounded-full bg-[#3b8bea] px-1.5 text-[10px] font-semibold text-white">
            {[filterMethod !== "all", filterStatus !== "all", filterConcept !== "all", filterDateFrom !== "", filterDateTo !== ""].filter(Boolean).length}
          </span>}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-transparent px-3 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Forma de pago
            </label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as DbPaymentMethod | "all")}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="all">Todas</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="bank_transfer">Transferencia</option>
              <option value="sepa">SEPA</option>
              <option value="stripe">Stripe</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estado
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="processing">Procesando</option>
              <option value="completed">Cobrado</option>
              <option value="cancelled">Cancelado</option>
              <option value="refunded">Reembolsado</option>
              <option value="failed">Fallido</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tipo venta
            </label>
            <select
              value={filterConcept}
              onChange={(e) => setFilterConcept(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="all">Todas</option>
              <option value="subscription">Cuota / Suscripción</option>
              <option value="bonus">Bono</option>
              <option value="product">Producto</option>
              <option value="penalty">Penalización</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Desde
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Hasta
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
          <p className="col-span-full text-[11px] text-slate-500">
            Filtros se aplican sobre la pestaña activa (<strong>{activeTab}</strong>). Fecha filtra por
            fecha de cobro <code>paid_at</code> si existe, o fecha de creación en su defecto.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg bg-slate-50 px-4 py-2.5 space-y-1.5">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{visible.length} resultados</span>
          {" · Total: "}
          <span className="font-semibold text-slate-800">{formatEUR(totalVisible)}</span>
        </p>
        {activeTab === "finalizados" && (
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Cobrado por método:</span>{" "}
            {(
              [
                ["cash", "Efectivo"],
                ["card", "Tarjeta"],
                ["bank_transfer", "Transferencia"],
                ["sepa", "SEPA"],
                ["stripe", "Stripe"],
                ["manual", "Manual"],
              ] as [DbPaymentMethod, string][]
            )
              .filter(([m]) => totalsByMethod[m].count > 0)
              .map(([m, label], i, arr) => (
                <span key={m}>
                  <span className="text-slate-700">{label}</span>{" "}
                  <span className="font-semibold text-slate-800">
                    {totalsByMethod[m].count}
                  </span>
                  {" · "}
                  <span className="font-semibold text-slate-800">
                    {formatEUR(totalsByMethod[m].amount)}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="mx-2 text-slate-300">│</span>
                  )}
                </span>
              ))}
            {Object.values(totalsByMethod).every((v) => v.count === 0) && (
              <span className="italic text-slate-400">Sin cobros completados</span>
            )}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 pb-3 pt-4">Socio</th>
                <th className="px-4 pb-3 pt-4">Descripción</th>
                <th className="px-4 pb-3 pt-4 text-right">Importe</th>
                <th className="px-4 pb-3 pt-4">Método</th>
                <th className="px-4 pb-3 pt-4">Estado</th>
                <th className="px-4 pb-3 pt-4">Vencimiento</th>
                <th className="px-4 pb-3 pt-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    {payments.length === 0
                      ? "No hay pagos todavía. Crea el primero con el botón \u201CNuevo pago\u201D."
                      : "No hay pagos que coincidan con los filtros"}
                  </td>
                </tr>
              ) : (
                visible.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[10px] font-semibold text-purple-700">
                          {getInitials(p.memberName)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{p.memberName}</p>
                          {p.memberEmail && (
                            <p className="text-[11px] text-slate-400">{p.memberEmail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.description}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatEUR(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {METHOD_LABEL[p.method]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.status === "completed"
                        ? formatDate(p.paidAt)
                        : formatDate(p.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(p.status === "pending" || p.status === "processing") && (
                          <>
                            <button
                              title="Generar link de cobro (Stripe Checkout)"
                              onClick={() => openLinkModal(p)}
                              disabled={isPending}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                            <button
                              title="Marcar como cobrado"
                              onClick={() => openMarkPaid(p)}
                              disabled={isPending}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              title="Cancelar pago"
                              onClick={() => openCancel(p)}
                              disabled={isPending}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {p.status === "completed" && (
                          <span className="text-[11px] text-slate-400" title="Los pagos completados son inmutables (snapshot histórico para contabilidad)">
                            <InfoIcon className="inline h-3.5 w-3.5 text-slate-300" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nuevo pago */}
      {newPaymentOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeNewPayment}
        >
          <div
            className="relative mx-4 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Nuevo pago</h2>
              <button
                onClick={closeNewPayment}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Socio
                </label>
                <select
                  value={formMemberId}
                  onChange={(e) => setFormMemberId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  {members.length === 0 && <option value="">Sin socios activos</option>}
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Tarifa (opcional — autocompleta descripción e importe)
                </label>
                <select
                  value={formTariffId}
                  onChange={(e) => handleTariffChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  <option value="">Sin tarifa (manual)</option>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.group ? `${t.group} — ` : ""}
                      {t.name} ({formatEUR(t.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ej: Mensualidad abril 2026"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Importe (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Método
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as DbPaymentMethod)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="manual">Manual</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="bank_transfer">Transferencia</option>
                    <option value="sepa">SEPA (domiciliación)</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Vencimiento (opcional)
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formMarkPaid}
                  onChange={(e) => setFormMarkPaid(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Marcar como cobrado ahora
                <span className="ml-auto text-xs text-slate-400">
                  (pasará directo a Finalizados)
                </span>
              </label>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <Info className="h-4 w-4 shrink-0" />
                Se crea un snapshot inmutable de la tarifa y los datos del socio para
                facturación histórica.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeNewPayment}
                  disabled={isPending}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={savePayment}
                  disabled={isPending || members.length === 0}
                  className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
                >
                  {isPending ? "Guardando..." : "Guardar pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Marcar como cobrado */}
      {markPaidTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeMarkPaid}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Marcar como cobrado</h2>
              <button
                onClick={closeMarkPaid}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-800">{markPaidTarget.memberName}</p>
                <p className="text-slate-600">{markPaidTarget.description}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {formatEUR(markPaidTarget.amount)}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Método de cobro
                </label>
                <select
                  value={markPaidMethod}
                  onChange={(e) => setMarkPaidMethod(e.target.value as DbPaymentMethod)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="bank_transfer">Transferencia bancaria</option>
                  <option value="sepa">SEPA</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
              {markPaidMethod === "bank_transfer" && (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Referencia de la transferencia <span className="text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={markPaidReference}
                    onChange={(e) => setMarkPaidReference(e.target.value)}
                    placeholder="Nº operación, concepto o últimos 4 dígitos del IBAN"
                    maxLength={100}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Se guarda en el pago para conciliación posterior con el extracto bancario.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Info className="h-4 w-4 shrink-0" />
                Tras marcarlo como cobrado, el pago será <strong>inmutable</strong>.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={closeMarkPaid}
                  disabled={isPending}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={confirmMarkPaid}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isPending ? "Guardando..." : "Confirmar cobro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeCancel}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Cancelar pago</h2>
              <button
                onClick={closeCancel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              ¿Cancelar el pago de{" "}
              <span className="font-semibold text-slate-900">{cancelTarget.memberName}</span>{" "}
              por <span className="font-semibold">{formatEUR(cancelTarget.amount)}</span>?
              El pago quedará en estado <em>cancelado</em> (soft, no se borra).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeCancel}
                disabled={isPending}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={confirmCancel}
                disabled={isPending}
                className="h-9 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Link de cobro Stripe</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Envía este enlace al socio por WhatsApp o email. Podrá pagar con tarjeta sin
                  necesidad de registrarse.
                </p>
              </div>
              <button
                onClick={closeLinkModal}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-medium">{linkModal.payment.memberName}</div>
              <div>{linkModal.payment.description}</div>
              <div className="mt-1 font-semibold">{formatEUR(linkModal.payment.amount)}</div>
            </div>

            {linkModal.loading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                Generando link seguro…
              </div>
            ) : linkModal.error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {linkModal.error}
              </div>
            ) : linkModal.url ? (
              <>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <code className="flex-1 truncate text-xs text-slate-600">{linkModal.url}</code>
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    {linkModal.copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola ${linkModal.payment.memberName}, tu pago de ${formatEUR(linkModal.payment.amount)} en FitFlow: ${linkModal.url}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Enviar por WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent("Link de pago FitFlow")}&body=${encodeURIComponent(
                      `Hola ${linkModal.payment.memberName},\n\nAdjunto link de pago por ${formatEUR(linkModal.payment.amount)}:\n${linkModal.url}\n\nGracias.`
                    )}`}
                    className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    Enviar por email
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-[#3b8bea] text-[#3b8bea]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          active ? "bg-blue-50 text-[#3b8bea]" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: PaymentRow["status"] }) {
  const cfg: Record<
    PaymentRow["status"],
    { bg: string; text: string; ring: string }
  > = {
    pending: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
    processing: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
    completed: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
    },
    failed: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
    refunded: { bg: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200" },
    cancelled: { bg: "bg-slate-100", text: "text-slate-500", ring: "ring-slate-200" },
  };
  const c = cfg[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${c.bg} ${c.text} ${c.ring}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle: string;
  tone: "amber" | "emerald" | "blue";
}) {
  const toneMap = {
    amber: "border-amber-200 bg-amber-50",
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
