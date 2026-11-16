"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Download,
  MessageSquare,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  CheckCircle2,
  Clock,
  UserPlus,
  Loader2,
} from "lucide-react";
import {
  createMemberAction,
  updateMemberAction,
  deleteMemberAction,
  inviteMemberAction,
  inviteAllPendingMembersAction,
} from "./actions";
import { createConversationAction } from "../mensajes/actions";
import type { MemberRow, InviteStatus } from "./data";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { SOCIOS_TOUR } from "@/lib/tours";

type ModalType = "none" | "new" | "edit" | "detail" | "message" | "confirm-delete";

type RgpdConsentSource =
  | ""
  | "paper_signed"
  | "email_confirmed"
  | "in_person_verbal_logged"
  | "digital_signature";

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  tariffId: string;
  paymentMethod: string;
  rgpdConsent: boolean;
  rgpdConsentSource: RgpdConsentSource;
}

type TariffOption = { id: string; name: string; group: string };

type Props = {
  initialMembers: MemberRow[];
  totalCount: number;
  tariffs: TariffOption[];
  seenTourKeys: string[];
};

/* ─── Status Badge ─── */
const statusStyles: Record<MemberRow["status"], string> = {
  Activo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  Inactivo: "bg-slate-100 text-slate-500 ring-slate-200",
  Bloqueado: "bg-red-50 text-red-600 ring-red-200",
};

/* ─── Avatar Initials ─── */
function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.substring(0, 2).toUpperCase() ?? "";
}

const avatarColors = [
  "bg-blue-100 text-[#3b8bea]",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-600",
  "bg-cyan-100 text-cyan-700",
];

/* ─── Select Component ─── */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ─── Modal Overlay ─── */
function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function SociosClient({
  initialMembers,
  totalCount,
  tariffs,
  seenTourKeys,
}: Props) {
  const router = useRouter();
  const [members, setMembersState] = useState<MemberRow[]>(initialMembers);
  // Sincronizar members cuando llegan nuevos props (tras router.refresh())
  useEffect(() => {
    setMembersState(initialMembers);
  }, [initialMembers]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [tariffFilter, setTariffFilter] = useState("Todas");
  const [paymentFilter, setPaymentFilter] = useState("Todas");

  const [modalType, setModalType] = useState<ModalType>("none");
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    email: "",
    phone: "",
    tariffId: "",
    paymentMethod: "Manual",
    rgpdConsent: false,
    rgpdConsentSource: "",
  });
  const [messageText, setMessageText] = useState("");
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const closeModal = useCallback(() => {
    setModalType("none");
    setSelectedMember(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      tariffId: "",
      paymentMethod: "Manual",
      rgpdConsent: false,
      rgpdConsentSource: "",
    });
    setMessageText("");
    setActionMessage(null);
  }, []);

  const openNewMember = useCallback(() => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      tariffId: tariffs[0]?.id ?? "",
      paymentMethod: "Manual",
      rgpdConsent: false,
      rgpdConsentSource: "",
    });
    setActionMessage(null);
    setModalType("new");
  }, [tariffs]);

  const openEditMember = useCallback(
    (m: MemberRow) => {
      setSelectedMember(m);
      // Buscar el tariffId del nombre de tarifa del socio
      const matchingTariff = tariffs.find((t) => t.name === m.tariff);
      setFormData({
        name: m.name,
        email: m.email,
        phone: m.phone,
        tariffId: matchingTariff?.id ?? "",
        paymentMethod: m.paymentMethod ?? "Manual",
        rgpdConsent: true, // edit: asumir consentimiento previo ya registrado
        rgpdConsentSource: "paper_signed",
      });
      setActionMessage(null);
      setModalType("edit");
    },
    [tariffs]
  );

  const openDetailMember = useCallback((m: MemberRow) => {
    setSelectedMember(m);
    setModalType("detail");
  }, []);

  const openConfirmDelete = useCallback((m: MemberRow) => {
    setSelectedMember(m);
    setActionMessage(null);
    setModalType("confirm-delete");
  }, []);

  const openMessage = useCallback(() => {
    setMessageText("");
    setActionMessage(null);
    setModalType("message");
  }, []);

  const handleSaveMember = useCallback(() => {
    if (!formData.name.trim()) {
      setActionMessage({ type: "error", text: "El nombre es obligatorio" });
      return;
    }

    // RGPD Art. 7 gate (solo al crear — edit no re-captura consentimiento)
    if (modalType === "new") {
      if (!formData.rgpdConsent) {
        setActionMessage({
          type: "error",
          text: "Debes confirmar que el socio ha otorgado consentimiento RGPD.",
        });
        return;
      }
      if (!formData.rgpdConsentSource) {
        setActionMessage({
          type: "error",
          text: "Indica cómo se recabó el consentimiento (firmado, email, verbal, digital).",
        });
        return;
      }
    }

    const fd = new FormData();
    fd.set("name", formData.name);
    fd.set("email", formData.email);
    fd.set("phone", formData.phone);
    fd.set("tariffId", formData.tariffId);
    fd.set("paymentMethod", formData.paymentMethod);
    if (modalType === "new") {
      fd.set("rgpdConsent", formData.rgpdConsent ? "on" : "");
      fd.set("rgpdConsentSource", formData.rgpdConsentSource);
    }

    startTransition(async () => {
      let result;
      if (modalType === "new") {
        result = await createMemberAction({}, fd);
      } else if (modalType === "edit" && selectedMember) {
        fd.set("id", selectedMember.id);
        result = await updateMemberAction({}, fd);
      } else {
        return;
      }

      if (result.error) {
        setActionMessage({ type: "error", text: result.error });
      } else {
        setActionMessage({
          type: "success",
          text: result.success ?? "Guardado",
        });
        router.refresh();
        setTimeout(() => closeModal(), 900);
      }
    });
  }, [modalType, formData, selectedMember, closeModal, router]);

  const handleConfirmDelete = useCallback(() => {
    if (!selectedMember) return;
    startTransition(async () => {
      const result = await deleteMemberAction(selectedMember.id);
      if (result.error) {
        setActionMessage({ type: "error", text: result.error });
      } else {
        setActionMessage({
          type: "success",
          text: result.success ?? "Socio dado de baja",
        });
        router.refresh();
        setTimeout(() => closeModal(), 900);
      }
    });
  }, [selectedMember, closeModal, router]);

  const handleInviteMember = useCallback(
    (m: MemberRow) => {
      startTransition(async () => {
        const result = await inviteMemberAction(m.id);
        if (result.error) {
          setActionMessage({ type: "error", text: result.error });
        } else {
          setActionMessage({
            type: "success",
            text: result.success ?? `Invitación enviada a ${m.email}`,
          });
          router.refresh();
        }
        setTimeout(() => setActionMessage(null), 3000);
      });
    },
    [router]
  );

  const handleInviteAll = useCallback(() => {
    startTransition(async () => {
      const result = await inviteAllPendingMembersAction();
      setActionMessage({
        type: result.errors.length === 0 ? "success" : "error",
        text: `Invitaciones: ${result.sent} enviadas, ${result.skipped} omitidas, ${result.errors.length} errores (total ${result.total})`,
      });
      router.refresh();
      setTimeout(() => setActionMessage(null), 5000);
    });
  }, [router]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const term = search.toLowerCase();
      const matchSearch =
        !term ||
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.phone.toLowerCase().includes(term) ||
        m.tariff.toLowerCase().includes(term);

      const matchStatus =
        statusFilter === "Todos" || m.status === statusFilter;

      const matchTariff =
        tariffFilter === "Todas" || m.tariffGroup === tariffFilter;

      const matchPayment =
        paymentFilter === "Todas" || m.paymentMethod === paymentFilter;

      return matchSearch && matchStatus && matchTariff && matchPayment;
    });
  }, [members, search, statusFilter, tariffFilter, paymentFilter]);

  const handleSendMessage = useCallback(() => {
    const content = messageText.trim();
    if (!content) {
      setActionMessage({ type: "error", text: "Escribe un mensaje antes de enviar" });
      return;
    }
    startTransition(async () => {
      const withEmail = filtered.filter((m) => m.email && m.email.trim())
      if (withEmail.length === 0) {
        setActionMessage({
          type: "error",
          text: "Ningún socio filtrado tiene email registrado",
        });
        return;
      }
      let sent = 0;
      let errors = 0;
      for (const m of withEmail) {
        const res = await createConversationAction(m.id, content);
        if (res.error) errors++;
        else sent++;
      }
      setActionMessage({
        type: errors === 0 ? "success" : "error",
        text: `Mensaje enviado a ${sent} socio${sent !== 1 ? "s" : ""}${errors > 0 ? ` · ${errors} error${errors !== 1 ? "es" : ""}` : ""}`,
      });
      router.refresh();
      setTimeout(() => closeModal(), 2000);
    });
  }, [messageText, filtered, closeModal, router]);

  const handleExportCSV = () => {
    const headers = [
      "Nombre",
      "Email",
      "Telefono",
      "Tarifa",
      "Estado",
      "Forma de pago",
      "Fecha alta",
      "Ultima reserva",
    ];
    const rows = filtered.map((m) => [
      m.name,
      m.email,
      m.phone,
      m.tariff,
      m.status,
      m.paymentMethod ?? "",
      m.joinDate,
      m.lastBooking ?? "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <FeatureTour tourKey="socios-v1" steps={SOCIOS_TOUR} seenTourKeys={seenTourKeys} />
      {/* Header */}
      <div
        data-tour="socios-header"
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Socios
          </h1>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
            {totalCount}
          </span>
          <HowItWorksButton steps={SOCIOS_TOUR} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            data-tour="socios-new-btn"
            onClick={openNewMember}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Nuevo socio
          </button>
          {(() => {
            const pendingCount = members.filter((m) => m.inviteStatus === "none" && m.email).length;
            if (pendingCount === 0) return null;
            return (
              <button
                onClick={handleInviteAll}
                disabled={isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 text-[13px] font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invitar a la app ({pendingCount})
              </button>
            );
          })()}
          <button
            data-tour="socios-export"
            onClick={handleExportCSV}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={openMessage}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            Enviar mensaje
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div data-tour="socios-search" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "Todos", label: "Estado: Todos" },
              { value: "Activo", label: "Activo" },
              { value: "Pendiente", label: "Pendiente" },
              { value: "Inactivo", label: "Inactivo" },
              { value: "Bloqueado", label: "Bloqueado" },
            ]}
          />
          <FilterSelect
            label="Tarifa"
            value={tariffFilter}
            onChange={setTariffFilter}
            options={[
              { value: "Todas", label: "Tarifa: Todas" },
              { value: "Dinamico", label: "Dinamico" },
              { value: "Premium", label: "Premium" },
              { value: "Salud", label: "Salud" },
              { value: "Personal", label: "Personal" },
            ]}
          />
          <FilterSelect
            label="Forma de pago"
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              { value: "Todas", label: "Pago: Todas" },
              { value: "Manual", label: "Manual" },
              { value: "SEPA", label: "SEPA" },
              { value: "Tarjeta", label: "Tarjeta" },
              { value: "Stripe", label: "Stripe" },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Nombre</th>
                <th className="px-5 py-3.5">Tarifa</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Ultima reserva</th>
                <th className="px-5 py-3.5">Forma de pago</th>
                <th className="px-5 py-3.5">Fecha alta</th>
                <th className="px-5 py-3.5">App</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr
                  key={m.id}
                  className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[idx % avatarColors.length]}`}
                      >
                        {getInitials(m.name)}
                      </div>
                      <span className="font-medium text-slate-800">
                        {m.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{m.tariff}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusStyles[m.status]}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {m.lastBooking ?? (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {m.paymentMethod ?? (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{m.joinDate}</td>
                  <td className="px-5 py-3">
                    <InviteBadgeCell member={m} onInvite={handleInviteMember} disabled={isPending} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Ver ficha completa"
                        onClick={() => router.push(`/socios/${m.id}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        title="Editar"
                        onClick={() => openEditMember(m)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Dar de baja"
                        onClick={() => openConfirmDelete(m)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    {members.length === 0
                      ? "No hay socios todavia. Crea el primero con el boton \u201CNuevo socio\u201D."
                      : "No se encontraron socios con los filtros aplicados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-[13px] text-slate-500">
            Mostrando{" "}
            <span className="font-medium text-slate-700">
              {filtered.length}
            </span>{" "}
            de{" "}
            <span className="font-medium text-slate-700">{totalCount}</span>{" "}
            socios
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#3b8bea] px-2 text-xs font-medium text-white">
              1
            </button>
            <button
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo / Editar socio */}
      {(modalType === "new" || modalType === "edit") && (
        <ModalOverlay onClose={closeModal}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {modalType === "new" ? "Nuevo socio" : "Editar socio"}
            </h2>
            <button
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Nombre completo
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ej: María García López"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, email: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Telefono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, phone: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Tarifa
              </label>
              <select
                value={formData.tariffId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, tariffId: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              >
                <option value="">Sin tarifa</option>
                {tariffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.group})
                  </option>
                ))}
              </select>
              {tariffs.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No hay tarifas creadas todavia. Puedes crear el socio sin tarifa y asignarsela despues.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Forma de pago
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    paymentMethod: e.target.value,
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              >
                <option value="Manual">Manual</option>
                <option value="SEPA">SEPA</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Stripe">Stripe</option>
              </select>
            </div>
          </div>

          {/* Consentimiento RGPD — obligatorio al crear (Art. 7) */}
          {modalType === "new" && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <input
                  id="rgpd-consent-checkbox"
                  type="checkbox"
                  checked={formData.rgpdConsent}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, rgpdConsent: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300 text-[#3b8bea]"
                />
                <label
                  htmlFor="rgpd-consent-checkbox"
                  className="text-[12px] text-amber-900 leading-relaxed"
                >
                  <strong>Confirmo que este socio ha otorgado consentimiento RGPD</strong>{" "}
                  (Art. 7) para el tratamiento de sus datos personales por parte del centro.
                  Soy responsable de conservar la evidencia física o digital del
                  consentimiento en caso de auditoría AEPD.
                </label>
              </div>
              {formData.rgpdConsent && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-amber-900">
                    ¿Cómo se recabó? *
                  </label>
                  <select
                    value={formData.rgpdConsentSource}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        rgpdConsentSource: e.target
                          .value as RgpdConsentSource,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-amber-300 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">— Selecciona —</option>
                    <option value="paper_signed">Firmado en papel</option>
                    <option value="email_confirmed">Email confirmado (double opt-in)</option>
                    <option value="in_person_verbal_logged">Verbal in situ (registrado)</option>
                    <option value="digital_signature">Firma digital</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {actionMessage && (
            <div
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                actionMessage.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {actionMessage.text}
            </div>
          )}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={closeModal}
              disabled={isPending}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveMember}
              disabled={isPending}
              className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Detalle */}
      {modalType === "detail" && selectedMember && (
        <ModalOverlay onClose={closeModal}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Detalle del socio
            </h2>
            <button
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3">
            {(
              [
                ["Nombre", selectedMember.name],
                ["Email", selectedMember.email || "\u2014"],
                ["Telefono", selectedMember.phone || "\u2014"],
                ["Tarifa", selectedMember.tariff],
                ["Estado", selectedMember.status],
                [
                  "Forma de pago",
                  selectedMember.paymentMethod ?? "\u2014",
                ],
                ["Fecha alta", selectedMember.joinDate],
                [
                  "Ultima reserva",
                  selectedMember.lastBooking ?? "\u2014",
                ],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="text-[13px] font-medium text-slate-500">
                  {label}
                </span>
                <span className="text-[13px] font-semibold text-slate-800">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={closeModal}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Confirm delete */}
      {modalType === "confirm-delete" && selectedMember && (
        <ModalOverlay onClose={closeModal}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Dar de baja socio
            </h2>
            <button
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600">
            ¿Quieres dar de baja a{" "}
            <span className="font-semibold text-slate-900">
              {selectedMember.name}
            </span>
            ? El socio pasara a estado Inactivo. Sus datos se conservan para
            historico (RGPD + contabilidad).
          </p>
          {actionMessage && (
            <div
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                actionMessage.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {actionMessage.text}
            </div>
          )}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={closeModal}
              disabled={isPending}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="h-9 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {isPending ? "Procesando..." : "Confirmar baja"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Enviar mensaje */}
      {modalType === "message" && (
        <ModalOverlay onClose={closeModal}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Enviar mensaje
            </h2>
            <button
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {actionMessage?.type === "success" ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-700">
                {actionMessage.text}
              </p>
            </div>
          ) : (
            <>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                Se creará una conversación 1:1 con cada socio de la lista filtrada que tenga email.
                Ver el hilo en <span className="font-medium">Mensajes</span>.
              </p>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendMessage}
                  className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </ModalOverlay>
      )}
    </div>
  );
}

/* ─── InviteBadgeCell — estado + botón invitar por row ─── */
function InviteBadgeCell({
  member,
  onInvite,
  disabled,
}: {
  member: MemberRow;
  onInvite: (m: MemberRow) => void;
  disabled: boolean;
}) {
  const status = member.inviteStatus;

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Activada
      </span>
    );
  }

  if (status === "pending") {
    const sentDate = member.inviteSentAt ? new Date(member.inviteSentAt).toLocaleDateString("es-ES") : "";
    return (
      <div className="flex flex-col items-start gap-1">
        <span
          title={`Invitación enviada ${sentDate} (${member.inviteCount}/3 intentos)`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"
        >
          <Clock className="h-3 w-3" />
          Pendiente ({member.inviteCount}/3)
        </span>
        <button
          type="button"
          onClick={() => onInvite(member)}
          disabled={disabled}
          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
        >
          Reenviar
        </button>
      </div>
    );
  }

  if (status === "no_email") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
        Sin email
      </span>
    );
  }

  if (status === "max_reached") {
    return (
      <span
        title="Se enviaron 3 invitaciones sin activación. Contacta al socio directamente."
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"
      >
        Máx 3/3
      </span>
    );
  }

  // status === 'none'
  return (
    <button
      type="button"
      onClick={() => onInvite(member)}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
    >
      <Mail className="h-3 w-3" />
      Invitar
    </button>
  );
}
