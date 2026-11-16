import { Puzzle, Lock, ExternalLink, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Integration {
  id: string
  name: string
  description: string
  category: string
  logoColor: string
  requiredPlan: 'pro' | 'base'
  benefits: string[]
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'classpass',
    name: 'ClassPass',
    description:
      'Plataforma global que trae miembros ClassPass a tus clases (sin pagar comisión por socio fijo).',
    category: 'Marketplace',
    logoColor: 'bg-rose-100 text-rose-700',
    requiredPlan: 'pro',
    benefits: [
      'Clases publicadas automáticamente en la app ClassPass',
      'Check-in único con código socio',
      'Liquidación mensual consolidada',
    ],
  },
  {
    id: 'wellhub',
    name: 'Wellhub (ex Gympass)',
    description:
      'Beneficio corporativo: empleados de empresas cliente asisten a tus clases como parte de su plan.',
    category: 'Marketplace',
    logoColor: 'bg-emerald-100 text-emerald-700',
    requiredPlan: 'pro',
    benefits: [
      'Tu gimnasio visible en el catálogo Wellhub (España, Portugal, LATAM)',
      'Revenue recurrente sin captación directa',
      'Reports de utilización semanales',
    ],
  },
  {
    id: 'usc',
    name: 'USC — Unión Socios Centros',
    description:
      'Asociación gym españoles. Pasarela compartida para ofertas cross-centro (pase interclubs).',
    category: 'Asociación',
    logoColor: 'bg-blue-100 text-blue-700',
    requiredPlan: 'pro',
    benefits: [
      'Acceso recíproco de socios entre centros USC',
      'Campañas nacionales coordinadas',
      'Negociación conjunta proveedores',
    ],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description:
      'Crear reuniones Zoom automáticamente cuando una Cita 1:1 es virtual (entrenamiento online, consulta nutrición).',
    category: 'Video',
    logoColor: 'bg-sky-100 text-sky-700',
    requiredPlan: 'pro',
    benefits: [
      'Link Zoom único por cita generado al confirmar',
      'Envío automático al socio por email/WhatsApp',
      'Grabación opcional almacenada en drive del gym',
    ],
  },
  {
    id: 'ticketbai',
    name: 'TicketBAI / VeriFactu',
    description:
      'Compliance fiscal obligatorio en País Vasco (TicketBAI 2023) y España (VeriFactu 2026). Envío facturas a Hacienda en tiempo real.',
    category: 'Fiscal',
    logoColor: 'bg-amber-100 text-amber-700',
    requiredPlan: 'pro',
    benefits: [
      'Conexión certificada con AEAT y Diputaciones forales',
      'Envío automático al emitir factura',
      'Archivo QR + huella en PDF de la factura',
    ],
    comingSoon: true,
  },
  {
    id: 'n8n',
    name: 'n8n workflows custom',
    description:
      'Automatizaciones personalizadas: WhatsApp al no-show, Google Sheets backup, Slack notifications.',
    category: 'Automatización',
    logoColor: 'bg-violet-100 text-violet-700',
    requiredPlan: 'pro',
    benefits: [
      'Webhook endpoint por evento (nuevo socio, pago, no-show)',
      'Plantillas n8n pre-configuradas',
      'Soporte FitFlow para flujos custom',
    ],
  },
]

export default async function Page() {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) redirect('/login')

  const currentPlan = (gyms[0].gym_plan as string) ?? 'base'
  const isPro = currentPlan === 'pro' || currentPlan === 'premium'

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Puzzle className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
          Integraciones
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Conecta FitFlow con servicios externos para ampliar capacidades.
        </p>
      </header>

      {!isPro && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              Las integraciones requieren plan Pro
            </p>
            <p className="text-xs text-blue-800 mt-1">
              Activarlas está disponible en el plan Pro. Hoy tu gym usa{' '}
              <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded">
                {currentPlan}
              </code>
              . Contacta con Partner Agency / FitFlow para valorar el upgrade.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.id}
            className={`rounded-xl border bg-white p-5 ${
              integration.comingSoon ? 'opacity-70' : ''
            } ${integration.requiredPlan === 'pro' && !isPro ? 'border-slate-200' : 'border-slate-300'}`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${integration.logoColor}`}
              >
                {integration.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 truncate">{integration.name}</h3>
                  {integration.comingSoon && (
                    <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Próximamente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{integration.category}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">{integration.description}</p>

            <ul className="text-[11px] text-slate-500 space-y-1 mb-4">
              {integration.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {integration.comingSoon ? (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400 cursor-not-allowed"
              >
                <Info className="h-3.5 w-3.5" />
                Próximamente
              </button>
            ) : isPro ? (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-3 py-2 text-xs font-medium text-white opacity-60 cursor-not-allowed"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Activar (contacta FitFlow)
              </button>
            ) : (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed"
              >
                <Lock className="h-3.5 w-3.5" />
                Requiere plan Pro
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-600">
          <strong>Nota:</strong> activar cualquier integración requiere onboarding con FitFlow
          (credenciales API, webhook, mapping de campos). Escribe a{' '}
          <code className="font-mono">soluciones@example.com</code> indicando qué integración
          quieres activar.
        </p>
      </div>
    </div>
  )
}
