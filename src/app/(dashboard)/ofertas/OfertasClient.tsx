"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Pencil, Power, X, Copy, Check } from "lucide-react";
import {
  createOfferAction,
  updateOfferAction,
  toggleOfferActiveAction,
} from "./actions";
import type { OfferRow, UiDiscountType, OfferTargetAudience } from "./types";
import { STATUS_STYLES, DISCOUNT_TYPE_UI_MAP, AUDIENCE_LABELS, AUDIENCE_OPTIONS } from "./types";

export interface TariffOption {
  id: string;
  name: string;
}

type Props = { initialOffers: OfferRow[]; tariffOptions: TariffOption[] };

export default function OfertasClient({ initialOffers, tariffOptions }: Props) {
  const router = useRouter();
  const [offers, setOffers] = useState(initialOffers);
  useEffect(() => setOffers(initialOffers), [initialOffers]);

  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal
  const [modalMode, setModalMode] = useState<"none" | "new" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<UiDiscountType | "">("");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formMaxRedemptions, setFormMaxRedemptions] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formTargetAudience, setFormTargetAudience] = useState<OfferTargetAudience>("all");
  const [formTariffIds, setFormTariffIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const openNew = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setFormDiscountType("");
    setFormDiscountValue("");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormMaxRedemptions("");
    setFormCode("");
    setFormTargetAudience("all");
    setFormTariffIds(new Set());
    setFormError(null);
    setModalMode("new");
  };

  const openEdit = (o: OfferRow) => {
    setEditingId(o.id);
    setFormTitle(o.title);
    setFormDescription(o.description ?? "");
    setFormDiscountType(o.discountType ? DISCOUNT_TYPE_UI_MAP[o.discountType] : "");
    setFormDiscountValue(o.discountValue?.toString() ?? "");
    setFormValidFrom(o.validFrom ?? "");
    setFormValidUntil(o.validUntil ?? "");
    setFormMaxRedemptions(o.maxRedemptions?.toString() ?? "");
    setFormCode(o.code ?? "");
    setFormTargetAudience(o.targetAudience);
    setFormTariffIds(new Set(o.applicableTariffIds));
    setFormError(null);
    setModalMode("edit");
  };

  const toggleTariff = (id: string) => {
    setFormTariffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeModal = () => {
    setModalMode("none");
    setEditingId(null);
    setFormError(null);
  };

  const save = () => {
    if (!formTitle.trim()) {
      setFormError("El título es obligatorio");
      return;
    }
    const fd = new FormData();
    fd.set("title", formTitle.trim());
    fd.set("description", formDescription.trim());
    if (formDiscountType) fd.set("discountType", formDiscountType);
    if (formDiscountValue) fd.set("discountValue", formDiscountValue);
    if (formValidFrom) fd.set("validFrom", formValidFrom);
    if (formValidUntil) fd.set("validUntil", formValidUntil);
    if (formMaxRedemptions) fd.set("maxRedemptions", formMaxRedemptions);
    if (formCode) fd.set("code", formCode.trim());
    fd.set("targetAudience", formTargetAudience);
    fd.set("applicableTariffIds", Array.from(formTariffIds).join(","));

    startTransition(async () => {
      const result =
        modalMode === "new"
          ? await createOfferAction({}, fd)
          : editingId
            ? (fd.set("id", editingId), await updateOfferAction({}, fd))
            : { error: "Estado inconsistente" };
      if (result.error) setFormError(result.error);
      else {
        router.refresh();
        closeModal();
        showToast(result.success ?? "Guardado");
      }
    });
  };

  const toggleActive = (o: OfferRow) => {
    startTransition(async () => {
      const result = await toggleOfferActiveAction(o.id, !o.isActive);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      showToast("No se pudo copiar al portapapeles", "error");
    }
  };

  const showDiscountValue = formDiscountType && formDiscountType !== "Prueba gratis";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ofertas</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
              {offers.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Promociones, descuentos y pruebas gratuitas para captar socios.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva oferta
        </button>
      </div>

      {/* Grid */}
      {offers.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Tag className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            No hay ofertas creadas todavía
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Las ofertas te ayudan a captar socios con pruebas gratuitas, descuentos promocionales o cupones por campaña.
          </p>
          <button
            onClick={openNew}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Crear primera oferta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <div
              key={o.id}
              className={`group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                o.statusLabel === "Activa"
                  ? "border-slate-200/80"
                  : "border-slate-200/80 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#3b8bea]">
                  <Tag className="h-5 w-5" />
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[o.statusLabel]}`}
                >
                  {o.statusLabel}
                </span>
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900">{o.title}</h3>
              {o.description && (
                <p className="mt-1 text-sm text-slate-500">{o.description}</p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Descuento
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {o.discountLabel}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Validez
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {o.validityLabel}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Usos
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {o.redemptionsLabel}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Audiencia
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {o.audienceLabel}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Tarifas
                  </span>
                  <span className="truncate text-xs font-medium text-slate-600">
                    {o.tariffsLabel}
                  </span>
                </div>
              </div>

              {o.code && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5">
                  <code className="flex-1 font-mono text-sm font-bold tracking-wide text-slate-800">
                    {o.code}
                  </code>
                  <button
                    onClick={() => copyCode(o.code!)}
                    title="Copiar código"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                  >
                    {copiedCode === o.code ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
                <button
                  title="Editar"
                  onClick={() => openEdit(o)}
                  disabled={isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title={o.isActive ? "Desactivar" : "Activar"}
                  onClick={() => toggleActive(o)}
                  disabled={isPending}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                    o.isActive
                      ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                  }`}
                >
                  <Power className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                {modalMode === "edit" ? "Editar oferta" : "Nueva oferta"}
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
                  Título
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Primera clase gratis"
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
                  rows={2}
                  placeholder="Ej: Sesión de prueba sin compromiso"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Tipo descuento
                  </label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as UiDiscountType | "")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">Sin descuento (informativa)</option>
                    <option>Porcentaje</option>
                    <option>Cantidad fija</option>
                    <option>Prueba gratis</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    {formDiscountType === "Porcentaje"
                      ? "Porcentaje (%)"
                      : formDiscountType === "Cantidad fija"
                        ? "Cantidad (€)"
                        : "Valor"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!showDiscountValue}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Válida desde (opcional)
                  </label>
                  <input
                    type="date"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Válida hasta (opcional)
                  </label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Límite de usos (opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxRedemptions}
                    onChange={(e) => setFormMaxRedemptions(e.target.value)}
                    placeholder="Ilimitado"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Código promocional (opcional)
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="WELCOME10"
                    maxLength={30}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[13px] uppercase text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Audiencia objetivo (0071) */}
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Audiencia objetivo
                </label>
                <select
                  value={formTargetAudience}
                  onChange={(e) => setFormTargetAudience(e.target.value as OfferTargetAudience)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {AUDIENCE_LABELS[a]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Filtra qué socios pueden canjear esta oferta.
                </p>
              </div>

              {/* Tarifas aplicables (0071) */}
              {tariffOptions.length > 0 && (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">
                    Tarifas aplicables
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {tariffOptions.length === 0 ? (
                      <p className="text-[11px] text-slate-400 px-1">
                        No hay tarifas activas.
                      </p>
                    ) : (
                      tariffOptions.map((t) => (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={formTariffIds.has(t.id)}
                            onChange={() => toggleTariff(t.id)}
                            className="h-4 w-4"
                          />
                          <span>{t.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Si no marcas ninguna, la oferta aplica a todas las tarifas.
                  </p>
                </div>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={closeModal}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={isPending}
                className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
              >
                {isPending ? "Guardando..." : "Guardar"}
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
