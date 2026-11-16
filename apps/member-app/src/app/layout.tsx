import type { Metadata, Viewport } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import { studioBrand } from './theme'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    template: `%s · ${studioBrand.name}`,
    default: studioBrand.name,
  },
  description: studioBrand.description,
  applicationName: studioBrand.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: studioBrand.name,
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: studioBrand.themeColor,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="bg-[#0d0d1a] text-[#f0f0f5] min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
