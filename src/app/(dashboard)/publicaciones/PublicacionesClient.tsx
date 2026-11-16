"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Megaphone,
  Pencil,
  Send,
  CircleOff,
  Trash2,
  X,
  Heart,
  MessageCircle,
  FileText,
} from "lucide-react";
import {
  createPostAction,
  updatePostAction,
  togglePostPublishedAction,
  deletePostAction,
} from "./actions";
import type { PostRow, PostAudienceType } from "./types";
import { STATUS_STYLES, AUDIENCE_LABELS, AUDIENCE_OPTIONS } from "./types";

export interface TariffOption {
  id: string;
  name: string;
}

type Props = {
  initialPosts: PostRow[];
  gymName: string;
  tariffOptions: TariffOption[];
};

type FilterKey = "todos" | "publicados" | "borradores";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "publicados", label: "Publicados" },
  { key: "borradores", label: "Borradores" },
];

export default function PublicacionesClient({ initialPosts, gymName, tariffOptions }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  useEffect(() => setPosts(initialPosts), [initialPosts]);

  const [filter, setFilter] = useState<FilterKey>("todos");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [modalMode, setModalMode] = useState<"none" | "new" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");
  // 0075
  const [formMediaUrls, setFormMediaUrls] = useState<string[]>([]);
  const [formAudienceType, setFormAudienceType] = useState<PostAudienceType>("all");
  const [formAudienceTariffIds, setFormAudienceTariffIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PostRow | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const counts = useMemo(
    () => ({
      todos: posts.length,
      publicados: posts.filter((p) => p.isPublished).length,
      borradores: posts.filter((p) => !p.isPublished).length,
    }),
    [posts]
  );

  const filtered = useMemo(() => {
    if (filter === "publicados") return posts.filter((p) => p.isPublished);
    if (filter === "borradores") return posts.filter((p) => !p.isPublished);
    return posts;
  }, [posts, filter]);

  const openNew = () => {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormTags("");
    setFormMediaUrls([]);
    setFormAudienceType("all");
    setFormAudienceTariffIds(new Set());
    setFormError(null);
    setModalMode("new");
  };

  const openEdit = (p: PostRow) => {
    setEditingId(p.id);
    setFormTitle(p.title ?? "");
    setFormContent(p.content);
    setFormTags(p.tags.join(", "));
    setFormMediaUrls(p.mediaUrls);
    setFormAudienceType(p.audience.type);
    setFormAudienceTariffIds(new Set(p.audience.tariff_ids ?? []));
    setFormError(null);
    setModalMode("edit");
  };

  const addMediaUrl = () => setFormMediaUrls((prev) => [...prev, ""]);
  const removeMediaUrl = (idx: number) =>
    setFormMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  const updateMediaUrl = (idx: number, val: string) =>
    setFormMediaUrls((prev) => prev.map((u, i) => (i === idx ? val : u)));

  const toggleAudienceTariff = (id: string) => {
    setFormAudienceTariffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeModal = () => {
    setModalMode("none");
    setFormError(null);
  };

  const submit = (publish: boolean) => {
    if (!formContent.trim()) {
      setFormError("El contenido es obligatorio");
      return;
    }

    const fd = new FormData();
    fd.set("title", formTitle);
    fd.set("content", formContent);
    fd.set("tags", formTags);
    // Media URLs filtradas (solo http/https no vacías)
    fd.set(
      "mediaUrls",
      formMediaUrls.filter((u) => /^https?:\/\//i.test(u)).join(",")
    );
    fd.set("audienceType", formAudienceType);
    fd.set(
      "audienceTariffIds",
      formAudienceType === "by_tariff" ? Array.from(formAudienceTariffIds).join(",") : ""
    );
    if (modalMode === "new") fd.set("publish", publish ? "true" : "false");

    startTransition(async () => {
      const action = modalMode === "edit" ? updatePostAction : createPostAction;
      if (modalMode === "edit" && editingId) fd.set("id", editingId);
      const res = await action({}, fd);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      showToast(res.success ?? "Guardado");
      closeModal();
      router.refresh();
    });
  };

  const togglePublish = (p: PostRow) => {
    startTransition(async () => {
      const res = await togglePostPublishedAction(p.id, !p.isPublished);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      showToast(res.success ?? "Actualizado");
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const res = await deletePostAction(id);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      showToast(res.success ?? "Eliminado");
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const avatarInitials = gymName.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Publicaciones</h1>
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600">
              {counts.todos}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Comparte novedades, fotos y anuncios con tu comunidad.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva publicación
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              filter === f.key
                ? "bg-[#3b8bea] text-white ring-[#3b8bea]"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">
              <Megaphone className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              {filter === "borradores"
                ? "No hay borradores"
                : filter === "publicados"
                ? "No hay publicaciones publicadas"
                : "No hay publicaciones todavía"}
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-slate-400">
              Publica novedades, fotos de entrenos o anuncios para tu comunidad.
            </p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
            >
              <Plus className="h-4 w-4" />
              Crear publicación
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b8bea] text-xs font-bold text-white">
                    {avatarInitials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{gymName}</p>
                    <p className="text-[11px] text-slate-400">{p.timestampLabel}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                    STATUS_STYLES[p.statusLabel]
                  }`}
                >
                  {p.statusLabel}
                </span>
              </header>

              {p.title && (
                <h3 className="mt-4 text-base font-semibold text-slate-900">{p.title}</h3>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {p.content}
              </p>

              {/* Thumbnails media (0075) */}
              {p.mediaUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {p.mediaUrls.slice(0, 3).map((url, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      className="h-24 w-full rounded-md object-cover ring-1 ring-slate-200"
                    />
                  ))}
                  {p.mediaUrls.length > 3 && (
                    <p className="col-span-3 text-[11px] text-slate-400">
                      +{p.mediaUrls.length - 3} imagen(es) más
                    </p>
                  )}
                </div>
              )}

              {/* Audience badge (0075) */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-semibold uppercase tracking-wide">Audiencia:</span>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200">
                  {p.audienceLabel}
                </span>
              </div>

              {p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <footer className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    {p.likesCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {p.commentsCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    disabled={isPending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublish(p)}
                    disabled={isPending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    title={p.isPublished ? "Despublicar" : "Publicar"}
                  >
                    {p.isPublished ? (
                      <CircleOff className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    disabled={isPending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      {modalMode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {modalMode === "edit" ? "Editar publicación" : "Nueva publicación"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Título (opcional)
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Nuevo horario de verano"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Contenido
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={5}
                  placeholder="Escribe algo para tu comunidad..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tags (separados por coma)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Ej: novedades, eventos, horario"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
                />
              </div>

              {/* Media URLs (0075 — schema ya tiene media_urls ARRAY) */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Imágenes / Media (URLs)
                  </label>
                  <button
                    type="button"
                    onClick={addMediaUrl}
                    className="text-[11px] text-[#3b8bea] hover:underline"
                  >
                    + Añadir URL
                  </button>
                </div>
                {formMediaUrls.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Sin imágenes. Upload bucket pendiente — pega URLs por ahora.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formMediaUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateMediaUrl(idx, e.target.value)}
                          placeholder="https://..."
                          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
                        />
                        <button
                          type="button"
                          onClick={() => removeMediaUrl(idx)}
                          className="text-slate-400 hover:text-red-500"
                          title="Eliminar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audience (0075) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Audiencia
                </label>
                <select
                  value={formAudienceType}
                  onChange={(e) => setFormAudienceType(e.target.value as PostAudienceType)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {AUDIENCE_LABELS[a]}
                    </option>
                  ))}
                </select>
                {formAudienceType === "by_tariff" && (
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                    {tariffOptions.length === 0 ? (
                      <p className="text-[11px] text-slate-400 px-1">
                        No hay tarifas activas.
                      </p>
                    ) : (
                      tariffOptions.map((t) => (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={formAudienceTariffIds.has(t.id)}
                            onChange={() => toggleAudienceTariff(t.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span>{t.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Filtra qué socios verán esta publicación en la app móvil.
                </p>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {formError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              {modalMode === "new" && (
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Guardar como borrador
                </button>
              )}
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2a6fc7] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {modalMode === "edit" ? "Guardar cambios" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Eliminar publicación</h2>
              <p className="mt-2 text-sm text-slate-600">
                ¿Seguro que quieres eliminar esta publicación? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
