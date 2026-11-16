'use client'

/**
 * Placeholder "Preferencias de cookies" — llama CookieYes API runtime.
 * Si CookieYes no está cargado (dev local, bloqueador), el botón oculta.
 * Migración a orestbida/cookieconsent pendiente post-cobro Demo Studio (junio 2026).
 */
export function CookiePreferencesButton() {
  function handleClick() {
    const w = window as unknown as {
      CookieYes?: { revisitConsent?: () => void }
    }
    w.CookieYes?.revisitConsent?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hover:text-slate-900 hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit"
    >
      Preferencias de cookies
    </button>
  )
}
