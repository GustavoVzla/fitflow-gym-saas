/**
 * Sanitiza errores server-side para evitar info disclosure al cliente.
 *
 * Patrón OWASP API Security Top 10 — nunca filtrar `error.message` raw de Supabase
 * ni de librerías de terceros al UI en producción. En dev sí se ve para debug.
 *
 * Cuando Sentry esté operativo (audit deferred), el `console.error` se reemplaza
 * por `Sentry.captureException(err)` para tener el stack trace original.
 */
export function sanitizeServerError(
  err: unknown,
  fallback = 'Error inesperado. Inténtalo de nuevo.'
): string {
  // Log server-side (Vercel Runtime Logs lo recoge mientras Sentry esté pendiente)
  if (err instanceof Error) {
    console.error('[server-error]', err.message)
  } else {
    console.error('[server-error]', err)
  }

  if (process.env.NODE_ENV === 'development' && err instanceof Error) {
    return err.message
  }

  return fallback
}
