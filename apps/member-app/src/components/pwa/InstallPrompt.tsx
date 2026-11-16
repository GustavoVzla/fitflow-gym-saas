'use client'

import { useState } from 'react'
import { dismissInstallPromptManually, usePwaInstall } from '@/lib/hooks/usePwaInstall'

/**
 * Modal educativo invitando a instalar la app PWA cuando el browser expone
 * `beforeinstallprompt`. Se muestra tras >=2 visitas, con cooldown 30 dias
 * si el user lo rechaza.
 *
 * Safari/iOS recibe fallback con instrucciones manuales (Share → Add to Home).
 */
export function InstallPrompt() {
  const state = usePwaInstall()
  const [open, setOpen] = useState(true)

  if (!open) return null
  if (state.status === 'installed') return null
  if (state.status === 'dismissed-permanent') return null
  if (state.status === 'idle') return null

  if (state.status === 'unsupported') {
    // Safari iOS — solo se muestra si detectamos iOS en UA
    if (typeof navigator === 'undefined') return null
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    if (!isIOS) return null
    return (
      <Overlay
        onDismiss={() => {
          dismissInstallPromptManually()
          setOpen(false)
        }}
      >
        <h3 className="text-lg font-semibold text-white">Instala la app</h3>
        <p className="mt-2 text-sm text-white/80">
          Acceso rápido sin abrir el navegador. En iPhone:
        </p>
        <ol className="mt-3 space-y-2 text-sm text-white/90">
          <li className="flex gap-2">
            <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">1</span>
            <span>Pulsa el botón <strong>Compartir</strong> (el cuadrado con flecha hacia arriba).</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">2</span>
            <span>Desliza y selecciona <strong>Añadir a pantalla de inicio</strong>.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">3</span>
            <span>Pulsa <strong>Añadir</strong>. Listo — el icono aparece con el resto de tus apps.</span>
          </li>
        </ol>
      </Overlay>
    )
  }

  // status === 'ready'
  return (
    <Overlay
      onDismiss={() => {
        dismissInstallPromptManually()
        setOpen(false)
      }}
    >
      <h3 className="text-lg font-semibold text-white">Instala la app en tu móvil</h3>
      <p className="mt-2 text-sm text-white/80">
        Acceso directo a tus clases, reservas y pagos sin abrir el navegador.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-white/90">
        <li className="flex gap-2">
          <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">✓</span>
          <span>Funciona sin conexión (tus clases de la semana).</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">✓</span>
          <span>Notificaciones cuando haya hueco en la lista de espera.</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 rounded-full bg-white/15 px-2 text-xs font-bold">✓</span>
          <span>Icono en tu pantalla principal — un toque y dentro.</span>
        </li>
      </ul>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={async () => {
            await state.prompt()
            setOpen(false)
          }}
          className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm hover:bg-white/90"
        >
          Instalar ahora
        </button>
        <button
          type="button"
          onClick={() => {
            dismissInstallPromptManually()
            setOpen(false)
          }}
          className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Más tarde
        </button>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Instalar aplicación"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onDismiss}
      />
      <div className="relative w-full max-w-md rounded-3xl bg-brand p-6 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
