"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Inbox,
  Star,
  CalendarDays,
  CheckCircle2,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  createTaskAction,
  updateTaskAction,
  toggleTaskCompleteAction,
  archiveTaskAction,
} from "./actions";
import type {
  TaskRow,
  UiSection,
  UiPriority,
  UiRecurrence,
  MemberOption,
  InstructorOption,
  StaffOption,
  PaymentOption,
} from "./types";
import { PRIORITY_STYLES, RECURRENCE_MAP, computeDueDateLabel, toIsoDate } from "./types";

type Props = {
  initialTasks: TaskRow[];
  memberOptions: MemberOption[];
  instructorOptions: InstructorOption[];
  staffOptions: StaffOption[];
  paymentOptions: PaymentOption[];
};

const SIDEBAR_NAV: Array<{
  key: UiSection;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { key: "hoy", label: "Hoy", icon: Star },
  { key: "bandeja", label: "Bandeja de entrada", icon: Inbox },
  { key: "proximo", label: "Próximo", icon: CalendarDays },
  { key: "completado", label: "Completado", icon: CheckCircle2 },
];

const SECTION_TITLES: Record<UiSection, string> = {
  hoy: "Hoy",
  bandeja: "Todas las pendientes",
  proximo: "Próximo",
  completado: "Completadas",
};

export default function TareasClient({
  initialTasks,
  memberOptions,
  instructorOptions,
  staffOptions,
  paymentOptions,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const [activeSection, setActiveSection] = useState<UiSection>("hoy");
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal crear / editar
  const [modalMode, setModalMode] = useState<"none" | "new" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<UiPriority>("Media");
  const [formDueDate, setFormDueDate] = useState("");
  const [formMemberId, setFormMemberId] = useState<string>("");
  const [formInstructorId, setFormInstructorId] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formAssignedTo, setFormAssignedTo] = useState<string>("");
  const [formPaymentId, setFormPaymentId] = useState<string>("");
  const [formRecurrence, setFormRecurrence] = useState<UiRecurrence>("Ninguna");
  const [formRecurrenceInterval, setFormRecurrenceInterval] = useState<string>("1");
  const [formRecurrenceEndDate, setFormRecurrenceEndDate] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Modal archivar
  const [archiveTarget, setArchiveTarget] = useState<TaskRow | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // ── Secciones filtradas ─────────────────────────────────────────────
  const counts = useMemo(() => {
    const today = toIsoDate(new Date());
    return {
      hoy: tasks.filter(
        (t) => t.status !== "done" && t.dueDate === today
      ).length,
      bandeja: tasks.filter((t) => t.status !== "done").length,
      proximo: tasks.filter(
        (t) => t.status !== "done" && t.dueDate && t.dueDate > today
      ).length,
      completado: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const today = toIsoDate(new Date());
    let list = tasks;
    switch (activeSection) {
      case "hoy":
        list = tasks.filter((t) => t.status !== "done" && t.dueDate === today);
        break;
      case "bandeja":
        list = tasks.filter((t) => t.status !== "done");
        break;
      case "proximo":
        list = tasks.filter(
          (t) => t.status !== "done" && t.dueDate && t.dueDate > today
        );
        break;
      case "completado":
        list = tasks.filter((t) => t.status === "done");
        break;
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          (t.description?.toLowerCase().includes(term) ?? false)
      );
    }
    if (filterAssignee !== "all") {
      list = list.filter((t) =>
        filterAssignee === "unassigned" ? !t.assignedTo : t.assignedTo === filterAssignee,
      );
    }
    if (filterMember !== "all") {
      list = list.filter((t) => t.memberId === filterMember);
    }
    return list;
  }, [tasks, activeSection, search, filterAssignee, filterMember]);

  // ── Handlers ────────────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setFormPriority("Media");
    setFormDueDate(activeSection === "hoy" ? toIsoDate(new Date()) : "");
    setFormMemberId("");
    setFormInstructorId("");
    setFormPhone("");
    setFormAssignedTo("");
    setFormPaymentId("");
    setFormRecurrence("Ninguna");
    setFormRecurrenceInterval("1");
    setFormRecurrenceEndDate("");
    setFormError(null);
    setModalMode("new");
  };

  const openEdit = (t: TaskRow) => {
    setEditingId(t.id);
    setFormTitle(t.title);
    setFormDescription(t.description ?? "");
    setFormPriority(t.uiPriority);
    setFormDueDate(t.dueDate ?? "");
    setFormMemberId(t.memberId ?? "");
    setFormInstructorId(t.instructorId ?? "");
    setFormPhone(t.phone ?? "");
    setFormAssignedTo(t.assignedTo ?? "");
    setFormPaymentId(t.relatedPaymentId ?? "");
    setFormRecurrence(RECURRENCE_MAP[t.recurrenceType]);
    setFormRecurrenceInterval(
      t.recurrenceInterval !== null ? String(t.recurrenceInterval) : "1",
    );
    setFormRecurrenceEndDate(t.recurrenceEndDate ?? "");
    setFormError(null);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("none");
    setEditingId(null);
    setFormError(null);
  };

  const saveTask = () => {
    if (!formTitle.trim()) {
      setFormError("El título es obligatorio");
      return;
    }
    const fd = new FormData();
    fd.set("title", formTitle.trim());
    fd.set("description", formDescription.trim());
    fd.set("priority", formPriority);
    if (formDueDate) fd.set("dueDate", formDueDate);
    if (formMemberId) fd.set("memberId", formMemberId);
    if (formInstructorId) fd.set("instructorId", formInstructorId);
    if (formPhone.trim()) fd.set("phone", formPhone.trim());
    if (formAssignedTo) fd.set("assignedTo", formAssignedTo);
    if (formPaymentId) fd.set("relatedPaymentId", formPaymentId);
    fd.set("recurrenceType", formRecurrence);
    if (formRecurrence !== "Ninguna") {
      fd.set("recurrenceInterval", formRecurrenceInterval || "1");
      if (formRecurrenceEndDate) fd.set("recurrenceEndDate", formRecurrenceEndDate);
    }

    startTransition(async () => {
      const result =
        modalMode === "new"
          ? await createTaskAction({}, fd)
          : editingId
            ? (fd.set("id", editingId), await updateTaskAction({}, fd))
            : { error: "Estado inconsistente" };
      if (result.error) {
        setFormError(result.error);
      } else {
        router.refresh();
        closeModal();
        showToast(result.success ?? "Guardado");
      }
    });
  };

  const toggleComplete = (t: TaskRow) => {
    startTransition(async () => {
      const result = await toggleTaskCompleteAction(t.id, t.status !== "done");
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Actualizado");
      }
    });
  };

  const openArchive = (t: TaskRow) => setArchiveTarget(t);
  const closeArchive = () => setArchiveTarget(null);

  const confirmArchive = () => {
    if (!archiveTarget) return;
    startTransition(async () => {
      const result = await archiveTaskAction(archiveTarget.id);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        closeArchive();
        showToast(result.success ?? "Tarea archivada");
      }
    });
  };

  const SectionIcon = SIDEBAR_NAV.find((s) => s.key === activeSection)?.icon ?? Star;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="hidden w-[240px] shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <button
              onClick={openNew}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
            >
              <Plus className="h-4 w-4" />
              Nueva tarea
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>

            <nav className="space-y-0.5">
              {SIDEBAR_NAV.map((item) => {
                const isActive = item.key === activeSection;
                const Icon = item.icon;
                const count = counts[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-[#3b8bea]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${isActive ? "text-[#3b8bea]" : "text-slate-400"}`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isActive ? "bg-white text-[#3b8bea]" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="space-y-2 pt-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Asignado
                </label>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-sm"
                >
                  <option value="all">Todos</option>
                  <option value="unassigned">Sin asignar</option>
                  {staffOptions.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Socio
                </label>
                <select
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-sm"
                >
                  <option value="all">Todos</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SectionIcon
                className={`h-5 w-5 ${activeSection === "hoy" ? "text-amber-400" : "text-slate-400"}`}
              />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {SECTION_TITLES[activeSection]}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {filtered.length}
              </span>
            </div>

            {/* Mobile search */}
            <div className="relative lg:hidden">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-9 w-40 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Task list */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <SectionIcon className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  {tasks.length === 0
                    ? "No hay tareas todavía"
                    : search.trim()
                      ? "Ninguna tarea coincide con la búsqueda"
                      : "No hay tareas en esta vista"}
                </p>
                {tasks.length === 0 && (
                  <button
                    onClick={openNew}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
                  >
                    <Plus className="h-4 w-4" />
                    Crear primera tarea
                  </button>
                )}
              </div>
            ) : (
              filtered.map((task, idx) => {
                const prio = PRIORITY_STYLES[task.uiPriority];
                const isDone = task.status === "done";
                const dueInfo = computeDueDateLabel(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/50 ${
                      idx < filtered.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleComplete(task)}
                      disabled={isPending}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                        isDone
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-300 hover:border-[#3b8bea]"
                      }`}
                    >
                      {isDone && <Check className="h-3 w-3 text-white" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isDone ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p
                          className={`mt-0.5 text-xs ${
                            isDone ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {task.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
                          <span className="text-xs text-slate-400">{prio.label}</span>
                        </span>
                        {task.dueDate && (
                          <span
                            className={`text-xs ${
                              dueInfo.isOverdue
                                ? "font-semibold text-red-600"
                                : dueInfo.isToday
                                  ? "font-medium text-amber-600"
                                  : "text-slate-400"
                            }`}
                          >
                            {task.dueDateLabel}
                          </span>
                        )}
                        {task.memberName && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">
                            {task.memberName}
                          </span>
                        )}
                        {task.instructorName && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                            {task.instructorName}
                          </span>
                        )}
                        {task.phone && (
                          <span className="text-[10px] text-slate-400">📞 {task.phone}</span>
                        )}
                        {task.assignedToName && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                            👤 {task.assignedToName}
                          </span>
                        )}
                        {task.relatedPaymentLabel && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200"
                            title={task.relatedPaymentLabel}
                          >
                            💳 pago
                          </span>
                        )}
                        {task.recurrenceType !== "none" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
                            🔁 {RECURRENCE_MAP[task.recurrenceType]}
                            {task.recurrenceInterval && task.recurrenceInterval > 1
                              ? ` ×${task.recurrenceInterval}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Editar"
                        onClick={() => openEdit(task)}
                        disabled={isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Archivar"
                        onClick={() => openArchive(task)}
                        disabled={isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modalMode !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === "edit" ? "Editar tarea" : "Nueva tarea"}
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
                  Título
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Revisar pagos pendientes"
                  maxLength={200}
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Prioridad
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as UiPriority)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option>Urgente</option>
                    <option>Alta</option>
                    <option>Media</option>
                    <option>Baja</option>
                  </select>
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
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Cliente (opcional)
                  </label>
                  <select
                    value={formMemberId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setFormMemberId(newId);
                      // Autocompletar teléfono desde la ficha del socio
                      if (newId && !formPhone.trim()) {
                        const m = memberOptions.find((o) => o.id === newId);
                        if (m?.phone) setFormPhone(m.phone);
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">— Sin cliente —</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Instructor (opcional)
                  </label>
                  <select
                    value={formInstructorId}
                    onChange={(e) => setFormInstructorId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">— Sin instructor —</option>
                    {instructorOptions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Autocompletado desde el cliente seleccionado"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Asignar a staff (opcional)
                  </label>
                  <select
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">— Sin asignar —</option>
                    {staffOptions.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    El asignado recibe una notificación in-app automática.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Pago/factura vinculado (opcional)
                  </label>
                  <select
                    value={formPaymentId}
                    onChange={(e) => setFormPaymentId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">— Sin pago —</option>
                    {paymentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label.length > 60 ? p.label.slice(0, 60) + "…" : p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Recurrencia
                  </label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value as UiRecurrence)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option>Ninguna</option>
                    <option>Diaria</option>
                    <option>Semanal</option>
                    <option>Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Cada (nº)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={formRecurrenceInterval}
                    onChange={(e) => setFormRecurrenceInterval(e.target.value)}
                    disabled={formRecurrence === "Ninguna"}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Hasta fecha (opcional)
                  </label>
                  <input
                    type="date"
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    disabled={formRecurrence === "Ninguna"}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeModal}
                  disabled={isPending}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveTask}
                  disabled={isPending}
                  className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
                >
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal archivar */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeArchive}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Archivar tarea</h2>
              <button
                onClick={closeArchive}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              ¿Archivar la tarea{" "}
              <span className="font-semibold text-slate-900">{archiveTarget.title}</span>?
              No se eliminará, solo se ocultará de las vistas activas.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeArchive}
                disabled={isPending}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={confirmArchive}
                disabled={isPending}
                className="h-9 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Archivando..." : "Archivar"}
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
