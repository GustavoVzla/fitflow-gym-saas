"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  Users,
  Users2,
  UserPlus,
  CreditCard,
  List,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  Heart,
  Megaphone,
  ShoppingBag,
  Dumbbell,
  Trophy,
  Tag,
  Bot,
  Zap,
  Brain,
  BarChart3,
  Settings,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebar } from "./SidebarContext";
import {
  type FeatureKey,
  type PlanTier,
  FEATURE_MIN_PLAN,
  PLAN_LABEL,
  isFeatureAvailable,
} from "@/lib/plans";

interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  feature: FeatureKey;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sections: SidebarSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, feature: "dashboard" },
      { label: "Reservas", href: "/reservas", icon: CalendarCheck, feature: "reservas" },
      { label: "Horario", href: "/horario", icon: Clock, feature: "horario" },
      { label: "Socios", href: "/socios", icon: Users, feature: "socios" },
      { label: "Potenciales", href: "/potenciales", icon: UserPlus, feature: "potenciales" },
      { label: "Familias", href: "/familias", icon: Users2, feature: "familias" },
      { label: "Grupos de entreno", href: "/grupos-entreno", icon: Users2, feature: "grupos-entreno" },
      { label: "Instructores", href: "/socios/instructores", icon: Dumbbell, feature: "instructores" },
    ],
  },
  {
    title: "GESTION",
    items: [
      { label: "Pagos", href: "/pagos", icon: CreditCard, feature: "pagos" },
      { label: "Clases y Tarifas", href: "/clases-tarifas", icon: List, feature: "clases-tarifas" },
      { label: "Citas", href: "/citas", icon: CalendarDays, feature: "citas" },
      { label: "Tareas", href: "/tareas", icon: CheckSquare, feature: "tareas" },
    ],
  },
  {
    title: "COMUNICACION",
    items: [
      { label: "Mensajes", href: "/mensajes", icon: MessageSquare, feature: "mensajes" },
      { label: "Fidelizacion", href: "/fidelizacion", icon: Heart, feature: "fidelizacion" },
      { label: "Publicaciones", href: "/publicaciones", icon: Megaphone, feature: "publicaciones" },
    ],
  },
  {
    title: "HERRAMIENTAS",
    items: [
      { label: "Tienda", href: "/tienda", icon: ShoppingBag, feature: "tienda" },
      { label: "Entrenamientos", href: "/entrenamientos", icon: Dumbbell, feature: "entrenamientos" },
      { label: "Competiciones", href: "/competiciones", icon: Trophy, feature: "competiciones" },
      { label: "Ofertas", href: "/ofertas", icon: Tag, feature: "ofertas" },
    ],
  },
  {
    title: "INTELIGENCIA",
    items: [
      { label: "Chatbot IA", href: "/chatbot-ia", icon: Bot, feature: "chatbot-ia" },
      { label: "Automatizaciones", href: "/automatizaciones", icon: Zap, feature: "automatizaciones" },
      { label: "Analiticas IA", href: "/analiticas-ia", icon: Brain, feature: "analiticas-ia" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { label: "Informes", href: "/informes", icon: BarChart3, feature: "informes" },
      { label: "Configuracion", href: "/configuracion", icon: Settings, feature: "configuracion" },
      { label: "Mejoras", href: "/mejoras", icon: Sparkles, feature: "mejoras" },
    ],
  },
];

interface SidebarProps {
  currentPlan: PlanTier;
  gymName?: string;
  gymLogoUrl?: string | null;
  gymBrandColor?: string;
}

export default function Sidebar({
  currentPlan,
  gymName,
  gymLogoUrl,
  gymBrandColor = "#3b8bea",
}: SidebarProps) {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  // Compute a secondary color slightly lighter for gradient
  const brandGradientEnd = gymBrandColor;

  return (
    <aside
      className={`fixed top-0 left-0 z-40 flex h-screen flex-col bg-[#0f172a] text-white transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Header: Logo + Collapse toggle */}
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-3">
        <div className="flex items-center gap-3">
          {gymLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gymLogoUrl}
              alt={gymName ?? "Logo del gym"}
              className="h-9 w-9 shrink-0 rounded-lg object-cover bg-white"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${gymBrandColor}, ${brandGradientEnd})`,
              }}
            >
              <Activity className="h-5 w-5 text-white" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight" title={gymName}>
                {gymName ?? "FitFlow"}
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-400">
                Powered by FitFlow
              </p>
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          title={collapsed ? "Expandir" : "Minimizar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const locked = !isFeatureAvailable(currentPlan, item.feature);
                const minPlan = FEATURE_MIN_PLAN[item.feature];
                const Icon = item.icon;
                const titleAttr = collapsed
                  ? locked
                    ? `${item.label} · requiere plan ${PLAN_LABEL[minPlan]}`
                    : item.label
                  : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-blue-500/10 text-blue-400"
                          : locked
                          ? "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      } ${collapsed ? "justify-center" : ""}`}
                      title={titleAttr}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400" />
                      )}
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          isActive
                            ? "text-blue-400"
                            : locked
                            ? "text-slate-600 group-hover:text-slate-500"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {locked && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300 ring-1 ring-slate-600/50"
                              aria-label={`Requiere plan ${PLAN_LABEL[minPlan]}`}
                            >
                              <Lock className="h-2.5 w-2.5" />
                              {PLAN_LABEL[minPlan]}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && locked && (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-slate-900" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/5 px-4 py-3">
          <p className="text-center text-[10px] text-slate-600">
            Powered by FitFlow
          </p>
        </div>
      )}
    </aside>
  );
}
