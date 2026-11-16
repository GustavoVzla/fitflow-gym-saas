import { Sparkles, Zap, Wrench } from "lucide-react";

/* ─── Types ─── */
interface Mejora {
  fecha: string;
  titulo: string;
  descripcion: string;
  tag: "nuevo" | "mejora" | "correccion" | "proximamente";
}

/* ─── Data ─── */
const mejoras: Mejora[] = [
  {
    fecha: "16 abril 2026",
    titulo: "Lanzamiento FitFlow",
    descripcion:
      "Primera version de la plataforma con gestion de socios, reservas, horarios, pagos y configuracion.",
    tag: "nuevo",
  },
  {
    fecha: "16 abril 2026",
    titulo: "Dashboard con KPIs en tiempo real",
    descripcion:
      "Panel de control con metricas de socios activos, ingresos, ticket medio y churn rate.",
    tag: "nuevo",
  },
  {
    fecha: "16 abril 2026",
    titulo: "Sistema de clases y tarifas",
    descripcion:
      "Configuracion completa de 5 tipos de clase y 14 tarifas con precios personalizables.",
    tag: "nuevo",
  },
  {
    fecha: "Proximo",
    titulo: "Chatbot con IA",
    descripcion:
      "Asistente virtual entrenado con los datos de tu centro: precios, horarios, clases y preguntas frecuentes. Responde 24/7.",
    tag: "proximamente",
  },
  {
    fecha: "Proximo",
    titulo: "Automatizaciones inteligentes",
    descripcion:
      "Emails de bienvenida, recordatorios de clase, alertas de vencimiento y reactivacion de socios inactivos.",
    tag: "proximamente",
  },
];

/* ─── Tag Badge ─── */
function TagBadge({ tag }: { tag: Mejora["tag"] }) {
  const config = {
    nuevo: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
      label: "Nuevo",
      icon: Sparkles,
    },
    mejora: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-200",
      label: "Mejora",
      icon: Zap,
    },
    correccion: {
      bg: "bg-red-50",
      text: "text-red-600",
      ring: "ring-red-200",
      label: "Correccion",
      icon: Wrench,
    },
    proximamente: {
      bg: "bg-blue-50",
      text: "text-[#3b8bea]",
      ring: "ring-blue-200",
      label: "Proximamente",
      icon: Sparkles,
    },
  }[tag];

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${config.bg} ${config.text} ${config.ring}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/* ─── Main Page ─── */
export default function MejorasPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ultimas mejoras</h1>
        <p className="mt-1 text-sm text-slate-500">Novedades y actualizaciones de FitFlow</p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

        <div className="space-y-6">
          {mejoras.map((mejora, index) => (
            <div key={index} className="relative flex gap-5 pl-0">
              {/* Dot */}
              <div className="relative z-10 mt-1.5 flex h-[31px] w-[31px] shrink-0 items-center justify-center">
                <div
                  className={`h-3 w-3 rounded-full ring-4 ring-white ${
                    mejora.tag === "proximamente" ? "bg-[#3b8bea]" : "bg-emerald-500"
                  }`}
                />
              </div>

              {/* Card */}
              <div className="group flex-1 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {mejora.fecha}
                  </span>
                  <TagBadge tag={mejora.tag} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-800">{mejora.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{mejora.descripcion}</p>
                <div
                  className={`absolute bottom-0 left-0 h-[3px] w-full opacity-0 transition-opacity group-hover:opacity-100 ${
                    mejora.tag === "proximamente" ? "bg-[#3b8bea]" : "bg-emerald-500"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
