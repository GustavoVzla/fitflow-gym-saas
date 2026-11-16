// Tipos puros instructores tenant (sin server-only).

export type NotifDelivery = 'none' | 'email' | 'push' | 'both'

export interface NotificationCategory {
  key: string
  label: string
  description?: string
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { key: 'new_client', label: 'Nuevos clientes', description: 'Cuando un nuevo socio se da de alta en el gym.' },
  { key: 'client_dropoff', label: 'Bajas de cliente', description: 'Cuando un socio se da de baja.' },
  { key: 'new_payment', label: 'Nuevo pago', description: 'Cualquier pago registrado en el sistema.' },
  { key: 'online_payment', label: 'Pagos online', description: 'Pagos completados vía Stripe (tarjeta o SEPA).' },
  { key: 'auto_newsletter', label: 'Boletín automático', description: 'Resumen periódico de actividad del gym.' },
]

export const DELIVERY_OPTIONS: { value: NotifDelivery; label: string; short: string }[] = [
  { value: 'none', label: 'No enviar', short: 'No' },
  { value: 'email', label: 'Email', short: 'Email' },
  { value: 'push', label: 'Push', short: 'Push' },
  { value: 'both', label: 'Email + Push', short: 'Ambos' },
]


export interface InstructorListRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  hasAuthAccount: boolean
}

export interface InstructorDetail {
  id: string
  gymId: string
  name: string
  email: string | null
  phone: string | null
  bio: string | null
  specialties: string[]
  color: string
  isActive: boolean
  hasAuthAccount: boolean
  createdAt: string
}

// Matriz de 20 permisos (paridad LegacyGym F1 sección C).
export interface PermissionDefinition {
  key: string
  label: string
  description?: string
  // levels: 0..N-1, label visible
  levels: { value: number; label: string }[]
}

export const PERMISSION_MATRIX: PermissionDefinition[] = [
  {
    key: 'manage_payments',
    label: 'Gestión de pagos',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Pendientes y finalizados' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_shop',
    label: 'Gestión de tienda',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Venta de productos' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_clients',
    label: 'Gestión de clientes',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Solo alta' },
      { value: 2, label: 'Consulta App' },
      { value: 3, label: 'Acceso total' },
    ],
  },
  {
    key: 'view_client_contacts',
    label: 'Información de contactos de los clientes',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_loyalty',
    label: 'Fidelización de clientes',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_instructors',
    label: 'Gestión de instructores',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'view_reports',
    label: 'Acceso a informes',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso parcial' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_classes_tariffs',
    label: 'Gestión de clases y tarifas',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_tasks',
    label: 'Gestión de tareas',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Sólo tareas propias' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_bookings',
    label: 'Gestión de reservas',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Clases de las que es instructor' },
      { value: 2, label: 'Horarios asignados' },
      { value: 3, label: 'Todas las clases' },
    ],
  },
  {
    key: 'manage_appointments',
    label: 'Gestión de citas',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Citas propias' },
      { value: 2, label: 'Todas las citas' },
    ],
  },
  {
    key: 'gift_bookings',
    label: 'Permitir regalar reservas',
    levels: [
      { value: 0, label: 'No' },
      { value: 1, label: 'Solo dejar en deuda' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'cancel_bookings',
    label: 'Cancelación de reservas',
    levels: [
      { value: 0, label: 'No' },
      { value: 1, label: 'En clases con permisos' },
    ],
  },
  {
    key: 'create_bookings',
    label: 'Permitir hacer reservas',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'En clases con permisos' },
    ],
  },
  {
    key: 'manage_publications',
    label: 'Publicaciones y programación de entrenos',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_wod_tv',
    label: 'Gestión de WOD TV',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_messages',
    label: 'Gestión de mensajes',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_offers',
    label: 'Gestión de ofertas y promociones',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Acceso total' },
    ],
  },
  {
    key: 'manage_competitions',
    label: 'Gestión de competiciones',
    levels: [
      { value: 0, label: 'Sin acceso' },
      { value: 1, label: 'Solo validación de videos' },
      { value: 2, label: 'Acceso total' },
    ],
  },
  {
    key: 'clock_in',
    label: 'Fichar desde App',
    levels: [
      { value: 0, label: 'Desactivado' },
      { value: 1, label: 'Fichar desde webapp' },
      { value: 2, label: 'Fichar desde app con geolocalización' },
    ],
  },
]
