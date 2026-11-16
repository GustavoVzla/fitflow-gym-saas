"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, Calendar, X, AlertCircle, UserPlus } from "lucide-react";
import type {
  ScheduleSlot,
  ScheduleClass,
  WeekInfo,
  DbClassType,
} from "./types";
import {
  COLOR_STYLES,
  TYPE_LABEL,
  TYPE_COLOR_MAP,
  DAY_LABELS_SHORT,
} from "./types";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { HORARIO_TOUR } from "@/lib/tours";
import { cancelClassInstanceAction, createGuestBookingAction } from "./actions";

type Props = {
  weekInfo: WeekInfo;
  slots: ScheduleSlot[];
  instructors: Array<{ id: string; name: string }>;
  todayIso: string;
  seenTourKeys: string[];
  canManage: boolean;
};

const FILTER_TYPES: Array<{ value: DbClassType | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "grupal", label: "Grupal" },
  { value: "dinamico", label: "Dinámico" },
  { value: "premium", label: "Premium" },
  { value: "salud", label: "Salud" },
  { value: "personal_1h", label: "Personal 1h" },
  { value: "personal_30min", label: "Personal 30min" },
];

// Días de semana: Lun(1) → Dom(0). Orden en grid: Lun, Mar, Mié, Jue, Vie, Sáb, Dom
const WEEK_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

function getDateForDay(weekStart: string, dayOfWeek: number): string {
  // weekStart = lunes. dayOfWeek: 1=lun, 2=mar,..., 0=dom
  const monday = new Date(weekStart + "T12:00:00");
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 1→0, 2→1, ..., 0→6
  monday.setDate(monday.getDate() + offset);
  return monday.toISOString().slice(0, 10);
}

export default function HorarioClient({
  weekInfo,
  slots,
  instructors,
  todayIso,
  seenTourKeys,
  canManage,
}: Props) {
  const [filterType, setFilterType] = useState<DbClassType | "all">("all");
  const [filterInstructor, setFilterInstructor] = useState<string>("all");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [cancelTarget, setCancelTarget] = useState<ScheduleClass | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMsg, setCancelMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [guestTarget, setGuestTarget] = useState<ScheduleClass | null>(null);
  const [guestForm, setGuestForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    paymentMethod: "",
    amount: "",
  });
  const [isPending, startTransition] = useTransition();

  function handleCancelConfirm() {
    if (!cancelTarget) return;
    const target = cancelTarget;
    startTransition(async () => {
      const res = await cancelClassInstanceAction(target.instanceId, cancelReason.trim() || undefined);
      if (res.error) {
        setCancelMsg({ type: "error", text: res.error });
      } else {
        setCancelMsg({ type: "success", text: res.success ?? "Clase cancelada" });
        setCancelTarget(null);
        setCancelReason("");
      }
      setTimeout(() => setCancelMsg(null), 4000);
    });
  }

  function handleGuestConfirm() {
    if (!guestTarget) return;
    const target = guestTarget;
    startTransition(async () => {
      const res = await createGuestBookingAction({
        classInstanceId: target.instanceId,
        firstName: guestForm.firstName,
        lastName: guestForm.lastName,
        email: guestForm.email,
        phone: guestForm.phone,
        paymentMethod: guestForm.paymentMethod,
        amount: guestForm.amount,
      });
      if (res.error) {
        setCancelMsg({ type: "error", text: res.error });
      } else {
        setCancelMsg({ type: "success", text: res.success ?? "Invitado apuntado" });
        setGuestTarget(null);
        setGuestForm({ firstName: "", lastName: "", email: "", phone: "", paymentMethod: "", amount: "" });
      }
      setTimeout(() => setCancelMsg(null), 4000);
    });
  }
  const [showInfo, setShowInfo] = useState<boolean>(true);

  const roomOptions = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      for (const c of slot.classes) {
        if (c.room && c.room.trim()) set.add(c.room.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [slots]);

  const filteredSlots = useMemo(() => {
    if (filterType === "all" && filterInstructor === "all" && filterRoom === "all") return slots;
    return slots
      .map((slot) => ({
        ...slot,
        classes: slot.classes.filter((c) => {
          if (filterType !== "all" && c.type !== filterType) return false;
          if (filterInstructor !== "all" && c.instructorName !== filterInstructor)
            return false;
          if (filterRoom !== "all" && (c.room ?? "") !== filterRoom) return false;
          return true;
        }),
      }))
      .filter((slot) => slot.classes.length > 0);
  }, [slots, filterType, filterInstructor, filterRoom]);

  const getClassesForCell = (slot: ScheduleSlot, dayOfWeek: number): ScheduleClass[] => {
    return slot.classes.filter((c) => c.dayOfWeek === dayOfWeek);
  };

  const totalClasses = slots.reduce((sum, s) => sum + s.classes.length, 0);
  const visibleClasses = filteredSlots.reduce((sum, s) => sum + s.classes.length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <FeatureTour tourKey="horario-v1" steps={HORARIO_TOUR} seenTourKeys={seenTourKeys} />
      {/* Header */}
      <div data-tour="horario-header" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Horario semanal</h1>
            <p className="text-sm text-slate-500">
              {totalClasses} clases esta semana
              {filterType !== "all" || filterInstructor !== "all"
                ? ` · ${visibleClasses} visibles con los filtros`
                : ""}
            </p>
          </div>
          <HowItWorksButton steps={HORARIO_TOUR} />
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      {/* Week navigation + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div data-tour="horario-nav" className="flex items-center gap-3">
          <Link
            href={`/horario${weekInfo.prevWeekQuery}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize text-slate-800">
              {weekInfo.label}
            </span>
            {weekInfo.isCurrentWeek && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#3b8bea] ring-1 ring-blue-200">
                Semana actual
              </span>
            )}
            {!weekInfo.isCurrentWeek && (
              <Link
                href="/horario"
                className="text-[11px] text-[#3b8bea] hover:underline"
              >
                Volver a hoy
              </Link>
            )}
          </div>
          <Link
            href={`/horario${weekInfo.nextWeekQuery}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div data-tour="horario-filters" className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DbClassType | "all")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-[#3b8bea] focus:ring-1 focus:ring-[#3b8bea]"
          >
            {FILTER_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                Tipo: {ft.label}
              </option>
            ))}
          </select>
          <select
            value={filterInstructor}
            onChange={(e) => setFilterInstructor(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-[#3b8bea] focus:ring-1 focus:ring-[#3b8bea]"
          >
            <option value="all">Instructor: Todos</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
          {roomOptions.length > 0 && (
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-[#3b8bea] focus:ring-1 focus:ring-[#3b8bea]"
              title="Filtrar por sala o destino"
            >
              <option value="all">Sala: Todas</option>
              {roomOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <label
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Mostrar / ocultar instructor y sala en cada clase"
          >
            <input
              type="checkbox"
              checked={showInfo}
              onChange={(e) => setShowInfo(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#3b8bea]"
            />
            Información
          </label>
        </div>
      </div>

      {/* Schedule Grid / Empty state */}
      {totalClasses === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Calendar className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            No hay clases programadas esta semana
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Crea plantillas en <Link href="/clases-tarifas" className="text-[#3b8bea] hover:underline">Clases y Tarifas</Link> y genera instancias para los próximos 14 días.
          </p>
        </div>
      ) : visibleClasses === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Calendar className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            No hay clases que coincidan con los filtros
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="w-20 bg-slate-50/80 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Hora
                </th>
                {WEEK_DAYS_ORDER.map((dayOfWeek) => {
                  const date = getDateForDay(weekInfo.weekStart, dayOfWeek);
                  const isToday = date === todayIso;
                  const dayLabelIdx = dayOfWeek;
                  return (
                    <th
                      key={dayOfWeek}
                      className={`px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider ${
                        isToday
                          ? "bg-blue-50/60 text-[#3b8bea]"
                          : "bg-slate-50/80 text-slate-400"
                      }`}
                    >
                      <div>{DAY_LABELS_SHORT[dayLabelIdx]}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(date + "T12:00:00").getDate()}
                      </div>
                      {isToday && (
                        <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#3b8bea]" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredSlots.map((slot) => (
                <tr
                  key={`${slot.startTime}-${slot.endTime}`}
                  className="border-b border-slate-50"
                >
                  <td className="bg-slate-50/50 px-3 py-2 align-top">
                    <div className="text-xs font-medium text-slate-600">
                      {slot.startTime}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {slot.endTime}
                    </div>
                  </td>
                  {WEEK_DAYS_ORDER.map((dayOfWeek) => {
                    const cellClasses = getClassesForCell(slot, dayOfWeek);
                    const cellDate = getDateForDay(weekInfo.weekStart, dayOfWeek);
                    const isToday = cellDate === todayIso;
                    return (
                      <td
                        key={dayOfWeek}
                        className={`px-1.5 py-1.5 align-top ${
                          isToday ? "bg-blue-50/20" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          {cellClasses.map((c) => (
                            <ClassCell
                              key={c.instanceId}
                              cls={c}
                              showInfo={showInfo}
                              canManage={canManage}
                              onCancel={() => setCancelTarget(c)}
                              onAddGuest={() => setGuestTarget(c)}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200/80 bg-white px-5 py-3 shadow-sm">
        {Object.entries(TYPE_COLOR_MAP).map(([type, colorGroup]) => {
          const styles = COLOR_STYLES[colorGroup];
          return (
            <div key={type} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
              <span className="text-xs font-medium text-slate-600">
                {TYPE_LABEL[type as DbClassType]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Toast cancel result */}
      {cancelMsg && (
        <div
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg ${
            cancelMsg.type === "error"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-emerald-50 border border-emerald-200 text-emerald-800"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          {cancelMsg.text}
        </div>
      )}

      {/* Modal Add Guest */}
      {guestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setGuestTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-500" />
              Añadir invitado
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Apuntar persona no-socio a <strong>{guestTarget.name}</strong> del{" "}
              <strong>{guestTarget.date}</strong> a las{" "}
              <strong>{guestTarget.startTime}</strong>.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestForm.firstName}
                  onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                  maxLength={100}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestForm.lastName}
                  onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                  maxLength={100}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={guestForm.email}
                  onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                  maxLength={200}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={guestForm.phone}
                  onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                  maxLength={30}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cobro (opcional)
                </label>
                <select
                  value={guestForm.paymentMethod}
                  onChange={(e) => setGuestForm({ ...guestForm, paymentMethod: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm bg-white"
                >
                  <option value="">Sin cobro</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="manual">Manual</option>
                  <option value="bank_transfer">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Importe (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={guestForm.amount}
                  onChange={(e) => setGuestForm({ ...guestForm, amount: e.target.value })}
                  disabled={!guestForm.paymentMethod}
                  placeholder={guestForm.paymentMethod ? "0.00" : "—"}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              El invitado se crea como socio con flag <code className="bg-slate-100 px-1 rounded">is_guest=true</code>. No recibe comunicaciones automáticas.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGuestTarget(null)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuestConfirm}
                disabled={
                  isPending ||
                  guestForm.firstName.trim().length === 0 ||
                  guestForm.lastName.trim().length === 0
                }
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Añadiendo…" : "Añadir invitado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancel Class */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setCancelTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Cancelar clase
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Vas a cancelar <strong>{cancelTarget.name}</strong> del{" "}
              <strong>{cancelTarget.date}</strong> a las{" "}
              <strong>{cancelTarget.startTime}</strong>. Esta acción:
            </p>
            <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-1">
              <li>Marcará la clase como cancelada (no revertible)</li>
              <li>Cancelará todas las reservas ({cancelTarget.bookedCount}) y liberará las plazas</li>
              <li>Notificará a los socios afectados con cuenta FitFlow</li>
            </ul>
            <label className="mt-4 block text-xs font-medium text-slate-700">
              Motivo (opcional, visible para socios)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value.slice(0, 500))}
              placeholder="Ej: Instructor enfermo, emergencia en las instalaciones…"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Cancelando…" : "Cancelar clase"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCell({
  cls,
  showInfo,
  canManage,
  onCancel,
  onAddGuest,
}: {
  cls: ScheduleClass;
  showInfo: boolean;
  canManage: boolean;
  onCancel: () => void;
  onAddGuest: () => void;
}) {
  const styles = COLOR_STYLES[cls.colorGroup];
  const isFull = cls.bookedCount >= cls.maxSpots;
  const isCancelled = cls.status === "cancelled";
  const isCompleted = cls.status === "completed";
  const infoLine = [cls.instructorName ?? "—", cls.room].filter(Boolean).join(" · ");
  return (
    <div className="relative group">
      {canManage && !isCancelled && !isCompleted && (
        <div className="absolute top-0.5 right-0.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFull && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddGuest();
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
              title="Añadir invitado"
              aria-label="Añadir invitado"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
            title="Cancelar clase"
            aria-label="Cancelar clase"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <Link
        href={`/reservas?date=${cls.date}`}
        className={`block rounded-md border px-2 py-1.5 transition-all hover:shadow-sm ${styles.bg} ${styles.border} ${
          isCancelled ? "opacity-50 line-through" : ""
        }`}
        title={`${cls.name} · ${cls.instructorName ?? "Sin instructor"}${cls.room ? ` · ${cls.room}` : ""}`}
    >
      <p className={`truncate text-xs font-medium leading-tight ${styles.text}`}>
        {cls.name}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-1">
        {showInfo ? (
          <span className="truncate text-[10px] text-slate-500">{infoLine}</span>
        ) : (
          <span className="text-[10px] text-slate-300">·</span>
        )}
        <span
          className={`shrink-0 text-[10px] font-semibold ${
            isFull ? "text-red-600" : "text-slate-500"
          }`}
        >
          {cls.bookedCount}/{cls.maxSpots}
        </span>
      </div>
      </Link>
    </div>
  );
}
