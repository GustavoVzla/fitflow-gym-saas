/**
 * sanitizeServerError — devuelve un mensaje seguro para enviar al cliente
 * sin leakar detalles internos de la DB (schema names, constraints, PG error codes).
 *
 * Patrón copiado de apps/member-app/src/lib/errors.ts (Web/App equivalente).
 * Cumplimiento regla SECURITY sprint paridad100: toda action del dashboard
 * debe pasar errores por aquí antes de retornar al cliente.
 */

type PostgrestLike = {
  message?: string
  code?: string
  details?: string
  hint?: string
} | null
  | undefined
  | Error
  | unknown

export function sanitizeServerError(
  err: PostgrestLike,
  fallback = 'Ha ocurrido un error. Inténtalo de nuevo.'
): string {
  if (!err) return fallback

  // PostgrestError típico {message, code, details, hint}
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string; code?: string }
    const code = typeof e.code === 'string' ? e.code : ''

    // Mapping de códigos frecuentes a mensajes user-friendly
    if (code === '23505') return 'Ya existe un registro con esos datos únicos.'
    if (code === '23503') return 'Referencia inválida: el registro relacionado no existe.'
    if (code === '23514') return 'Los datos no cumplen las restricciones requeridas.'
    if (code === '42501') return 'No tienes permisos para realizar esta acción.'
    if (code === 'P0001') {
      // RAISE EXCEPTION explícito del developer → mensaje del server es OK exponer
      return typeof e.message === 'string' && e.message.length < 200
        ? e.message
        : fallback
    }

    // Mensaje genérico si no tiene code pero tiene message corto
    const msg = typeof e.message === 'string' ? e.message : ''
    if (msg && msg.length < 120 && !/schema|relation|column|constraint/i.test(msg)) {
      return msg
    }
  }

  if (err instanceof Error) {
    return err.message.length < 120 ? err.message : fallback
  }

  return fallback
}
