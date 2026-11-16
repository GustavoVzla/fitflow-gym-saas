// Tipos compartidos server/client para el módulo Avisos automáticos.
// Estos valores deben coincidir con los CHECK constraints de la migración 0048.

export type TriggerType =
  | 'welcome'
  | 'payment_due'
  | 'payment_overdue'
  | 'birthday'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'membership_expiring'
  | 'no_attendance'

export type Channel = 'email' | 'sms' | 'whatsapp' | 'in_app'

export interface AvisoTemplate {
  id: string
  name: string
  triggerType: TriggerType
  triggerValue: number | null
  channel: Channel
  subject: string | null
  messageTemplate: string
  sendOffsetMinutes: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DispatchQueueRow {
  id: string
  templateId: string | null
  templateName: string | null
  memberId: string
  memberName: string
  channel: Channel
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'cancelled'
  scheduledFor: string
  sentAt: string | null
  errorMessage: string | null
}

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  welcome: 'Bienvenida nuevo socio',
  payment_due: 'Pago próximo a vencer',
  payment_overdue: 'Pago vencido',
  birthday: 'Cumpleaños',
  booking_reminder: 'Recordatorio de clase',
  booking_cancelled: 'Reserva cancelada',
  membership_expiring: 'Tarifa por vencer',
  no_attendance: 'Sin asistencia X días',
}

export const TRIGGER_DESCRIPTION: Record<TriggerType, string> = {
  welcome: 'Se envía al dar de alta un nuevo socio.',
  payment_due: 'Se envía cuando un pago está próximo a vencer.',
  payment_overdue: 'Se envía cuando un pago queda vencido.',
  birthday: 'Se envía el día del cumpleaños del socio.',
  booking_reminder: 'Se envía minutos antes del inicio de una clase reservada.',
  booking_cancelled: 'Se envía al socio cuando su reserva se cancela.',
  membership_expiring: 'Se envía X días antes de que venza la tarifa.',
  no_attendance: 'Se envía si un socio no reserva/asiste durante X días.',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  in_app: 'Mensaje in-app',
}

// Plantillas recomendadas — se crean con 1 click en la UI.
// Copy en español adaptado a Demo Studio (paridad LegacyGym + mejoras).
export const RECOMMENDED_TEMPLATES: Array<{
  name: string
  triggerType: TriggerType
  triggerValue: number | null
  channel: Channel
  subject: string | null
  messageTemplate: string
  sendOffsetMinutes: number
}> = [
  {
    name: 'Bienvenida nuevo socio',
    triggerType: 'welcome',
    triggerValue: null,
    channel: 'in_app',
    subject: '¡Bienvenido/a a Demo Studio!',
    messageTemplate:
      '¡Hola {nombre}! Bienvenido/a a Demo Studio. Tu tarifa {nombre_tarifa} ya está activa. Si tienes cualquier duda, aquí estamos para ayudarte.',
    sendOffsetMinutes: 0,
  },
  {
    name: 'Recordatorio 1h antes de clase',
    triggerType: 'booking_reminder',
    triggerValue: null,
    channel: 'in_app',
    subject: 'Tu clase empieza pronto',
    messageTemplate:
      'Hola {nombre}, recuerda que tu clase empieza en breve. ¡Nos vemos en Demo Studio!',
    sendOffsetMinutes: -60,
  },
  {
    name: 'Pago vencido — aviso amable',
    triggerType: 'payment_overdue',
    triggerValue: null,
    channel: 'in_app',
    subject: 'Recordatorio de pago pendiente',
    messageTemplate:
      'Hola {nombre}, vemos que tu pago de {nombre_tarifa} (vto. {fecha_vencimiento}) aún está pendiente. Pásate por recepción o responde aquí si necesitas ayuda.',
    sendOffsetMinutes: 0,
  },
  {
    name: 'Feliz cumpleaños',
    triggerType: 'birthday',
    triggerValue: null,
    channel: 'in_app',
    subject: '¡Felicidades, {nombre}!',
    messageTemplate:
      '¡Feliz cumpleaños, {nombre}! 🎉 Todo el equipo de Demo Studio te desea un día genial.',
    sendOffsetMinutes: 0,
  },
  {
    name: 'Tarifa vence en 7 días',
    triggerType: 'membership_expiring',
    triggerValue: 7,
    channel: 'in_app',
    subject: 'Tu tarifa vence pronto',
    messageTemplate:
      'Hola {nombre}, tu tarifa {nombre_tarifa} vence el {fecha_vencimiento}. Renueva cuando quieras desde recepción o respondiendo aquí.',
    sendOffsetMinutes: 0,
  },
  {
    name: 'No viene hace 14 días',
    triggerType: 'no_attendance',
    triggerValue: 14,
    channel: 'in_app',
    subject: 'Te echamos de menos',
    messageTemplate:
      '¡Hola {nombre}! Llevas 2 semanas sin aparecer por el gym. ¿Todo bien? Si necesitas ajustar tu plan o reagendar, aquí estamos.',
    sendOffsetMinutes: 0,
  },
]

export const STATUS_STYLES: Record<DispatchQueueRow['status'], { label: string; classes: string }> = {
  pending: { label: 'Pendiente', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  sent: { label: 'Enviado', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Fallido', classes: 'bg-red-50 text-red-700 ring-red-200' },
  skipped: { label: 'Omitido', classes: 'bg-slate-50 text-slate-500 ring-slate-200' },
  cancelled: { label: 'Cancelado', classes: 'bg-slate-50 text-slate-500 ring-slate-200' },
}
