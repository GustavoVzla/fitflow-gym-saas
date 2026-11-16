"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarCog,
  CreditCard,
  Bell,
  Lock,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Globe,
  Palette,
} from "lucide-react";
import {
  updateGymProfileAction,
  updateGymSettingsAction,
  updateGymFiscalDataAction,
  connectStripeKeysAction,
  revokeStripeKeysAction,
  fetchConnectedStripeAccountAction,
  updateGymLogoAction,
  updateGymBrandColorAction,
  updateGymWebHeroAction,
  updateGymWebGalleryAction,
} from "./actions";
import { ImageUploader } from "@/components/configuracion/ImageUploader";
import { GalleryUploader } from "@/components/configuracion/GalleryUploader";
import { resetOnboardingDismissedAction } from "../onboarding-actions";
import type { GymProfile, GymSettings, CurrentUserInfo, PaymentMode, StripeAccountInfo } from "./types";
import { STATUS_LABEL, STATUS_STYLES } from "./types";
import FeatureTour from "@/components/dashboard/FeatureTour";
import HowItWorksButton from "@/components/dashboard/HowItWorksButton";
import { CONFIGURACION_TOUR } from "@/lib/tours";

type Tab = "perfil" | "web-publica" | "fiscales" | "reservas" | "pagos" | "notificaciones";

type Props = {
  initialProfile: GymProfile;
  initialSettings: GymSettings | null;
  user: CurrentUserInfo;
  seenTourKeys: string[];
  initialTab?: Tab;
};

const TABS: Array<{
  key: Tab;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { key: "perfil", label: "Perfil del centro", icon: Building2 },
  { key: "web-publica", label: "Web pública", icon: Globe },
  { key: "fiscales", label: "Datos fiscales", icon: Receipt },
  { key: "reservas", label: "Reservas", icon: CalendarCog },
  { key: "pagos", label: "Pagos", icon: CreditCard },
  { key: "notificaciones", label: "Notificaciones", icon: Bell },
];

const TIMEZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "America/Mexico_City",
  "America/Bogota",
  "America/Buenos_Aires",
];

export default function ConfiguracionClient({
  initialProfile,
  initialSettings,
  user,
  seenTourKeys,
  initialTab = "perfil",
}: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [settings, setSettings] = useState(initialSettings);
  useEffect(() => setProfile(initialProfile), [initialProfile]);
  useEffect(() => setSettings(initialSettings), [initialSettings]);

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      setToast({ text, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FeatureTour tourKey="configuracion-v1" steps={CONFIGURACION_TOUR} seenTourKeys={seenTourKeys} />
      <div data-tour="config-header" className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Configuración
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[profile.status]}`}
          >
            {STATUS_LABEL[profile.status]}
          </span>
          <HowItWorksButton steps={CONFIGURACION_TOUR} />
        </div>
        <p className="text-sm text-slate-500">
          Gestiona los datos del centro, las reglas de reservas y las integraciones de pago.
        </p>
        {!user.canEdit && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Estás en modo solo lectura (rol: {user.role}). Para editar, pide al owner del gym que te asigne rol admin.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div data-tour="config-tabs" className="border-b border-slate-200">
        <div className="flex flex-wrap gap-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#3b8bea] text-[#3b8bea]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "perfil" && (
        <PerfilTab
          profile={profile}
          canEdit={user.canEdit}
          isPending={isPending}
          onSubmit={(fd) => {
            startTransition(async () => {
              const result = await updateGymProfileAction({}, fd);
              if (result.error) showToast(`Error: ${result.error}`, "error");
              else {
                router.refresh();
                showToast(result.success ?? "Perfil guardado");
              }
            });
          }}
        />
      )}

      {activeTab === "perfil" && user.canEdit && (
        <ResetGuideSection
          gymId={profile.id}
          isPending={isPending}
          onReset={() => {
            startTransition(async () => {
              const res = await resetOnboardingDismissedAction(profile.id);
              if (!res.ok) {
                showToast(`Error: ${res.error}`, "error");
              } else {
                router.refresh();
                showToast("Guía reactivada. Vuelve al Dashboard para verla.", "success");
              }
            });
          }}
        />
      )}

      {activeTab === "web-publica" && (
        <WebPublicaTab
          profile={profile}
          canEdit={user.canEdit}
          onLogoChange={(url) => {
            startTransition(async () => {
              const res = await updateGymLogoAction(url);
              if (res.error) showToast(`Error: ${res.error}`, "error");
              else {
                setProfile({ ...profile, logoUrl: url });
                router.refresh();
                showToast(res.success ?? "Logo actualizado");
              }
            });
          }}
          onBrandColorChange={(hex) => {
            startTransition(async () => {
              const res = await updateGymBrandColorAction(hex);
              if (res.error) showToast(`Error: ${res.error}`, "error");
              else {
                setSettings(settings ? { ...settings, brandColor: hex } : settings);
                router.refresh();
                showToast(res.success ?? "Color actualizado");
              }
            });
          }}
          currentBrandColor={settings?.brandColor ?? "#3b8bea"}
          onHeroChange={(url) => {
            startTransition(async () => {
              const res = await updateGymWebHeroAction(url);
              if (res.error) showToast(`Error: ${res.error}`, "error");
              else {
                setProfile({ ...profile, webHeroUrl: url });
                router.refresh();
                showToast(res.success ?? "Hero actualizado");
              }
            });
          }}
          onGalleryChange={(urls) => {
            startTransition(async () => {
              const res = await updateGymWebGalleryAction(urls);
              if (res.error) showToast(`Error: ${res.error}`, "error");
              else {
                setProfile({ ...profile, webGalleryUrls: urls });
                router.refresh();
                showToast(res.success ?? "Galería actualizada");
              }
            });
          }}
        />
      )}

      {activeTab === "fiscales" && (
        <FiscalesTab
          profile={profile}
          canEdit={user.canEdit}
          isPending={isPending}
          onSubmit={(fd) => {
            startTransition(async () => {
              const result = await updateGymFiscalDataAction({}, fd);
              if (result.error) showToast(`Error: ${result.error}`, "error");
              else {
                router.refresh();
                showToast(result.success ?? "Datos fiscales guardados");
              }
            });
          }}
        />
      )}

      {activeTab === "reservas" && (
        <ReservasConfigTab
          settings={settings}
          canEdit={user.canEdit}
          isPending={isPending}
          onSubmit={(fd) => {
            startTransition(async () => {
              const result = await updateGymSettingsAction({}, fd);
              if (result.error) showToast(`Error: ${result.error}`, "error");
              else {
                router.refresh();
                showToast(result.success ?? "Configuración guardada");
              }
            });
          }}
        />
      )}

      {activeTab === "pagos" && (
        <PagosTab
          profile={profile}
          canEdit={user.canEdit}
          onToast={showToast}
        />
      )}

      {activeTab === "notificaciones" && <AvisosPromoTab />}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ─── Reset Guide Section ─── */

function ResetGuideSection({
  gymId,
  isPending,
  onReset,
}: {
  gymId: string;
  isPending: boolean;
  onReset: () => void;
}) {
  void gymId; // gymId is used by parent component via onReset closure
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Guía "Empieza aquí"
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Reactivar el checklist inicial en el dashboard. Útil si la ocultaste y quieres
            volver a ver los pasos pendientes para configurar el gym.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isPending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#3b8bea] bg-white px-4 text-[13px] font-medium text-[#3b8bea] shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Reactivando..." : "Ver guía otra vez"}
        </button>
      </div>
    </div>
  );
}

/* ─── Perfil Tab ─── */

function PerfilTab({
  profile,
  canEdit,
  isPending,
  onSubmit,
}: {
  profile: GymProfile;
  canEdit: boolean;
  isPending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit(fd);
      }}
      className="space-y-6 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div className="flex items-start gap-5 flex-wrap">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-500 overflow-hidden flex-shrink-0"
        >
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="Logo" className="h-full w-full rounded-full object-cover" />
          ) : (
            profile.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            fitflow.app/<strong className="text-slate-500">{profile.slug}</strong>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Plan: <span className="capitalize">{profile.plan}</span> · {profile.currency} · {profile.timezone}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Para cambiar el logo o los colores, ve a la pestaña <strong>Web pública</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          name="name"
          label="Nombre del centro"
          defaultValue={profile.name}
          disabled={!canEdit}
          required
          maxLength={100}
        />
        <Field
          name="email"
          label="Email de contacto"
          type="email"
          defaultValue={profile.email ?? ""}
          disabled={!canEdit}
        />
        <Field
          name="phone"
          label="Teléfono"
          type="tel"
          defaultValue={profile.phone ?? ""}
          disabled={!canEdit}
        />
        <Field
          name="website"
          label="Sitio web"
          type="url"
          defaultValue={profile.website ?? ""}
          disabled={!canEdit}
          placeholder="https://..."
        />
        <Field
          name="taxId"
          label="CIF / NIF"
          defaultValue={profile.taxId ?? ""}
          disabled={!canEdit}
        />
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Zona horaria
          </label>
          <select
            name="timezone"
            defaultValue={profile.timezone}
            disabled={!canEdit}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Field
            name="address"
            label="Dirección"
            defaultValue={profile.address ?? ""}
            disabled={!canEdit}
            placeholder="Calle, número"
          />
        </div>
        <Field
          name="city"
          label="Ciudad"
          defaultValue={profile.city ?? ""}
          disabled={!canEdit}
        />
        <Field
          name="postalCode"
          label="Código postal"
          defaultValue={profile.postalCode ?? ""}
          disabled={!canEdit}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
        <h4 className="text-sm font-semibold text-slate-800">Política de socios morosos</h4>
        <p className="mt-1 text-xs text-slate-500">
          Bloquea automáticamente las reservas de socios con pagos pendientes vencidos desde
          hace más de <strong>N días</strong>. El desbloqueo se realiza manualmente desde la ficha del socio
          tras registrar el pago.
        </p>
        <div className="mt-3 max-w-sm">
          <Field
            name="blockMorososAfterDays"
            label="Bloquear tras (días)"
            type="number"
            defaultValue={
              profile.blockMorososAfterDays !== null ? String(profile.blockMorososAfterDays) : ""
            }
            placeholder="Desactivado"
            disabled={!canEdit}
            min={1}
            max={90}
            helper="Vacío = feature desactivada. Rango 1-90 días. LegacyGym usa 5 días por defecto."
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-[#3b8bea] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </form>
  );
}

/* ─── Datos Fiscales Tab (RD 1619/2012 ES) ─── */

function FiscalesTab({
  profile,
  canEdit,
  isPending,
  onSubmit,
}: {
  profile: GymProfile;
  canEdit: boolean;
  isPending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  const hasMinimumFiscalData =
    profile.legalName && profile.taxId && profile.fiscalAddressLine1 && profile.fiscalAddressCity;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
        <p className="font-semibold">¿Por qué separamos el emisor del perfil del centro?</p>
        <p className="mt-1 text-blue-800">
          El nombre comercial ("Demo Studio") puede diferir de la razón social legal ("DEMO FITNESS SL"). La
          factura emitida bajo el Real Decreto 1619/2012 (Reglamento de Facturación) debe llevar la razón social,
          CIF/NIF y domicilio fiscal exactos de la entidad jurídica que factura, no el nombre comercial.
        </p>
      </div>

      {!hasMinimumFiscalData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">Datos fiscales incompletos</p>
          <p className="mt-1">
            Completa los cuatro campos obligatorios antes de generar tu primera factura. Sin estos datos las facturas
            emitidas no cumplirán el RD 1619/2012.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit(fd);
        }}
        className="space-y-6 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Emisor de las facturas</h3>
          <p className="mt-1 text-xs text-slate-400">
            Estos datos aparecen en cada factura que emitas desde FitFlow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              name="legalName"
              label="Razón social (denominación legal)"
              defaultValue={profile.legalName ?? ""}
              disabled={!canEdit}
              required
              maxLength={200}
              placeholder="Ej.: DEMO FITNESS SL"
              helper="Nombre exacto inscrito en el Registro Mercantil. No usar el nombre comercial."
            />
          </div>
          <Field
            name="taxId"
            label="CIF / NIF"
            defaultValue={profile.taxId ?? ""}
            disabled={!canEdit}
            required
            maxLength={20}
            placeholder="B11111111"
            helper="Empresas: letra + 8 dígitos. Autónomos: NIF/NIE."
          />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              País <span className="text-red-500">*</span>
            </label>
            <select
              name="fiscalCountryCode"
              defaultValue={profile.fiscalCountryCode ?? "ES"}
              disabled={!canEdit}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="ES">España</option>
              <option value="PT">Portugal</option>
              <option value="FR">Francia</option>
              <option value="IT">Italia</option>
              <option value="DE">Alemania</option>
              <option value="GB">Reino Unido</option>
              <option value="MX">México</option>
              <option value="AR">Argentina</option>
              <option value="CO">Colombia</option>
              <option value="VE">Venezuela</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Field
              name="fiscalAddressLine1"
              label="Domicilio fiscal"
              defaultValue={profile.fiscalAddressLine1 ?? ""}
              disabled={!canEdit}
              required
              maxLength={200}
              placeholder="C/ Ejemplo 1"
              helper="Dirección completa registrada en Hacienda. Puede diferir del domicilio del centro."
            />
          </div>
          <Field
            name="fiscalAddressPostalCode"
            label="Código postal"
            defaultValue={profile.fiscalAddressPostalCode ?? ""}
            disabled={!canEdit}
            required
            maxLength={10}
            placeholder="28040"
          />
          <Field
            name="fiscalAddressCity"
            label="Ciudad"
            defaultValue={profile.fiscalAddressCity ?? ""}
            disabled={!canEdit}
            required
            maxLength={100}
            placeholder="Madrid"
          />
        </div>

        {canEdit && (
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[#3b8bea] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar datos fiscales"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ─── Reservas Config Tab ─── */

function ReservasConfigTab({
  settings,
  canEdit,
  isPending,
  onSubmit,
}: {
  settings: GymSettings | null;
  canEdit: boolean;
  isPending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  const [waitlistEnabled, setWaitlistEnabled] = useState(
    settings?.waitlistEnabled ?? true
  );
  const [brandColor, setBrandColor] = useState(settings?.brandColor ?? "#3b8bea");

  useEffect(() => {
    if (settings) {
      setWaitlistEnabled(settings.waitlistEnabled);
      setBrandColor(settings.brandColor);
    }
  }, [settings]);

  if (!settings) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 text-center text-sm text-slate-500">
        No hay configuración del gym. Recarga la página.
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("waitlistEnabled", waitlistEnabled ? "true" : "false");
        fd.set("brandColor", brandColor);
        onSubmit(fd);
      }}
      className="space-y-6 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Reglas de reservas</h3>
        <p className="mt-1 text-xs text-slate-400">
          Controlan cuándo un socio puede reservar o cancelar su plaza en una clase.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          name="bookingAdvanceDays"
          label="Días de antelación para reservar"
          type="number"
          defaultValue={String(settings.bookingAdvanceDays)}
          disabled={!canEdit}
          min={0}
          max={90}
          helper="Máximo de días futuros que un socio puede reservar"
        />
        <Field
          name="bookingCancelHours"
          label="Horas mínimas para cancelar"
          type="number"
          defaultValue={String(settings.bookingCancelHours)}
          disabled={!canEdit}
          min={0}
          max={72}
          helper="Horas antes del inicio hasta las que se puede cancelar sin penalización"
        />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Lista de espera activa</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Cuando una clase se llena, los socios pueden apuntarse en cola y serán promovidos automáticamente si alguien cancela.
          </p>
        </div>
        <button
          type="button"
          onClick={() => canEdit && setWaitlistEnabled((v) => !v)}
          disabled={!canEdit}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            waitlistEnabled ? "bg-[#3b8bea]" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              waitlistEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
          Color de marca
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            disabled={!canEdit}
            className="h-10 w-20 cursor-pointer rounded-lg border border-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            disabled={!canEdit}
            placeholder="#3b8bea"
            pattern="^#[0-9a-fA-F]{6}$"
            className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-mono text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
          <div className="flex-1 text-xs text-slate-400">
            Usado en el branding del panel y en los emails al socio.
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-[#3b8bea] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      )}
    </form>
  );
}

/* ─── Coming soon placeholder ─── */

function ComingSoonTab({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#3b8bea] ring-1 ring-blue-200">
        Próximamente
      </span>
    </div>
  );
}

/* ─── Avisos Promo Tab (reemplaza ComingSoon, enlaza al sub-tab operativo) ─── */

function AvisosPromoTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#3b8bea]">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Avisos automáticos</h3>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Operativo
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Plantillas que se disparan automáticamente cuando ocurre un evento: bienvenida al
              dar de alta, recordatorio de clase, tarifa por vencer, cumpleaños, pago fallido,
              cancelación de reserva. El cron procesa la cola cada 5 minutos.
            </p>
            <ul className="mt-3 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                8 eventos disparadores preconfigurados
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                Canales: in-app, email, SMS y WhatsApp
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                Merge tags {"{nombre}"} {"{fecha_vencimiento}"} {"{nombre_tarifa}"}
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                Historial de envíos de las últimas 24h
              </li>
            </ul>
            <Link
              href="/configuracion/avisos"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
            >
              Gestionar avisos automáticos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagos Tab (modo direct_keys + manual + placeholders Fase 2-4) ─── */

const PAYMENT_MODE_DESCRIPTIONS: Record<
  PaymentMode,
  { title: string; body: string; available: boolean }
> = {
  manual: {
    title: "Modo manual activo",
    body: "Tu centro registra los cobros manualmente en la sección Pagos. Sin integración con Stripe. Para activar cobros online, contacta con FitFlow para cambiar de modo.",
    available: true,
  },
  direct_keys: {
    title: "Modo Direct Keys — cuenta Stripe propia",
    body: "Conecta tu propia cuenta de Stripe pegando las credenciales de tu dashboard. FitFlow disparará cobros desde tu cuenta y tú gestionas todo desde Stripe (facturación, disputas, payouts).",
    available: true,
  },
  connect_express: {
    title: "Modo Connect Express",
    body: "Onboarding de Stripe hosted dentro de FitFlow. Disponible en Fase 2.",
    available: false,
  },
  connect_standard: {
    title: "Modo Connect Standard",
    body: "OAuth con tu cuenta Stripe existente. Disponible en Fase 3.",
    available: false,
  },
  managed: {
    title: "Modo Managed (FitFlow)",
    body: "FitFlow gestiona los cobros y te paga periódicamente. Disponible en Fase 4.",
    available: false,
  },
};

function PagosTab({
  profile,
  canEdit,
  onToast,
}: {
  profile: GymProfile;
  canEdit: boolean;
  onToast: (text: string, type?: "success" | "error") => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [account, setAccount] = useState<StripeAccountInfo | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Form state (solo modo direct_keys sin configurar)
  const [pubKey, setPubKey] = useState("");
  const [secKey, setSecKey] = useState("");
  const [whSecret, setWhSecret] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mode = profile.paymentMode;
  const modeInfo = PAYMENT_MODE_DESCRIPTIONS[mode];
  const isDirectKeys = mode === "direct_keys";
  const isConfigured = isDirectKeys && profile.stripeOnboardedAt !== null;

  // Carga info de cuenta si direct_keys + configurado
  useEffect(() => {
    if (!isDirectKeys || !isConfigured) {
      setAccount(null);
      return;
    }
    setAccountLoading(true);
    setAccountError(null);
    fetchConnectedStripeAccountAction()
      .then((res) => {
        if (res.ok) {
          setAccount({
            accountId: res.account.accountId,
            email: res.account.email,
            country: res.account.country,
            businessName: res.account.businessName,
            chargesEnabled: res.account.chargesEnabled,
            payoutsEnabled: res.account.payoutsEnabled,
            isLiveMode: res.account.isLiveMode,
          });
        } else {
          setAccountError(res.error);
        }
      })
      .finally(() => setAccountLoading(false));
  }, [isDirectKeys, isConfigured]);

  const handleConnect = () => {
    setFormError(null);
    if (!pubKey || !secKey) {
      setFormError("Introduce ambas claves (publishable y secret)");
      return;
    }
    startTransition(async () => {
      const res = await connectStripeKeysAction(pubKey, secKey, whSecret || undefined);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setAccount({
        accountId: res.account.accountId,
        email: res.account.email,
        country: res.account.country,
        businessName: res.account.businessName,
        chargesEnabled: res.account.chargesEnabled,
        payoutsEnabled: res.account.payoutsEnabled,
        isLiveMode: res.account.isLiveMode,
      });
      setPubKey("");
      setSecKey("");
      setWhSecret("");
      onToast("Cuenta Stripe conectada correctamente");
      router.refresh();
    });
  };

  const handleRevoke = () => {
    if (!confirm("¿Revocar credenciales Stripe? Los cobros nuevos no se enviarán a Stripe hasta reconfigurar.")) return;
    startTransition(async () => {
      const res = await revokeStripeKeysAction();
      if (res.error) {
        onToast(`Error: ${res.error}`, "error");
        return;
      }
      setAccount(null);
      onToast(res.success ?? "Credenciales revocadas");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Header modo actual */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CreditCard className="h-4 w-4 text-slate-500" />
              {modeInfo.title}
            </h3>
            <p className="mt-1.5 max-w-2xl text-xs text-slate-500">{modeInfo.body}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
              modeInfo.available
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-slate-100 text-slate-500 ring-slate-200"
            }`}
          >
            {modeInfo.available ? "Activo" : "No disponible"}
          </span>
        </div>
      </div>

      {/* Modo manual: nada más que mostrar */}
      {mode === "manual" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-xs text-slate-500">
            Para cambiar a Stripe o Managed, contacta con tu responsable de cuenta FitFlow.
          </p>
        </div>
      )}

      {/* Modos no disponibles: placeholder */}
      {!modeInfo.available && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
          <p className="text-xs text-amber-800">{modeInfo.body}</p>
        </div>
      )}

      {/* Modo direct_keys: UI principal */}
      {isDirectKeys && !isConfigured && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900">Conectar tu cuenta Stripe</h4>
          <p className="mt-1 text-xs text-slate-500">
            Pega tus credenciales desde el{" "}
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b8bea] hover:underline"
            >
              dashboard de Stripe
            </a>
            . Validaremos la clave contra Stripe antes de guardarla (cifrada con Supabase Vault).
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Publishable Key (pk_live_... o pk_test_...)
              </label>
              <input
                type="text"
                value={pubKey}
                onChange={(e) => setPubKey(e.target.value)}
                disabled={!canEdit || isPending}
                placeholder="pk_live_..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[12px] text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Secret Key (sk_live_... o sk_test_...)
              </label>
              <input
                type="password"
                value={secKey}
                onChange={(e) => setSecKey(e.target.value)}
                disabled={!canEdit || isPending}
                placeholder="sk_live_..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[12px] text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Se cifra con Supabase Vault (AES-256) antes de guardarse. FitFlow nunca registra tu clave en logs ni la expone al navegador.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Webhook Signing Secret (opcional)
              </label>
              <input
                type="password"
                value={whSecret}
                onChange={(e) => setWhSecret(e.target.value)}
                disabled={!canEdit || isPending}
                placeholder="whsec_..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[12px] text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Opcional ahora. Se configurará al activar notificaciones de pago por webhook.
              </p>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={isPending || !pubKey || !secKey}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
              >
                {isPending ? "Validando con Stripe..." : "Validar y conectar"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modo direct_keys configurado: mostrar cuenta conectada */}
      {isDirectKeys && isConfigured && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Cuenta Stripe conectada
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Onboarded el {new Date(profile.stripeOnboardedAt!).toLocaleDateString("es-ES")}
              </p>
            </div>
            {account && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                  account.isLiveMode
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}
              >
                {account.isLiveMode ? "Modo Live" : "Modo Test"}
              </span>
            )}
          </div>

          {accountLoading && (
            <p className="mt-4 text-xs text-slate-500">Cargando info de la cuenta...</p>
          )}

          {accountError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {accountError}
            </div>
          )}

          {account && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoRow label="Account ID" value={account.accountId} mono />
              <InfoRow label="Email" value={account.email ?? "—"} />
              <InfoRow label="País" value={account.country ?? "—"} />
              <InfoRow label="Nombre de negocio" value={account.businessName ?? "—"} />
              <InfoRow
                label="Cargos habilitados"
                value={account.chargesEnabled ? "Sí" : "No"}
                emphasize={account.chargesEnabled ? "green" : "red"}
              />
              <InfoRow
                label="Payouts habilitados"
                value={account.payoutsEnabled ? "Sí" : "No"}
                emphasize={account.payoutsEnabled ? "green" : "red"}
              />
              <InfoRow label="Publishable key" value={profile.stripePublishableKey ?? "—"} mono />
              <InfoRow
                label="Comisiones FitFlow"
                value={`SEPA ${profile.feePercentSepa}% · Tarjeta ${profile.feePercentCard}%`}
              />
            </div>
          )}

          {canEdit && (
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isPending}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                {isPending ? "Procesando..." : "Revocar y reconfigurar"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  emphasize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: "green" | "red";
}) {
  const valueClass = emphasize === "green" ? "text-emerald-700" : emphasize === "red" ? "text-red-700" : "text-slate-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-[13px] font-semibold ${mono ? "font-mono" : ""} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

/* ─── Field component ─── */

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  disabled,
  required,
  min,
  max,
  maxLength,
  helper,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  helper?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
      />
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}

function WebPublicaTab({
  profile,
  canEdit,
  currentBrandColor,
  onLogoChange,
  onBrandColorChange,
  onHeroChange,
  onGalleryChange,
}: {
  profile: GymProfile;
  canEdit: boolean;
  currentBrandColor: string;
  onLogoChange: (url: string | null) => void;
  onBrandColorChange: (hex: string) => void;
  onHeroChange: (url: string | null) => void;
  onGalleryChange: (urls: string[]) => void;
}) {
  const [pendingColor, setPendingColor] = useState(currentBrandColor);

  useEffect(() => {
    setPendingColor(currentBrandColor);
  }, [currentBrandColor]);

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Solo el owner o admin del gym puede editar la marca y la web pública.
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Palette className="h-4 w-4 text-[var(--brand-color,#0B4B8C)]" />
            Identidad visual
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Logo del centro y color principal. Se usan en panel, app de socios y web pública.
          </p>
        </header>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Logo</p>
            <ImageUploader
              gymId={profile.id}
              kind="logo"
              currentUrl={profile.logoUrl}
              onUploaded={onLogoChange}
              onRemove={() => onLogoChange(null)}
              previewShape="circle"
              label={profile.logoUrl ? "Cambiar logo" : "Subir logo"}
              helperText="PNG/JPG/WEBP/SVG cuadrado, máx 5 MB. Ideal 512×512 px."
              disabled={!canEdit}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Color de marca</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={pendingColor}
                onChange={(e) => setPendingColor(e.target.value)}
                disabled={!canEdit}
                className="h-10 w-16 rounded-md border border-slate-300 cursor-pointer disabled:opacity-50"
              />
              <input
                type="text"
                value={pendingColor}
                onChange={(e) => setPendingColor(e.target.value)}
                disabled={!canEdit}
                className="w-28 h-9 rounded-md border border-slate-300 px-2 text-sm font-mono"
                placeholder="#0B4B8C"
              />
              {pendingColor !== currentBrandColor && /^#[0-9a-f]{6}$/i.test(pendingColor) && (
                <button
                  type="button"
                  onClick={() => onBrandColorChange(pendingColor)}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-color,#0B4B8C)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Guardar color
                </button>
              )}
              <span
                className="h-8 w-8 rounded-md ring-1 ring-slate-200"
                style={{ backgroundColor: currentBrandColor }}
                title={`Actual: ${currentBrandColor}`}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Tono principal para botones, badges y enlaces destacados.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Globe className="h-4 w-4 text-[var(--brand-color,#0B4B8C)]" />
            Imagen principal de la web pública
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Hero que aparece en la home pública del centro (`demo-studio.example.com`).
            Recomendado 1920×1080.
          </p>
        </header>

        <ImageUploader
          gymId={profile.id}
          kind="web-hero"
          currentUrl={profile.webHeroUrl}
          onUploaded={onHeroChange}
          onRemove={() => onHeroChange(null)}
          previewShape="wide"
          label={profile.webHeroUrl ? "Cambiar hero" : "Subir hero"}
          helperText="PNG/JPG/WEBP apaisada 16:9, máx 5 MB. Calidad alta, poco texto."
          disabled={!canEdit}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <GalleryUploader
          gymId={profile.id}
          currentUrls={profile.webGalleryUrls}
          maxItems={12}
          onUpdate={onGalleryChange}
          disabled={!canEdit}
        />
      </section>
    </div>
  );
}
