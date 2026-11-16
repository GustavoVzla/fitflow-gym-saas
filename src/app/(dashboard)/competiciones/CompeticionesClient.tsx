"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Plus,
  Pencil,
  Power,
  X,
  CalendarDays,
  Users,
  Info,
  Ticket,
  Phone,
  Globe,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  createCompetitionAction,
  updateCompetitionAction,
  toggleCompetitionActiveAction,
} from "./actions";
import type { CompetitionRow } from "./types";
import { STATUS_STYLES, TYPE_COLORS, slugify, formatPriceEuros } from "./types";

type Props = { initialCompetitions: CompetitionRow[] };

const TYPES = ["Individual", "Equipos", "Reto semanal", "Torneo"];
type Section = "info" | "inscripcion" | "contacto" | "publica";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none";
const labelClass = "mb-1 block text-[13px] font-medium text-slate-700";

export default function CompeticionesClient({ initialCompetitions }: Props) {
  const router = useRouter();
  const [competitions, setCompetitions] = useState(initialCompetitions);
  useEffect(() => setCompetitions(initialCompetitions), [initialCompetitions]);

  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [modalMode, setModalMode] = useState<"none" | "new" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Section>("info");

  // Sección 1 — Info básica
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formType, setFormType] = useState<string>("Individual");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formConditions, setFormConditions] = useState("");

  // Sección 2 — Inscripción online
  const [formOnlineReg, setFormOnlineReg] = useState(false);
  const [formSlug, setFormSlug] = useState("");
  const [formPriceEuros, setFormPriceEuros] = useState("");
  const [formTaxPercent, setFormTaxPercent] = useState("");
  const [formMaxRegistrations, setFormMaxRegistrations] = useState("");
  const [formWaitlist, setFormWaitlist] = useState(false);
  const [formCategories, setFormCategories] = useState(""); // CSV

  // Sección 3 — Contacto + Ubicación
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formLocationAddress, setFormLocationAddress] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormStart("");
    setFormEnd("");
    setFormType("Individual");
    setFormCoverImage("");
    setFormConditions("");
    setFormOnlineReg(false);
    setFormSlug("");
    setFormPriceEuros("");
    setFormTaxPercent("");
    setFormMaxRegistrations("");
    setFormWaitlist(false);
    setFormCategories("");
    setFormContactEmail("");
    setFormContactPhone("");
    setFormLocationAddress("");
    setFormLatitude("");
    setFormLongitude("");
    setFormError(null);
    setOpenSection("info");
  };

  const openNew = () => {
    resetForm();
    setModalMode("new");
  };

  const openEdit = (c: CompetitionRow) => {
    setEditingId(c.id);
    setFormName(c.name);
    setFormDescription(c.description ?? "");
    setFormStart(c.startDate);
    setFormEnd(c.endDate);
    setFormType(c.type ?? "Individual");
    setFormCoverImage(c.coverImageUrl ?? "");
    setFormConditions(c.conditions ?? "");
    setFormOnlineReg(c.onlineRegistrationEnabled);
    setFormSlug(c.slug ?? "");
    setFormPriceEuros(c.priceCents != null ? (c.priceCents / 100).toFixed(2) : "");
    setFormTaxPercent(c.taxPercent != null ? String(c.taxPercent) : "");
    setFormMaxRegistrations(c.maxRegistrations != null ? String(c.maxRegistrations) : "");
    setFormWaitlist(c.waitlistEnabled);
    setFormCategories(c.categories.join(", "));
    setFormContactEmail(c.contactEmail ?? "");
    setFormContactPhone(c.contactPhone ?? "");
    setFormLocationAddress(c.locationAddress ?? "");
    setFormLatitude(c.latitude != null ? String(c.latitude) : "");
    setFormLongitude(c.longitude != null ? String(c.longitude) : "");
    setFormError(null);
    setOpenSection("info");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("none");
    setFormError(null);
  };

  // Auto-slug cuando nombre cambia (solo si slug vacío o coincide con slug anterior del nombre)
  const handleNameChange = (newName: string) => {
    setFormName(newName);
    if (!formSlug || formSlug === slugify(formName)) {
      setFormSlug(slugify(newName));
    }
  };

  const save = () => {
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      setOpenSection("info");
      return;
    }
    if (!formStart || !formEnd) {
      setFormError("Las fechas de inicio y fin son obligatorias");
      setOpenSection("info");
      return;
    }
    if (formEnd < formStart) {
      setFormError("La fecha de fin no puede ser anterior a la de inicio");
      setOpenSection("info");
      return;
    }
    if (formOnlineReg && !formSlug.trim()) {
      setFormError("Si activas inscripción online, el slug público es obligatorio");
      setOpenSection("inscripcion");
      return;
    }

    const fd = new FormData();
    fd.set("name", formName.trim());
    fd.set("description", formDescription.trim());
    fd.set("startDate", formStart);
    fd.set("endDate", formEnd);
    fd.set("type", formType);
    fd.set("slug", formSlug.trim());
    fd.set("coverImageUrl", formCoverImage.trim());
    fd.set("conditions", formConditions.trim());
    fd.set("onlineRegistrationEnabled", formOnlineReg ? "on" : "off");
    fd.set("priceCents", formPriceEuros.trim());
    fd.set("taxPercent", formTaxPercent.trim());
    fd.set("maxRegistrations", formMaxRegistrations.trim());
    fd.set("waitlistEnabled", formWaitlist ? "on" : "off");
    fd.set("categories", formCategories.trim());
    fd.set("contactEmail", formContactEmail.trim());
    fd.set("contactPhone", formContactPhone.trim());
    fd.set("locationAddress", formLocationAddress.trim());
    fd.set("latitude", formLatitude.trim());
    fd.set("longitude", formLongitude.trim());

    startTransition(async () => {
      const result =
        modalMode === "new"
          ? await createCompetitionAction({}, fd)
          : editingId
            ? (fd.set("id", editingId), await updateCompetitionAction({}, fd))
            : { error: "Estado inconsistente" };
      if (result.error) setFormError(result.error);
      else {
        router.refresh();
        closeModal();
        showToast(result.success ?? "Guardado");
      }
    });
  };

  const toggleActive = (c: CompetitionRow) => {
    startTransition(async () => {
      const result = await toggleCompetitionActiveAction(c.id, !c.isActive);
      if (result.error) showToast(`Error: ${result.error}`, "error");
      else {
        router.refresh();
        showToast(result.success ?? "Estado actualizado");
      }
    });
  };

  const copyPublicUrl = (slug: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${slug}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast("URL copiada al portapapeles");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Competiciones</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
              {competitions.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Retos, torneos y competiciones internas para motivar a tu comunidad.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva competición
        </button>
      </div>

      {competitions.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No hay competiciones creadas todavía</p>
          <p className="mt-1 text-xs text-slate-400">
            Crea retos semanales, torneos individuales o competiciones por equipos para aumentar la fidelización.
          </p>
          <button
            onClick={openNew}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Crear primera competición
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitions.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${!c.isActive ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Trophy className="h-5 w-5" />
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[c.statusLabel]}`}
                >
                  {c.statusLabel}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">{c.name}</h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>
              )}
              <div className="mt-4 space-y-2">
                {c.type && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TYPE_COLORS[c.type] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}
                    >
                      {c.type}
                    </span>
                    {c.onlineRegistrationEnabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <Globe className="h-3 w-3" />
                        Online
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{c.rangeLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {c.participantsCount} participante{c.participantsCount === 1 ? "" : "s"}
                    {c.maxRegistrations && ` / ${c.maxRegistrations}`}
                  </span>
                </div>
                {c.priceCents != null && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Ticket className="h-3.5 w-3.5" />
                    <span>{formatPriceEuros(c.priceCents)}</span>
                  </div>
                )}
                {c.slug && c.onlineRegistrationEnabled && (
                  <button
                    onClick={() => copyPublicUrl(c.slug!)}
                    className="mt-1 flex items-center gap-1.5 text-[11px] text-[#3b8bea] hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    /c/{c.slug}
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
                <button
                  title="Editar"
                  onClick={() => openEdit(c)}
                  disabled={isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title={c.isActive ? "Desactivar" : "Activar"}
                  onClick={() => toggleActive(c)}
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
            </div>
          ))}
        </div>
      )}

      {/* Modal 4 secciones */}
      {modalMode !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === "edit" ? "Editar competición" : "Nueva competición"}
              </h2>
              <button
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {/* Sección 1 — Info básica */}
              <AccordionSection
                icon={<Info className="h-4 w-4" />}
                title="1. Información básica"
                subtitle="Nombre, tipo, fechas, imagen portada"
                open={openSection === "info"}
                onToggle={() => setOpenSection(openSection === "info" ? "info" : "info")}
                onClick={() => setOpenSection("info")}
              >
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej: Reto abril - 20 clases"
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Descripción</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    placeholder="Reglas, premios, objetivo..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className={inputClass}
                  >
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Fecha inicio *</label>
                    <input
                      type="date"
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Fecha fin *</label>
                    <input
                      type="date"
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>URL imagen de portada</label>
                  <input
                    type="url"
                    value={formCoverImage}
                    onChange={(e) => setFormCoverImage(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Upload a bucket gym-assets pendiente (pega URL por ahora).
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Condiciones de participación</label>
                  <textarea
                    value={formConditions}
                    onChange={(e) => setFormConditions(e.target.value)}
                    rows={3}
                    placeholder="Edad mínima, equipamiento, reglas específicas..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </AccordionSection>

              {/* Sección 2 — Inscripción online */}
              <AccordionSection
                icon={<Ticket className="h-4 w-4" />}
                title="2. Inscripción online"
                subtitle="Precio, categorías, aforo"
                open={openSection === "inscripcion"}
                onClick={() => setOpenSection("inscripcion")}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOnlineReg}
                    onChange={(e) => setFormOnlineReg(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Activar inscripción online pública
                  </span>
                </label>
                {formOnlineReg && (
                  <>
                    <div>
                      <label className={labelClass}>Slug URL pública *</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">/c/</span>
                        <input
                          type="text"
                          value={formSlug}
                          onChange={(e) => setFormSlug(slugify(e.target.value))}
                          placeholder="reto-abril-2026"
                          maxLength={60}
                          className={inputClass}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Solo minúsculas, números, guiones. Auto-generado desde nombre.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Precio (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formPriceEuros}
                          onChange={(e) => setFormPriceEuros(e.target.value)}
                          placeholder="0 = gratis"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>IVA (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formTaxPercent}
                          onChange={(e) => setFormTaxPercent(e.target.value)}
                          placeholder="21"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Max inscripciones</label>
                        <input
                          type="number"
                          min="1"
                          value={formMaxRegistrations}
                          onChange={(e) => setFormMaxRegistrations(e.target.value)}
                          placeholder="Sin límite"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formWaitlist}
                            onChange={(e) => setFormWaitlist(e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-slate-700">Lista de espera</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Categorías (separadas por coma)</label>
                      <input
                        type="text"
                        value={formCategories}
                        onChange={(e) => setFormCategories(e.target.value)}
                        placeholder="RX, Scaled, Masters"
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Si vacío, no se pide categoría en la inscripción.
                      </p>
                    </div>
                  </>
                )}
              </AccordionSection>

              {/* Sección 3 — Contacto + Ubicación */}
              <AccordionSection
                icon={<Phone className="h-4 w-4" />}
                title="3. Contacto y ubicación"
                subtitle="Email, teléfono, dirección, coordenadas"
                open={openSection === "contacto"}
                onClick={() => setOpenSection("contacto")}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Email de contacto</label>
                    <input
                      type="email"
                      value={formContactEmail}
                      onChange={(e) => setFormContactEmail(e.target.value)}
                      placeholder="info@demo-studio.example.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Teléfono</label>
                    <input
                      type="tel"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      placeholder="+34 600 000 000"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Dirección del evento</label>
                  <input
                    type="text"
                    value={formLocationAddress}
                    onChange={(e) => setFormLocationAddress(e.target.value)}
                    placeholder="Calle Ejemplo 1, 28001 Madrid"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Latitud</label>
                    <input
                      type="number"
                      step="any"
                      value={formLatitude}
                      onChange={(e) => setFormLatitude(e.target.value)}
                      placeholder="40.460000"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Longitud</label>
                    <input
                      type="number"
                      step="any"
                      value={formLongitude}
                      onChange={(e) => setFormLongitude(e.target.value)}
                      placeholder="-3.700000"
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Coordenadas opcionales. Google Maps embed se renderizará en la ruta pública si están presentes.
                </p>
              </AccordionSection>

              {/* Sección 4 — URL pública */}
              {formOnlineReg && formSlug && (
                <AccordionSection
                  icon={<Globe className="h-4 w-4" />}
                  title="4. URL pública"
                  subtitle="Link de inscripción compartible"
                  open={openSection === "publica"}
                  onClick={() => setOpenSection("publica")}
                >
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Link de inscripción:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-white px-2 py-1.5 rounded border border-blue-100 text-slate-700 truncate">
                        /c/{formSlug}
                      </code>
                      <button
                        onClick={() => copyPublicUrl(formSlug)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 hover:bg-blue-100"
                        title="Copiar URL completa"
                        type="button"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-blue-700">
                      Comparte por WhatsApp, redes sociales o email. Los participantes podrán inscribirse sin necesidad de cuenta.
                    </p>
                  </div>
                </AccordionSection>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-2">
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

function AccordionSection(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
  onToggle?: () => void;
}) {
  const { icon, title, subtitle, open, onClick, children } = props;
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  );
}
