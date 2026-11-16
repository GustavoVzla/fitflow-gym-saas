import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { GymProfile, GymSettings, CurrentUserInfo } from './types'

export type { GymProfile, GymSettings, CurrentUserInfo } from './types'

// Devuelve el perfil del primer gym del user actual (MVP 1-gym).
export const getGymProfile = cache(async (): Promise<GymProfile | null> => {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return null

  const gymId = gyms[0].gym_id

  const { data, error } = await supabase
    .from('gyms')
    .select(
      'id, slug, name, logo_url, address, city, postal_code, country, phone, email, website, timezone, currency, tax_id, status, plan, payment_mode, stripe_publishable_key, stripe_onboarded_at, fee_percent_sepa, fee_percent_card, legal_name, fiscal_address_line1, fiscal_address_postal_code, fiscal_address_city, fiscal_country_code, web_hero_url, web_gallery_urls, block_morosos_after_days'
    )
    .eq('id', gymId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    address: data.address,
    city: data.city,
    postalCode: data.postal_code,
    country: data.country,
    phone: data.phone,
    email: data.email,
    website: data.website,
    timezone: data.timezone,
    currency: data.currency,
    taxId: data.tax_id,
    status: data.status,
    plan: data.plan,
    paymentMode: data.payment_mode,
    stripePublishableKey: data.stripe_publishable_key,
    stripeOnboardedAt: data.stripe_onboarded_at,
    feePercentSepa: Number(data.fee_percent_sepa ?? 0),
    feePercentCard: Number(data.fee_percent_card ?? 0),
    legalName: data.legal_name,
    fiscalAddressLine1: data.fiscal_address_line1,
    fiscalAddressPostalCode: data.fiscal_address_postal_code,
    fiscalAddressCity: data.fiscal_address_city,
    fiscalCountryCode: data.fiscal_country_code ?? 'ES',
    webHeroUrl: (data as { web_hero_url?: string | null }).web_hero_url ?? null,
    webGalleryUrls: Array.isArray((data as { web_gallery_urls?: unknown }).web_gallery_urls)
      ? ((data as { web_gallery_urls: string[] }).web_gallery_urls)
      : [],
    blockMorososAfterDays: data.block_morosos_after_days,
  }
})

export const getGymSettings = cache(async (): Promise<GymSettings | null> => {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return null

  const { data, error } = await supabase
    .from('gym_settings')
    .select('gym_id, booking_advance_days, booking_cancel_hours, waitlist_enabled, brand_color')
    .eq('gym_id', gyms[0].gym_id)
    .single()

  if (error || !data) return null

  return {
    gymId: data.gym_id,
    bookingAdvanceDays: data.booking_advance_days,
    bookingCancelHours: data.booking_cancel_hours,
    waitlistEnabled: data.waitlist_enabled,
    brandColor: data.brand_color ?? '#3b8bea',
  }
})

export const getCurrentUserInfo = cache(async (): Promise<CurrentUserInfo | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return null

  const role = gyms[0].role as CurrentUserInfo['role']
  const canEdit: boolean = ['super_admin', 'owner', 'admin'].includes(role)

  return {
    email: user.email ?? '',
    role,
    canEdit,
  }
})
