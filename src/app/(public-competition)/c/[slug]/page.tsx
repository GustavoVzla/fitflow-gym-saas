import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { computeRangeLabel, formatPriceEuros } from '@/app/(dashboard)/competiciones/types'
import CompetitionRegistrationForm from './CompetitionRegistrationForm'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface PublicCompetition {
  id: string
  gym_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  type: string | null
  slug: string
  cover_image_url: string | null
  conditions: string | null
  online_registration_enabled: boolean
  price_cents: number | null
  tax_percent: number | null
  max_registrations: number | null
  waitlist_enabled: boolean
  categories: string[]
  contact_email: string | null
  contact_phone: string | null
  location_address: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  gym_name: string | null
}

async function getCompetitionBySlug(slug: string): Promise<PublicCompetition | null> {
  const supabase = await createClient()

  // Select directo sobre columnas 0067 — tipos no regenerados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('competitions') as any)
    .select('*, gyms(name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('online_registration_enabled', true)
    .maybeSingle()

  if (error || !data) return null

  return {
    ...(data as Record<string, unknown>),
    gym_name: (data as { gyms?: { name?: string } })?.gyms?.name ?? null,
  } as unknown as PublicCompetition
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const comp = await getCompetitionBySlug(slug)
  if (!comp) return { title: 'No encontrada' }
  return {
    title: comp.name,
    description: comp.description ?? `Inscríbete en ${comp.name}`,
    openGraph: {
      title: comp.name,
      description: comp.description ?? undefined,
      images: comp.cover_image_url ? [comp.cover_image_url] : undefined,
    },
  }
}

export default async function CompetitionPublicPage({ params }: PageProps) {
  const { slug } = await params
  const comp = await getCompetitionBySlug(slug)
  if (!comp) notFound()

  const startDate = new Date(comp.start_date + 'T00:00:00')
  const isFuture = startDate > new Date()
  const rangeLabel = computeRangeLabel(comp.start_date, comp.end_date)
  const priceLabel = formatPriceEuros(comp.price_cents)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
        {comp.cover_image_url && (
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-slate-200">
            {/* next/image requires whitelisted domains; usamos <img> simple para flexibilidad */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comp.cover_image_url}
              alt={comp.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {comp.gym_name && (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {comp.gym_name}
                </p>
              )}
              <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                {comp.name}
              </h1>
            </div>
            {comp.type && (
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                {comp.type}
              </span>
            )}
          </div>

          {comp.description && (
            <p className="mt-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {comp.description}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <InfoCard label="Fechas" value={rangeLabel} />
            <InfoCard label="Precio" value={priceLabel} highlight={comp.price_cents != null && comp.price_cents > 0} />
            {comp.max_registrations && (
              <InfoCard label="Aforo" value={`${comp.max_registrations} plazas`} />
            )}
            {comp.location_address && (
              <InfoCard label="Ubicación" value={comp.location_address} />
            )}
          </div>

          {comp.conditions && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-900 mb-1">Condiciones de participación</p>
              <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">
                {comp.conditions}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Formulario inscripción */}
      {isFuture ? (
        <div className="rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Inscríbete</h2>
          <p className="text-sm text-slate-500 mb-5">
            Completa el formulario. Recibirás un email con la confirmación.
          </p>
          <CompetitionRegistrationForm
            competitionSlug={comp.slug}
            gymId={comp.gym_id}
            categories={comp.categories ?? []}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-100 ring-1 ring-slate-200 p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Inscripciones cerradas
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Esta competición ya ha comenzado o finalizado.
          </p>
        </div>
      )}

      {/* Contacto */}
      {(comp.contact_email || comp.contact_phone) && (
        <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 md:p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            ¿Dudas?
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            {comp.contact_email && (
              <a
                href={`mailto:${comp.contact_email}`}
                className="text-[#3b8bea] hover:underline"
              >
                ✉️ {comp.contact_email}
              </a>
            )}
            {comp.contact_phone && (
              <a
                href={`tel:${comp.contact_phone}`}
                className="text-[#3b8bea] hover:underline"
              >
                📞 {comp.contact_phone}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Google Maps si lat/lng */}
      {comp.latitude != null && comp.longitude != null && (
        <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
          <iframe
            src={`https://www.google.com/maps?q=${comp.latitude},${comp.longitude}&z=15&output=embed`}
            className="w-full h-64 border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Ubicación ${comp.name}`}
          />
        </div>
      )}
    </div>
  )
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50 ring-1 ring-slate-200'}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-emerald-800' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}

