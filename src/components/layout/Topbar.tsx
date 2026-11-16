"use client";

import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import UserMenu from "./UserMenu";

type TopbarProps = {
  user: {
    email: string;
    initials: string;
    gymName: string;
  };
};

const routeTitles: Record<string, { title: string; breadcrumb: string; parent?: string }> = {
  "/": { title: "Dashboard", breadcrumb: "Inicio" },
  "/reservas": { title: "Reservas", breadcrumb: "Reservas" },
  "/horario": { title: "Horario", breadcrumb: "Horario" },
  "/socios": { title: "Socios", breadcrumb: "Socios" },
  "/potenciales": { title: "Potenciales", breadcrumb: "Potenciales" },
  "/familias": { title: "Familias", breadcrumb: "Familias" },
  "/grupos-entreno": { title: "Grupos de entreno", breadcrumb: "Grupos de entreno" },
  "/pagos": { title: "Pagos", breadcrumb: "Pagos" },
  "/pagos/gastos": { title: "Gastos", breadcrumb: "Gastos", parent: "Pagos" },
  "/pagos/facturacion": { title: "Facturación", breadcrumb: "Facturación", parent: "Pagos" },
  "/pagos/caja-diaria": { title: "Caja diaria", breadcrumb: "Caja diaria", parent: "Pagos" },
  "/clases-tarifas": { title: "Clases y Tarifas", breadcrumb: "Clases y Tarifas" },
  "/citas": { title: "Citas", breadcrumb: "Citas" },
  "/tareas": { title: "Tareas", breadcrumb: "Tareas" },
  "/mensajes": { title: "Mensajes", breadcrumb: "Mensajes" },
  "/fidelizacion": { title: "Fidelización", breadcrumb: "Fidelización" },
  "/publicaciones": { title: "Publicaciones", breadcrumb: "Publicaciones" },
  "/tienda": { title: "Tienda", breadcrumb: "Tienda" },
  "/entrenamientos": { title: "Entrenamientos", breadcrumb: "Entrenamientos" },
  "/competiciones": { title: "Competiciones", breadcrumb: "Competiciones" },
  "/ofertas": { title: "Ofertas", breadcrumb: "Ofertas" },
  "/chatbot": { title: "Chatbot IA", breadcrumb: "Chatbot IA" },
  "/automatizaciones": { title: "Automatizaciones", breadcrumb: "Automatizaciones" },
  "/analiticas": { title: "Analíticas IA", breadcrumb: "Analíticas IA" },
  "/informes": { title: "Informes", breadcrumb: "Informes" },
  "/configuracion": { title: "Configuración", breadcrumb: "Configuración" },
  "/configuracion/general": {
    title: "Configuración general",
    breadcrumb: "General",
    parent: "Configuración",
  },
  "/configuracion/web-publica": {
    title: "Web pública",
    breadcrumb: "Web pública",
    parent: "Configuración",
  },
  "/configuracion/clausulas": {
    title: "Cláusulas legales",
    breadcrumb: "Cláusulas",
    parent: "Configuración",
  },
  "/configuracion/avisos": {
    title: "Avisos automáticos",
    breadcrumb: "Avisos",
    parent: "Configuración",
  },
  "/configuracion/privacidad": {
    title: "Privacidad",
    breadcrumb: "Privacidad",
    parent: "Configuración",
  },
  "/configuracion/cuenta": {
    title: "Cuenta del owner",
    breadcrumb: "Cuenta",
    parent: "Configuración",
  },
  "/configuracion/cuenta/mfa/enroll": {
    title: "Activar 2FA",
    breadcrumb: "Activar 2FA",
    parent: "Cuenta",
  },
  "/configuracion/cuenta/mfa/challenge": {
    title: "Verificar 2FA",
    breadcrumb: "Verificar 2FA",
    parent: "Cuenta",
  },
  "/configuracion/formularios": {
    title: "Formularios custom",
    breadcrumb: "Formularios",
    parent: "Configuración",
  },
  "/configuracion/sepa": {
    title: "Domiciliaciones SEPA",
    breadcrumb: "SEPA",
    parent: "Configuración",
  },
  "/configuracion/integraciones": {
    title: "Integraciones",
    breadcrumb: "Integraciones",
    parent: "Configuración",
  },
  "/mejoras": { title: "Mejoras", breadcrumb: "Mejoras" },
};

// Dynamic-route fallback: /pagos/facturacion/<uuid> → "Facturación" con parent "Pagos".
// Si aún así no matchea, derivamos título legible del pathname (evita mostrar "FitFlow / Inicio"
// como breadcrumb de una ruta existente pero no registrada arriba).
function resolveRoute(pathname: string): { title: string; breadcrumb: string; parent?: string } {
  if (routeTitles[pathname]) return routeTitles[pathname];
  // Busca el prefix mas largo que coincida
  const keys = Object.keys(routeTitles)
    .filter((k) => k !== "/" && pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length);
  if (keys.length > 0) return routeTitles[keys[0]];
  // Derivación automática desde segments del path
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    const label = last
      .replace(/-/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase());
    return { title: label, breadcrumb: label };
  }
  return { title: "Dashboard", breadcrumb: "Inicio" };
}

export default function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const route = resolveRoute(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: Title + breadcrumb */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{user.gymName}</span>
          <span>/</span>
          {route.parent && (
            <>
              <span className="text-slate-500">{route.parent}</span>
              <span>/</span>
            </>
          )}
          <span className="text-slate-600">{route.breadcrumb}</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{route.title}</h2>
      </div>

      {/* Right: Search, notifications, avatar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#3b8bea] focus:bg-white focus:ring-1 focus:ring-[#3b8bea]/20"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white">
            2
          </span>
        </button>

        {/* User menu with logout */}
        <UserMenu
          initials={user.initials}
          email={user.email}
          gymName={user.gymName}
        />
      </div>
    </header>
  );
}
