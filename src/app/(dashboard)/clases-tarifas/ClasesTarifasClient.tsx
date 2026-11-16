"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, X, RefreshCw } from "lucide-react";
import {
  createTariffAction,
  updateTariffAction,
  toggleTariffActiveAction,
  createInstructorAction,
  updateInstructorAction,
  toggleInstructorActiveAction,
  createClassAction,
  updateClassAction,
  toggleClassActiveAction,
  generateClassInstancesAction,
} from "./actions";
import type { TariffRow, GroupColor, ClassRow, ClassType, InstructorRow } from "./types";
import type { Agenda } from "./agendas";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { CLASES_TARIFAS_TOUR } from "@/lib/tours";
import { getDayName } from "./types";
import AgendasTab from "./AgendasTab";

type Props = {
  initialTariffs: TariffRow[];
  initialClasses: ClassRow[];
  initialInstructors: InstructorRow[];
  initialAgendas: Agenda[];
  seenTourKeys: string[];
};

type ClasesTarifasTab = "clases" | "tarifas" | "instructores" | "agendas";

/* ─── Modal ─── */
function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  if (!open) return null;
  const maxW = size === "lg" ? "max-w-xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`w-full ${maxW} rounded-xl bg-white p-6 shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Toast ─── */
function Toast({ message, type = "success" }: { message: string; type?: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
        type === "error" ? "bg-red-600" : "bg-emerald-600"
      }`}
    >
      {message}
    </div>
  );
}

const dotColors: Record<GroupColor, string> = {
  blue: "bg-[#3b8bea]",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
};

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none";
const labelClass = "block text-[13px] font-medium text-slate-600 mb-1";

/* ─── Tab Button ─── */
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-[#3b8bea] text-[#3b8bea]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   CLASES TAB
   ═════════════════════════════════════════════════════════════════════════ */

const CLASS_TYPE_OPTIONS: Array<{ value: ClassType; label: string }> = [
  { value: "grupal", label: "Grupal" },
  { value: "dinamico", label: "Dinámico" },
  { value: "premium", label: "Premium (reducido)" },
  { value: "salud", label: "Salud" },
  { value: "personal_1h", label: "Personal 1h" },
  { value: "personal_30min", label: "Personal 30min" },
];

const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  grupal: "Grupal",
  dinamico: "Dinámico",
  premium: "Premium",
  salud: "Salud",
  personal_1h: "Personal 1h",
  personal_30min: "Personal 30min",
};

function ClasesTab({
  classes,
  instructors,
  onNewClass,
  onEditClass,
  onToggleClass,
  onGenerateInstances,
  isPending,
}: {
  classes: ClassRow[];
  instructors: InstructorRow[];
  onNewClass: () => void;
  onEditClass: (c: ClassRow) => void;
  onToggleClass: (c: ClassRow) => void;
  onGenerateInstances: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Plantillas semanales. Cada fila es un horario fijo (ej: lunes 10:00 CrossFit con Juan). Las reservas se crean sobre las{" "}
          <em>instancias</em> generadas desde estas plantillas.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onGenerateInstances}
            disabled={isPending || classes.filter((c) => c.isActive).length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            title="Genera instancias de clase para los próximos 14 días según las plantillas activas"
          >
            <RefreshCw className="h-4 w-4" />
            Generar 14 días
          </button>
          <button
            onClick={onNewClass}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Nueva clase
          </button>
        </div>
      </div>

      {instructors.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sugerencia: crea al menos un instructor desde la pestaña <strong>Instructores</strong> antes de crear clases.
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 pb-3 pt-4">Día</th>
                <th className="px-4 pb-3 pt-4">Horario</th>
                <th className="px-4 pb-3 pt-4">Clase</th>
                <th className="px-4 pb-3 pt-4">Tipo</th>
                <th className="px-4 pb-3 pt-4">Instructor</th>
                <th className="px-4 pb-3 pt-4">Plazas</th>
                <th className="px-4 pb-3 pt-4">Sala</th>
                <th className="px-4 pb-3 pt-4">Estado</th>
                <th className="px-4 pb-3 pt-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay clases todavía. Crea la primera con el botón &ldquo;Nueva clase&rdquo;.
                  </td>
                </tr>
              )}
              {classes.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-slate-50 last:border-0 ${!c.isActive ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 text-slate-700">{getDayName(c.dayOfWeek)}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-slate-600">
                    {c.startTime} – {c.endTime}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {CLASS_TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.instructorName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.maxSpots}
                    {c.waitlistSize > 0 && (
                      <span className="ml-1 text-xs text-slate-400">(+{c.waitlistSize} wl)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.room ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        c.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-slate-100 text-slate-500 ring-slate-200"
                      }`}
                    >
                      {c.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => onEditClass(c)}
                        disabled={isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title={c.isActive ? "Desactivar" : "Activar"}
                        onClick={() => onToggleClass(c)}
                        disabled={isPending}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                          c.isActive
                            ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        }`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   INSTRUCTORES TAB
   ═════════════════════════════════════════════════════════════════════════ */

function InstructoresTab({
  instructors,
  onNewInstructor,
  onEditInstructor,
  onToggleInstructor,
  isPending,
}: {
  instructors: InstructorRow[];
  onNewInstructor: () => void;
  onEditInstructor: (i: InstructorRow) => void;
  onToggleInstructor: (i: InstructorRow) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onNewInstructor}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nuevo instructor
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 pb-3 pt-4">Nombre</th>
                <th className="px-4 pb-3 pt-4">Email</th>
                <th className="px-4 pb-3 pt-4">Teléfono</th>
                <th className="px-4 pb-3 pt-4">Especialidades</th>
                <th className="px-4 pb-3 pt-4">Estado</th>
                <th className="px-4 pb-3 pt-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {instructors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay instructores todavía. Crea el primero con el botón &ldquo;Nuevo instructor&rdquo;.
                  </td>
                </tr>
              )}
              {instructors.map((i) => (
                <tr
                  key={i.id}
                  className={`border-b border-slate-50 last:border-0 ${!i.isActive ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: i.color }}
                      />
                      <span className="font-medium text-slate-800">{i.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {i.email ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {i.phone ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {i.specialties.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {i.specialties.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        i.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-slate-100 text-slate-500 ring-slate-200"
                      }`}
                    >
                      {i.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => onEditInstructor(i)}
                        disabled={isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title={i.isActive ? "Desactivar" : "Activar"}
                        onClick={() => onToggleInstructor(i)}
                        disabled={isPending}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                          i.isActive
                            ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        }`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   TARIFAS TAB (sin cambios desde 9a)
   ═════════════════════════════════════════════════════════════════════════ */

function TarifasTab({
  tariffs,
  onNewTariff,
  onEditTariff,
  onToggleTariff,
  isPending,
}: {
  tariffs: TariffRow[];
  onNewTariff: () => void;
  onEditTariff: (t: TariffRow) => void;
  onToggleTariff: (t: TariffRow) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onNewTariff}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva tarifa
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 pb-3 pt-4">Grupo</th>
                <th className="px-4 pb-3 pt-4">Tarifa</th>
                <th className="px-4 pb-3 pt-4 text-right">Precio</th>
                <th className="px-4 pb-3 pt-4">Tipo</th>
                <th className="px-4 pb-3 pt-4">Estado</th>
                <th className="px-4 pb-3 pt-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay tarifas todavía. Crea la primera con el botón &ldquo;Nueva tarifa&rdquo;.
                  </td>
                </tr>
              )}
              {tariffs.map((t, idx) => {
                const isFirstInGroup = idx === 0 || tariffs[idx - 1].group !== t.group;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-slate-50 last:border-0 ${
                      isFirstInGroup && idx > 0 ? "border-t border-slate-200" : ""
                    } ${!t.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${dotColors[t.groupColor]}`} />
                        <span className="font-medium text-slate-800">{t.group}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{t.priceLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          t.type === "Mensual"
                            ? "bg-blue-50 text-[#3b8bea] ring-1 ring-blue-200"
                            : "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                          t.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-500 ring-slate-200"
                        }`}
                      >
                        {t.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Editar"
                          onClick={() => onEditTariff(t)}
                          disabled={isPending}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={t.isActive ? "Desactivar" : "Activar"}
                          onClick={() => onToggleTariff(t)}
                          disabled={isPending}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                            t.isActive
                              ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════════════ */

export default function ClasesTarifasClient({
  initialTariffs,
  initialClasses,
  initialInstructors,
  initialAgendas,
  seenTourKeys,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClasesTarifasTab>("clases");
  const [tariffs, setTariffs] = useState<TariffRow[]>(initialTariffs);
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses);
  const [instructors, setInstructors] = useState<InstructorRow[]>(initialInstructors);
  const [agendas, setAgendas] = useState<Agenda[]>(initialAgendas);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setTariffs(initialTariffs), [initialTariffs]);
  useEffect(() => setClasses(initialClasses), [initialClasses]);
  useEffect(() => setInstructors(initialInstructors), [initialInstructors]);
  useEffect(() => setAgendas(initialAgendas), [initialAgendas]);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Tariff modal ───
  const [tariffModal, setTariffModal] = useState<"none" | "new" | "edit">("none");
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [tariffGroup, setTariffGroup] = useState("Dinamico");
  const [tariffName, setTariffName] = useState("");
  const [tariffPrice, setTariffPrice] = useState("");
  const [tariffType, setTariffType] = useState<"Mensual" | "Bono">("Mensual");
  const [tariffError, setTariffError] = useState<string | null>(null);

  const openNewTariff = () => {
    setEditingTariffId(null);
    setTariffGroup("Dinamico");
    setTariffName("");
    setTariffPrice("");
    setTariffType("Mensual");
    setTariffError(null);
    setTariffModal("new");
  };
  const openEditTariff = (t: TariffRow) => {
    setEditingTariffId(t.id);
    setTariffGroup(t.group);
    setTariffName(t.name);
    setTariffPrice(t.price.toString());
    setTariffType(t.type);
    setTariffError(null);
    setTariffModal("edit");
  };
  const closeTariffModal = () => {
    setTariffModal("none");
    setEditingTariffId(null);
    setTariffError(null);
  };

  const saveTariff = () => {
    if (!tariffName.trim()) {
      setTariffError("El nombre es obligatorio");
      return;
    }
    const price = parseFloat(tariffPrice.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      setTariffError("Precio inválido");
      return;
    }

    const fd = new FormData();
    fd.set("group", tariffGroup);
    fd.set("name", tariffName.trim());
    fd.set("price", String(price));
    fd.set("type", tariffType);

    startTransition(async () => {
      const result =
        tariffModal === "new"
          ? await createTariffAction({}, fd)
          : editingTariffId
            ? (fd.set("id", editingTariffId), await updateTariffAction({}, fd))
            : { error: "Estado inconsistente" };

      if (result.error) {
        setTariffError(result.error);
      } else {
        router.refresh();
        closeTariffModal();
        showToast(result.success ?? "Tarifa guardada");
      }
    });
  };

  const toggleTariff = (t: TariffRow) => {
    startTransition(async () => {
      const result = await toggleTariffActiveAction(t.id, !t.isActive);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  // ─── Instructor modal ───
  const [instructorModal, setInstructorModal] = useState<"none" | "new" | "edit">("none");
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [instructorEmail, setInstructorEmail] = useState("");
  const [instructorPhone, setInstructorPhone] = useState("");
  const [instructorSpecialties, setInstructorSpecialties] = useState("");
  const [instructorColor, setInstructorColor] = useState("#3b8bea");
  const [instructorError, setInstructorError] = useState<string | null>(null);

  const openNewInstructor = () => {
    setEditingInstructorId(null);
    setInstructorName("");
    setInstructorEmail("");
    setInstructorPhone("");
    setInstructorSpecialties("");
    setInstructorColor("#3b8bea");
    setInstructorError(null);
    setInstructorModal("new");
  };
  const openEditInstructor = (i: InstructorRow) => {
    setEditingInstructorId(i.id);
    setInstructorName(i.name);
    setInstructorEmail(i.email ?? "");
    setInstructorPhone(i.phone ?? "");
    setInstructorSpecialties(i.specialties.join(", "));
    setInstructorColor(i.color);
    setInstructorError(null);
    setInstructorModal("edit");
  };
  const closeInstructorModal = () => {
    setInstructorModal("none");
    setEditingInstructorId(null);
    setInstructorError(null);
  };

  const saveInstructor = () => {
    if (!instructorName.trim()) {
      setInstructorError("El nombre es obligatorio");
      return;
    }

    const fd = new FormData();
    fd.set("name", instructorName.trim());
    fd.set("email", instructorEmail.trim());
    fd.set("phone", instructorPhone.trim());
    fd.set("specialties", instructorSpecialties.trim());
    fd.set("color", instructorColor);

    startTransition(async () => {
      const result =
        instructorModal === "new"
          ? await createInstructorAction({}, fd)
          : editingInstructorId
            ? (fd.set("id", editingInstructorId), await updateInstructorAction({}, fd))
            : { error: "Estado inconsistente" };

      if (result.error) {
        setInstructorError(result.error);
      } else {
        router.refresh();
        closeInstructorModal();
        showToast(result.success ?? "Instructor guardado");
      }
    });
  };

  const toggleInstructor = (i: InstructorRow) => {
    startTransition(async () => {
      const result = await toggleInstructorActiveAction(i.id, !i.isActive);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  // ─── Class modal ───
  const [classModal, setClassModal] = useState<"none" | "new" | "edit">("none");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [classType, setClassType] = useState<ClassType>("grupal");
  const [classInstructorId, setClassInstructorId] = useState("");
  const [classDayOfWeek, setClassDayOfWeek] = useState(1);
  const [classStartTime, setClassStartTime] = useState("10:00");
  const [classEndTime, setClassEndTime] = useState("11:00");
  const [classMaxSpots, setClassMaxSpots] = useState("12");
  const [classWaitlistSize, setClassWaitlistSize] = useState("0");
  const [classRoom, setClassRoom] = useState("");
  const [classError, setClassError] = useState<string | null>(null);

  const openNewClass = () => {
    setEditingClassId(null);
    setClassName("");
    setClassType("grupal");
    setClassInstructorId(instructors.find((i) => i.isActive)?.id ?? "");
    setClassDayOfWeek(1);
    setClassStartTime("10:00");
    setClassEndTime("11:00");
    setClassMaxSpots("12");
    setClassWaitlistSize("0");
    setClassRoom("");
    setClassError(null);
    setClassModal("new");
  };
  const openEditClass = (c: ClassRow) => {
    setEditingClassId(c.id);
    setClassName(c.name);
    setClassType(c.type);
    setClassInstructorId(c.instructorId ?? "");
    setClassDayOfWeek(c.dayOfWeek);
    setClassStartTime(c.startTime);
    setClassEndTime(c.endTime);
    setClassMaxSpots(String(c.maxSpots));
    setClassWaitlistSize(String(c.waitlistSize));
    setClassRoom(c.room ?? "");
    setClassError(null);
    setClassModal("edit");
  };
  const closeClassModal = () => {
    setClassModal("none");
    setEditingClassId(null);
    setClassError(null);
  };

  const saveClass = () => {
    if (!className.trim()) {
      setClassError("El nombre es obligatorio");
      return;
    }

    const fd = new FormData();
    fd.set("name", className.trim());
    fd.set("type", classType);
    fd.set("instructorId", classInstructorId);
    fd.set("dayOfWeek", String(classDayOfWeek));
    fd.set("startTime", classStartTime);
    fd.set("endTime", classEndTime);
    fd.set("maxSpots", classMaxSpots);
    fd.set("waitlistSize", classWaitlistSize);
    fd.set("room", classRoom.trim());

    startTransition(async () => {
      const result =
        classModal === "new"
          ? await createClassAction({}, fd)
          : editingClassId
            ? (fd.set("id", editingClassId), await updateClassAction({}, fd))
            : { error: "Estado inconsistente" };

      if (result.error) {
        setClassError(result.error);
      } else {
        router.refresh();
        closeClassModal();
        showToast(result.success ?? "Clase guardada");
      }
    });
  };

  const toggleClass = (c: ClassRow) => {
    startTransition(async () => {
      const result = await toggleClassActiveAction(c.id, !c.isActive);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  const generateInstances = () => {
    startTransition(async () => {
      const result = await generateClassInstancesAction(14);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Instancias generadas");
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <FeatureTour tourKey="clases-tarifas-v1" steps={CLASES_TARIFAS_TOUR} seenTourKeys={seenTourKeys} />
      <div data-tour="ct-header" className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clases y Tarifas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configuración de clases (plantillas semanales), instructores y tarifas de suscripción
          </p>
        </div>
        <HowItWorksButton steps={CLASES_TARIFAS_TOUR} />
      </div>

      <div data-tour="ct-tabs" className="border-b border-slate-200">
        <div className="flex gap-0">
          <TabButton label="Clases" active={activeTab === "clases"} onClick={() => setActiveTab("clases")} />
          <TabButton
            label="Instructores"
            active={activeTab === "instructores"}
            onClick={() => setActiveTab("instructores")}
          />
          <TabButton label="Tarifas" active={activeTab === "tarifas"} onClick={() => setActiveTab("tarifas")} />
          <TabButton label="Agendas de citas" active={activeTab === "agendas"} onClick={() => setActiveTab("agendas")} />
        </div>
      </div>

      {activeTab === "clases" && (
        <ClasesTab
          classes={classes}
          instructors={instructors}
          onNewClass={openNewClass}
          onEditClass={openEditClass}
          onToggleClass={toggleClass}
          onGenerateInstances={generateInstances}
          isPending={isPending}
        />
      )}

      {activeTab === "instructores" && (
        <InstructoresTab
          instructors={instructors}
          onNewInstructor={openNewInstructor}
          onEditInstructor={openEditInstructor}
          onToggleInstructor={toggleInstructor}
          isPending={isPending}
        />
      )}

      {activeTab === "tarifas" && (
        <TarifasTab
          tariffs={tariffs}
          onNewTariff={openNewTariff}
          onEditTariff={openEditTariff}
          onToggleTariff={toggleTariff}
          isPending={isPending}
        />
      )}

      {activeTab === "agendas" && (
        <AgendasTab agendas={agendas} instructors={instructors} />
      )}

      {/* ─── Tariff modal ─── */}
      <Modal
        open={tariffModal !== "none"}
        onClose={closeTariffModal}
        title={tariffModal === "edit" ? "Editar tarifa" : "Nueva tarifa"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Grupo</label>
            <select value={tariffGroup} onChange={(e) => setTariffGroup(e.target.value)} className={inputClass}>
              <option>Dinamico</option>
              <option>Reducidos</option>
              <option>Salud +65</option>
              <option>Personal</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              type="text"
              value={tariffName}
              onChange={(e) => setTariffName(e.target.value)}
              placeholder="Ej: 4 sesiones/semana"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Precio (EUR)</label>
            <input
              type="number"
              step="0.01"
              value={tariffPrice}
              onChange={(e) => setTariffPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={tariffType}
              onChange={(e) => setTariffType(e.target.value as "Mensual" | "Bono")}
              className={inputClass}
            >
              <option>Mensual</option>
              <option>Bono</option>
            </select>
          </div>
          {tariffError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{tariffError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeTariffModal}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveTariff}
              disabled={isPending}
              className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Instructor modal ─── */}
      <Modal
        open={instructorModal !== "none"}
        onClose={closeInstructorModal}
        title={instructorModal === "edit" ? "Editar instructor" : "Nuevo instructor"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input
              type="text"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={instructorEmail}
              onChange={(e) => setInstructorEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              type="tel"
              value={instructorPhone}
              onChange={(e) => setInstructorPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Especialidades (separadas por coma)</label>
            <input
              type="text"
              value={instructorSpecialties}
              onChange={(e) => setInstructorSpecialties(e.target.value)}
              placeholder="Ej: CrossFit, Funcional, Movilidad"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Color (identificador en horario)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={instructorColor}
                onChange={(e) => setInstructorColor(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded-lg border border-slate-200"
              />
              <input
                type="text"
                value={instructorColor}
                onChange={(e) => setInstructorColor(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {instructorError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {instructorError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeInstructorModal}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveInstructor}
              disabled={isPending}
              className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Class modal ─── */}
      <Modal
        open={classModal !== "none"}
        onClose={closeClassModal}
        title={classModal === "edit" ? "Editar clase" : "Nueva clase"}
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nombre de la clase</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Ej: CrossFit matutino"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value as ClassType)}
                className={inputClass}
              >
                {CLASS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Instructor</label>
              <select
                value={classInstructorId}
                onChange={(e) => setClassInstructorId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sin instructor</option>
                {instructors
                  .filter((i) => i.isActive)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Día</label>
              <select
                value={classDayOfWeek}
                onChange={(e) => setClassDayOfWeek(Number(e.target.value))}
                className={inputClass}
              >
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={0}>Domingo</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Inicio</label>
              <input
                type="time"
                value={classStartTime}
                onChange={(e) => setClassStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Fin</label>
              <input
                type="time"
                value={classEndTime}
                onChange={(e) => setClassEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Plazas máximas</label>
              <input
                type="number"
                min="1"
                value={classMaxSpots}
                onChange={(e) => setClassMaxSpots(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Lista espera</label>
              <input
                type="number"
                min="0"
                value={classWaitlistSize}
                onChange={(e) => setClassWaitlistSize(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sala (opcional)</label>
              <input
                type="text"
                value={classRoom}
                onChange={(e) => setClassRoom(e.target.value)}
                placeholder="Ej: Sala 1"
                className={inputClass}
              />
            </div>
          </div>

          {classError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{classError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeClassModal}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveClass}
              disabled={isPending}
              className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.text} type={toast.type} />}
    </div>
  );
}
