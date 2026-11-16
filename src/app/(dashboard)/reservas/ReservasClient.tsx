"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Calendar, X, Trash2, Search } from "lucide-react";
import { bookClassAction, cancelBookingAction } from "./actions";
import type {
  ClassInstanceRow,
  ClassType,
  DayOption,
  MemberOption,
  BookedMember,
} from "./types";
import { CLASS_TYPE_LABEL } from "./types";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { RESERVAS_TOUR } from "@/lib/tours";

type Props = {
  days: DayOption[];
  selectedDate: string;
  instances: ClassInstanceRow[];
  members: MemberOption[];
  instructors: Array<{ id: string; name: string }>;
  seenTourKeys: string[];
};

const typeConfig: Record<
  ClassType,
  { border: string; badge: string; bar: string }
> = {
  dinamico: {
    border: "border-l-[#3b8bea]",
    badge: "bg-blue-50 text-[#3b8bea] ring-blue-200",
    bar: "bg-[#3b8bea]",
  },
  premium: {
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    bar: "bg-amber-400",
  },
  salud: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  personal_1h: {
    border: "border-l-purple-500",
    badge: "bg-purple-50 text-purple-700 ring-purple-200",
    bar: "bg-purple-500",
  },
  personal_30min: {
    border: "border-l-purple-500",
    badge: "bg-purple-50 text-purple-700 ring-purple-200",
    bar: "bg-purple-500",
  },
  grupal: {
    border: "border-l-slate-400",
    badge: "bg-slate-50 text-slate-700 ring-slate-200",
    bar: "bg-slate-400",
  },
};

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.substring(0, 2).toUpperCase() ?? "";
}

function formatDateEs(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReservasClient({
  days,
  selectedDate,
  instances: initialInstances,
  members,
  seenTourKeys,
}: Props) {
  const router = useRouter();
  const [instances, setInstances] = useState(initialInstances);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  useEffect(() => setInstances(initialInstances), [initialInstances]);

  const [classFilter, setClassFilter] = useState("Todas");
  const [instructorFilter, setInstructorFilter] = useState("Todos");

  const [bookingInstanceId, setBookingInstanceId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const [cancelTarget, setCancelTarget] = useState<{
    bookingId: string;
    memberName: string;
  } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDayChange = (date: string) => {
    router.push(`/reservas?date=${date}`);
  };

  const classNameOptions = useMemo(() => {
    const s = new Set(instances.map((i) => i.className));
    return Array.from(s).sort();
  }, [instances]);

  const instructorNameOptions = useMemo(() => {
    const s = new Set(
      instances.map((i) => i.instructorName).filter((n): n is string => !!n)
    );
    return Array.from(s).sort();
  }, [instances]);

  const filtered = useMemo(() => {
    return instances.filter((i) => {
      const matchClass = classFilter === "Todas" || i.className === classFilter;
      const matchInstructor =
        instructorFilter === "Todos" || i.instructorName === instructorFilter;
      return matchClass && matchInstructor;
    });
  }, [instances, classFilter, instructorFilter]);

  const openBooking = (id: string) => {
    setBookingInstanceId(id);
    setMemberSearch("");
  };
  const closeBooking = () => {
    setBookingInstanceId(null);
    setMemberSearch("");
  };

  const confirmBooking = (memberId: string, memberName: string) => {
    if (!bookingInstanceId) return;
    startTransition(async () => {
      const result = await bookClassAction(bookingInstanceId, memberId);
      if (result.error) {
        showToast(`Error: ${result.error}`, "error");
        return;
      }
      router.refresh();
      closeBooking();
      const prefix = result.status === "waitlist" ? "Lista espera: " : "";
      showToast(`${prefix}${memberName} reservado`);
    });
  };

  const openCancel = (bookingId: string, memberName: string) => {
    setCancelTarget({ bookingId, memberName });
  };
  const closeCancel = () => setCancelTarget(null);

  const confirmCancel = () => {
    if (!cancelTarget) return;
    startTransition(async () => {
      const result = await cancelBookingAction(cancelTarget.bookingId);
      if (result.error) {
        showToast(`Error: ${result.error}`, "error");
        return;
      }
      router.refresh();
      closeCancel();
      showToast(result.success ?? "Reserva cancelada");
    });
  };

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const instance = instances.find((i) => i.id === bookingInstanceId);
    const alreadyBookedIds = new Set(instance?.bookedMembers.map((b) => b.memberId) ?? []);
    return members.filter(
      (m) =>
        !alreadyBookedIds.has(m.id) &&
        (!term ||
          m.name.toLowerCase().includes(term) ||
          (m.email?.toLowerCase().includes(term) ?? false))
    );
  }, [memberSearch, members, bookingInstanceId, instances]);

  const bookingInstance = instances.find((i) => i.id === bookingInstanceId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <FeatureTour tourKey="reservas-v1" steps={RESERVAS_TOUR} seenTourKeys={seenTourKeys} />
      <div data-tour="reservas-header" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reservas</h1>
          <div className="flex items-center gap-1 text-sm capitalize text-slate-500">
            <Calendar className="h-4 w-4" />
            <span>{formatDateEs(selectedDate)}</span>
          </div>
          <HowItWorksButton steps={RESERVAS_TOUR} />
        </div>
        <div data-tour="reservas-filters" className="flex flex-wrap items-center gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Filtro de clase"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="Todas">Clase: Todas</option>
            {classNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
            aria-label="Filtro de instructor"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="Todos">Instructor: Todos</option>
            {instructorNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div data-tour="reservas-days" className="flex flex-wrap items-center gap-1.5">
        {days.map((d) => {
          const isSelected = d.date === selectedDate;
          return (
            <button
              key={d.date}
              onClick={() => handleDayChange(d.date)}
              className={`flex flex-col items-center rounded-xl px-4 py-2 text-[13px] font-medium transition-colors ${
                isSelected
                  ? "bg-[#3b8bea] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`text-[11px] uppercase ${
                  isSelected ? "text-white/80" : "text-slate-400"
                }`}
              >
                {d.isToday ? "Hoy" : d.dayLabel}
              </span>
              <span className="text-lg font-bold">{d.dayNumber}</span>
            </button>
          );
        })}
      </div>

      {instances.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No hay clases programadas para este día. Crea plantillas en <strong>Clases y Tarifas</strong> y pulsa <strong>Generar 14 días</strong>.
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              No hay clases programadas para este día
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Selecciona otro día de la semana
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Calendar className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            No hay clases que coincidan con los filtros
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inst) => (
            <ClassCard
              key={inst.id}
              inst={inst}
              onBook={openBooking}
              onCancelBooking={openCancel}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {bookingInstanceId && bookingInstance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeBooking}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Apuntar socio</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {bookingInstance.className} — {bookingInstance.startTime} ·{" "}
                  {bookingInstance.bookedCount}/{bookingInstance.maxSpots} plazas
                  {bookingInstance.bookedCount >= bookingInstance.maxSpots &&
                    bookingInstance.waitlistSize > 0 &&
                    ` (irá a lista de espera)`}
                </p>
              </div>
              <button
                onClick={closeBooking}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Buscar socio por nombre o email..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No hay socios activos. Crea socios en{" "}
                  <a href="/socios" className="underline">
                    Socios
                  </a>
                  .
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="py-3 text-center text-sm text-slate-400">
                  Ningún socio coincide o todos están ya reservados
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    disabled={isPending}
                    onClick={() => confirmBooking(m.id, m.name)}
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-blue-50 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[10px] font-semibold text-purple-700">
                        {getInitials(m.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{m.name}</p>
                        {m.email && (
                          <p className="text-[11px] text-slate-400">{m.email}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
              <h2 className="text-lg font-bold text-slate-900">Cancelar reserva</h2>
              <button
                onClick={closeCancel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              ¿Cancelar la reserva de{" "}
              <span className="font-semibold text-slate-900">
                {cancelTarget.memberName}
              </span>
              ? Si había lista de espera, el primero será promovido automáticamente.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
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

function ClassCard({
  inst,
  onBook,
  onCancelBooking,
  isPending,
}: {
  inst: ClassInstanceRow;
  onBook: (id: string) => void;
  onCancelBooking: (bookingId: string, memberName: string) => void;
  isPending: boolean;
}) {
  const cfg = typeConfig[inst.type] ?? typeConfig.grupal;
  const occupancyPct = inst.maxSpots > 0 ? (inst.bookedCount / inst.maxSpots) * 100 : 0;
  const isFull = inst.bookedCount >= inst.maxSpots;
  const waitlistAvailable =
    isFull && inst.waitlistSize > 0 && inst.waitlistCount < inst.waitlistSize;
  const canReserve =
    (!isFull || waitlistAvailable) && inst.status === "scheduled";

  const confirmed = inst.bookedMembers.filter((b) => b.status === "confirmed");
  const waitlist = inst.bookedMembers.filter((b) => b.status === "waitlist");

  return (
    <div
      className={`rounded-xl border border-slate-200/80 border-l-4 ${cfg.border} bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        inst.status === "cancelled" ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="min-w-[72px] text-center">
            <p className="text-sm font-bold text-slate-800">{inst.startTime}</p>
            <p className="text-xs text-slate-400">{inst.endTime}</p>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">{inst.className}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cfg.badge}`}
              >
                {CLASS_TYPE_LABEL[inst.type]}
              </span>
              {inst.room && (
                <span className="text-[11px] text-slate-400">· {inst.room}</span>
              )}
              {inst.status === "cancelled" && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
                  Cancelada
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {inst.instructorName ?? "Sin instructor asignado"}
            </p>

            {confirmed.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {confirmed.map((b) => (
                  <MemberChip
                    key={b.bookingId}
                    booked={b}
                    onCancel={() => onCancelBooking(b.bookingId, b.name)}
                    disabled={isPending}
                  />
                ))}
              </div>
            )}

            {waitlist.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Lista de espera ({waitlist.length})
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {waitlist.map((b) => (
                    <MemberChip
                      key={b.bookingId}
                      booked={b}
                      onCancel={() => onCancelBooking(b.bookingId, b.name)}
                      disabled={isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 sm:min-w-[200px] sm:justify-end">
          <div className="min-w-[100px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                {inst.bookedCount}/{inst.maxSpots}
              </span>
              <span className="text-slate-400">plazas</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  isFull ? "bg-red-400" : cfg.bar
                }`}
                style={{
                  width: `${Math.min(occupancyPct, 100)}%`,
                  minWidth: occupancyPct > 0 ? 4 : 0,
                }}
              />
            </div>
            {inst.waitlistSize > 0 && inst.waitlistCount > 0 && (
              <p className="mt-1 text-[10px] text-amber-600">
                +{inst.waitlistCount} en espera
              </p>
            )}
          </div>
          <button
            disabled={!canReserve || isPending}
            onClick={() => canReserve && onBook(inst.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
              !canReserve || isPending
                ? "cursor-not-allowed border-slate-200 text-slate-300"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isFull && !waitlistAvailable
              ? "Completo"
              : isFull
                ? "+ espera"
                : "Apuntar socio"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberChip({
  booked,
  onCancel,
  disabled,
}: {
  booked: BookedMember;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 rounded-full px-1 pr-2 ${
        booked.status === "waitlist" ? "bg-amber-50" : "bg-slate-50"
      }`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold ${
          booked.status === "waitlist"
            ? "bg-amber-200 text-amber-800"
            : "bg-purple-100 text-purple-700"
        }`}
      >
        {getInitials(booked.name)}
      </div>
      <span className="text-xs text-slate-600">{booked.name}</span>
      {booked.status === "waitlist" && booked.positionInWaitlist && (
        <span className="text-[10px] text-amber-700">#{booked.positionInWaitlist}</span>
      )}
      <button
        onClick={onCancel}
        disabled={disabled}
        title="Cancelar reserva"
        className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
      >
        <Trash2 className="h-3 w-3 text-red-500 hover:text-red-700" />
      </button>
    </div>
  );
}
