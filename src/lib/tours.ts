import type { DriveStep } from 'driver.js'

/**
 * Contextual tour scripts per section. Phase 4 MVP priority: 3 sections most
 * used during onboarding + 1 central for day-to-day ops. Other sections keep
 * no tour for now (backlog).
 *
 * Target selectors use `data-tour="..."` attributes (less invasive than id,
 * won't collide with existing CSS/a11y, trivial to grep if needed).
 *
 * IMPORTANT: when adding/removing steps, bump the version suffix in the tour
 * key passed to <FeatureTour tourKey="..." /> so users see the updated flow.
 */

export const SOCIOS_TOUR: DriveStep[] = [
  {
    element: '[data-tour="socios-header"]',
    popover: {
      title: '👥 Gestión de socios',
      description:
        'Desde aquí administras a todos tus socios: altas, bajas, tarifas asignadas y contacto. Es tu base de datos de clientes.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="socios-new-btn"]',
    popover: {
      title: '➕ Añadir un socio',
      description:
        'Crea un socio nuevo: nombre, email, teléfono y la tarifa que contrata. Podrás editarlo después en cualquier momento.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '[data-tour="socios-search"]',
    popover: {
      title: '🔍 Buscar y filtrar',
      description:
        'Busca por nombre, email o DNI. Los filtros te permiten ver solo activos, dados de baja, o por tarifa contratada.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="socios-export"]',
    popover: {
      title: '📥 Exportar CSV',
      description:
        'Descarga la lista completa en CSV para abrirla en Excel. Útil para contabilidad, marketing o migrar a otra plataforma.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: '✨ Siguiente paso',
      description:
        'Cuando tengas socios creados, asígnales una tarifa en la sección Clases y Tarifas para que puedan reservar clases.',
    },
  },
]

export const CLASES_TARIFAS_TOUR: DriveStep[] = [
  {
    element: '[data-tour="ct-header"]',
    popover: {
      title: '🏋️ Clases e instructores',
      description:
        'Gestiona el catálogo de clases que impartes (CrossFit, Yoga, Funcional...), los instructores que las dan y las tarifas que vendes.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="ct-tabs"]',
    popover: {
      title: '📑 Pestañas',
      description:
        'Cambia entre Clases, Tarifas, Grupos e Instructores. Cada pestaña configura un bloque distinto de tu operación.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: '➕ Crear contenido',
      description:
        'En cada pestaña verás un botón "Nueva..." que crea el elemento correspondiente: nueva clase, nueva tarifa o nuevo instructor. El formulario te pedirá los datos mínimos y podrás editar después.',
    },
  },
  {
    popover: {
      title: '✨ Orden recomendado',
      description:
        '1) Crea instructores primero. 2) Luego clases (con instructor asignado). 3) Después tarifas (mensualidades, bonos). 4) Finalmente el horario semanal en la sección Horario.',
    },
  },
]

export const HORARIO_TOUR: DriveStep[] = [
  {
    element: '[data-tour="horario-header"]',
    popover: {
      title: '📅 Horario semanal',
      description:
        'Vista calendario de todas las clases programadas esta semana. Cada bloque es una instancia real (fecha + hora + instructor) creada desde tus plantillas.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="horario-nav"]',
    popover: {
      title: '⬅️➡️ Navegación semanal',
      description:
        'Cambia de semana para ver clases pasadas o futuras. El botón "Volver a hoy" te devuelve a la semana actual con un click.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="horario-filters"]',
    popover: {
      title: '🔍 Filtrar por tipo / instructor',
      description:
        'Útil cuando tienes muchas clases: filtra solo las de CrossFit, solo las de un instructor, o solo clases premium.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: '✨ ¿No ves clases?',
      description:
        'Si la rejilla está vacía, ve a Clases y Tarifas, crea las plantillas (horarios semanales) y luego pulsa "Generar instancias" para crear las fechas concretas.',
    },
  },
]

export const RESERVAS_TOUR: DriveStep[] = [
  {
    element: '[data-tour="reservas-header"]',
    popover: {
      title: '📆 Reservas del día',
      description:
        'Aquí ves todas las clases programadas para el día seleccionado, con instructor, plazas reservadas y cupo. Es tu vista operativa diaria.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="reservas-filters"]',
    popover: {
      title: '🔍 Filtrar por clase o instructor',
      description:
        'Si tienes muchas clases a la vez, filtra por nombre de clase o por instructor para centrar la vista en lo que te interesa.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="reservas-days"]',
    popover: {
      title: '🗓️ Navegación por días',
      description:
        'Cambia rápidamente entre días de la semana. El día seleccionado se resalta en azul. Los puntos indican cuántas clases hay ese día.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: '✨ Gestión de asistencia',
      description:
        'Dentro de cada clase puedes marcar asistencia, añadir o quitar socios manualmente, y ver quién ya ha confirmado. Útil para recepción en tiempo real.',
    },
  },
]

export const PAGOS_TOUR: DriveStep[] = [
  {
    element: '[data-tour="pagos-header"]',
    popover: {
      title: '💳 Gestión de cobros',
      description:
        'Administra todos los pagos: manuales (cash, tarjeta, transferencia), SEPA programados, y cobros Stripe cuando está conectado. Los pagos completados son inmutables (snapshot histórico para contabilidad).',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="pagos-new-btn"]',
    popover: {
      title: '➕ Nuevo pago manual',
      description:
        'Registra un cobro que hiciste fuera del sistema (ej. cash en recepción, Bizum, transferencia manual). Asigna al socio + concepto + cantidad.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '[data-tour="pagos-export"]',
    popover: {
      title: '📥 Exportar CSV',
      description:
        'Descarga el listado filtrado en CSV para contabilidad mensual o para compartir con tu gestoría.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="pagos-kpis"]',
    popover: {
      title: '📊 KPIs del mes',
      description:
        'Pendientes, cobrado este mes y SEPA programados. Vista rápida del estado de caja sin tener que calcularlo a mano.',
      side: 'top',
    },
  },
  {
    popover: {
      title: '✨ Stripe + SEPA',
      description:
        'Si tu gym tiene Stripe conectado (modo direct_keys), puedes generar link de cobro con 1 click para cada pago pendiente — el socio paga desde el link compartido por WhatsApp/email.',
    },
  },
]

export const CONFIGURACION_TOUR: DriveStep[] = [
  {
    element: '[data-tour="config-header"]',
    popover: {
      title: '⚙️ Configuración del gym',
      description:
        'Panel central donde configuras todo: datos del gym, preferencias de reservas, pagos (Stripe), y notificaciones. Cada pestaña es un bloque distinto.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="config-tabs"]',
    popover: {
      title: '📑 Pestañas',
      description:
        'Perfil (datos fiscales y contacto), Reservas (anticipación, cancelación), Pagos (Stripe keys, modo de cobro), Notificaciones (plantillas email/SMS — próximamente).',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: '✨ Empezar por perfil',
      description:
        'Lo primero que hay que hacer es completar el tab Perfil: CIF, dirección y teléfono del gym. Son datos que aparecen en facturas y emails a los socios.',
    },
  },
]
