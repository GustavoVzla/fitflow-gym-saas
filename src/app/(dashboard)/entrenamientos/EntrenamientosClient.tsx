"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Plus, Pencil, X, Clock, Send, CircleOff } from "lucide-react";
import {
  createWorkoutAction,
  updateWorkoutAction,
  toggleWorkoutPublishedAction,
} from "./actions";
import type { WorkoutRow, UiDifficulty, WorkoutBlockType } from "./types";
import {
  TYPE_OPTIONS,
  getTypeInfo,
  DIFFICULTY_STYLES,
  formatPublishedDate,
  BLOCK_LABELS,
  BLOCK_ORDER,
} from "./types";

type Props = { initialWorkouts: WorkoutRow[] };

export default function EntrenamientosClient({ initialWorkouts }: Props) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState(initialWorkouts);
  useEffect(() => setWorkouts(initialWorkouts), [initialWorkouts]);

  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [modalMode, setModalMode] = useState<"none" | "new" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("amrap");
  const [formDescription, setFormDescription] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<UiDifficulty>("");
  const [formDuration, setFormDuration] = useState("");
  const [formTags, setFormTags] = useState("");
  // JSONB estructurado
  const [formBlocks, setFormBlocks] = useState<Record<WorkoutBlockType, { description: string; dur: string }>>({
    warmup: { description: "", dur: "" },
    main: { description: "", dur: "" },
    cooldown: { description: "", dur: "" },
  });
  const [formRx, setFormRx] = useState("");
  const [formScaled, setFormScaled] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const emptyBlocks = () => ({
    warmup: { description: "", dur: "" },
    main: { description: "", dur: "" },
    cooldown: { description: "", dur: "" },
  });

  const openNew = () => {
    setEditingId(null);
    setFormName("");
    setFormType("amrap");
    setFormDescription("");
    setFormDifficulty("");
    setFormDuration("");
    setFormTags("");
    setFormBlocks(emptyBlocks());
    setFormRx("");
    setFormScaled("");
    setFormError(null);
    setModalMode("new");
  };

  const openEdit = (w: WorkoutRow) => {
    setEditingId(w.id);
    setFormName(w.name);
    setFormType(w.type);
    setFormDescription(w.description ?? "");
    setFormDifficulty(w.difficultyLabel);
    setFormDuration(w.durationMinutes?.toString() ?? "");
    setFormTags(w.tags.join(", "));
    // Rehidratar blocks
    const blocksState = emptyBlocks();
    for (const b of w.blocks) {
      blocksState[b.type] = {
        description: b.description,
        dur: b.durationMinutes != null ? String(b.durationMinutes) : "",
      };
    }
    setFormBlocks(blocksState);
    setFormRx(w.rx ?? "");
    setFormScaled(w.scaled ?? "");
    setFormError(null);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("none");
    setEditingId(null);
    setFormError(null);
  };

  const buildFormData = (publish?: boolean): FormData => {
    const fd = new FormData();
    fd.set("name", formName.trim());
    fd.set("type", formType);
    fd.set("description", formDescription.trim());
    if (formDifficulty) fd.set("difficulty", formDifficulty);
    if (formDuration) fd.set("durationMinutes", formDuration);
    if (formTags.trim()) fd.set("tags", formTags.trim());
    // Blocks estructurados
    for (const type of BLOCK_ORDER) {
      const b = formBlocks[type];
      fd.set(`blocks_${type}_desc`, b.description.trim());
      fd.set(`blocks_${type}_dur`, b.dur.trim());
    }
    fd.set("rx", formRx.trim());
    fd.set("scaled", formScaled.trim());
    if (publish !== undefined) fd.set("publish", publish ? "true" : "false");
    return fd;
  };

  const updateBlock = (type: WorkoutBlockType, field: "description" | "dur", value: string) => {
    setFormBlocks((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const save = (publish: boolean) => {
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    const fd = buildFormData(publish);
    startTransition(async () => {
      const result =
        modalMode === "new"
          ? await createWorkoutAction({}, fd)
          : editingId
            ? (fd.set("id", editingId), await updateWorkoutAction({}, fd))
            : { error: "Estado inconsistente" };
      if (result.error) setFormError(result.error);
      else {
        router.refresh();
        closeModal();
        showToast(result.success ?? "Guardado");
      }
    });
  };

  const togglePublished = (w: WorkoutRow) => {
    startTransition(async () => {
      const result = await toggleWorkoutPublishedAction(w.id, !w.isPublished);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Entrenamientos</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
              {workouts.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Plantillas de WOD: AMRAP, EMOM, Tabata, HIIT, fuerza y más.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nuevo entrenamiento
        </button>
      </div>

      {workouts.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Dumbbell className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            No hay entrenamientos creados todavía
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Crea plantillas de WOD que tus entrenadores reutilizarán en las clases diarias.
          </p>
          <button
            onClick={openNew}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Crear primer entrenamiento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workouts.map((w) => {
            const typeInfo = getTypeInfo(w.type);
            return (
              <div
                key={w.id}
                className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${!w.isPublished ? "opacity-80" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#3b8bea]">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                      w.isPublished
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-500 ring-slate-200"
                    }`}
                  >
                    {w.isPublished ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{w.name}</h3>
                {w.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{w.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${typeInfo.color}`}
                  >
                    {typeInfo.label}
                  </span>
                  {w.difficultyLabel && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${DIFFICULTY_STYLES[w.difficultyLabel]}`}
                    >
                      {w.difficultyLabel}
                    </span>
                  )}
                  {w.durationMinutes != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {w.durationMinutes} min
                    </span>
                  )}
                </div>

                {w.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {w.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-[11px] text-slate-400">
                  {formatPublishedDate(w.publishedDate)}
                </p>

                <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
                  <button
                    title="Editar"
                    onClick={() => openEdit(w)}
                    disabled={isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    title={w.isPublished ? "Despublicar" : "Publicar"}
                    onClick={() => togglePublished(w)}
                    disabled={isPending}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      w.isPublished
                        ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                  >
                    {w.isPublished ? (
                      <CircleOff className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
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
                {modalMode === "edit" ? "Editar entrenamiento" : "Nuevo entrenamiento"}
              </h2>
              <button
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: AMRAP 20min funcional"
                  maxLength={200}
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Dificultad (opcional)
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as UiDifficulty)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">Sin especificar</option>
                    <option>Principiante</option>
                    <option>Intermedio</option>
                    <option>Avanzado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Descripción / ejercicios
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  placeholder="Ej: 20 min: 10 Push-ups, 15 Squats, 20 Sit-ups"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Duración (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="Ej: 20"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Tags (coma)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Ej: funcional, core"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sub-bloques estructurados (JSONB exercises) */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
                  Sub-bloques
                </div>
                {BLOCK_ORDER.map((t) => (
                  <div key={t} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[12px] font-medium text-slate-700">
                        {BLOCK_LABELS[t]}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formBlocks[t].dur}
                        onChange={(e) => updateBlock(t, "dur", e.target.value)}
                        placeholder="min"
                        className="h-7 w-16 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-1 focus:ring-blue-100 focus:outline-none"
                      />
                    </div>
                    <textarea
                      value={formBlocks[t].description}
                      onChange={(e) => updateBlock(t, "description", e.target.value)}
                      rows={t === "main" ? 3 : 2}
                      placeholder={
                        t === "warmup"
                          ? "Ej: 5 min cardio + movilidad de hombros"
                          : t === "main"
                            ? "Ej: AMRAP 20 min: 10 Pull-ups, 20 Push-ups, 30 Squats"
                            : "Ej: 5 min estiramientos + respiración"
                      }
                      maxLength={2000}
                      className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-1 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* RX / Scaled */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    RX (prescrito)
                  </label>
                  <textarea
                    value={formRx}
                    onChange={(e) => setFormRx(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Peso y reps objetivo para atletas avanzados"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Scaled (escalado)
                  </label>
                  <textarea
                    value={formScaled}
                    onChange={(e) => setFormScaled(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Adaptación para principiantes o lesionados"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={closeModal}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              {modalMode === "new" && (
                <button
                  onClick={() => save(false)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Guardar como borrador
                </button>
              )}
              <button
                onClick={() => save(modalMode === "new" ? true : true)}
                disabled={isPending}
                className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
              >
                {isPending
                  ? "Guardando..."
                  : modalMode === "edit"
                    ? "Guardar cambios"
                    : "Publicar"}
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
