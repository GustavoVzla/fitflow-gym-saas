import { headers } from 'next/headers'

export interface HostBrand {
  name: string
  subtitle: string
  logoUrl: string | null
  faviconUrl: string
  isWhiteLabel: boolean
}

/**
 * Detect branding based on the request Host header.
 *
 * Opción A (D-PM2 setup): hardcoded por host. Funciona para la ventana
 * de un gym por subdominio canónico. Multi-gym cross-domain se resuelve
 * en sprint 30d con tabla gyms.custom_domain + DNS lookup.
 *
 * panel.example.com → Demo Studio (único tenant productivo hoy)
 * cualquier otro (localhost, app.*, etc.) → FitFlow default
 */
export async function getHostBrand(): Promise<HostBrand> {
  const h = await headers()
  const host = (h.get('host') ?? '').toLowerCase()

  // Demo Studio marca blanca en el dominio canónico del Panel
  if (host.includes('panel.example.com')) {
    return {
      name: 'Demo Studio',
      subtitle: 'Tu panel de gestión',
      logoUrl: '/gyms/demo-studio/logo.svg',
      faviconUrl: '/gyms/demo-studio/favicon.svg',
      isWhiteLabel: true,
    }
  }

  return {
    name: 'FitFlow',
    subtitle: 'Plataforma de gestión para centros deportivos',
    logoUrl: null,
    faviconUrl: '/favicon.svg',
    isWhiteLabel: false,
  }
}
