import type { MemberField } from './actions'

/**
 * Diccionario heurístico LegacyGym → member field FitFlow.
 * Keys normalizados (lowercase + trim + strip-accents).
 * Cubre sinónimos ES + EN para exports bilingües.
 */
const LEGACY_COLUMN_MAP: Record<string, MemberField> = {
  // ---- first_name ----
  'nombre': 'first_name',
  'nombres': 'first_name',
  'first name': 'first_name',
  'firstname': 'first_name',
  'given name': 'first_name',

  // ---- last_name ----
  'apellido': 'last_name',
  'apellidos': 'last_name',
  'primer apellido': 'last_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'surname': 'last_name',
  'family name': 'last_name',

  // full_name (nombre + apellidos juntos → auto-split en first_name + last_name)
  'cliente': 'full_name',
  'socio': 'full_name',
  'miembro': 'full_name',
  'nombre completo': 'full_name',
  'full name': 'full_name',
  'fullname': 'full_name',
  'name': 'full_name', // ambiguo pero frecuente en exports bilingües

  // ---- email ----
  'email': 'email',
  'correo': 'email',
  'correo electronico': 'email',
  'correo electronico principal': 'email',
  'e-mail': 'email',
  'mail': 'email',

  // ---- phone ----
  'telefono': 'phone',
  'telefono movil': 'phone',
  'movil': 'phone',
  'celular': 'phone',
  'telefono fijo': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'mobile phone': 'phone',
  'cellphone': 'phone',
  'tlf': 'phone',

  // ---- birth_date ----
  'fecha nacimiento': 'birth_date',
  'fecha de nacimiento': 'birth_date',
  'nacimiento': 'birth_date',
  'birth date': 'birth_date',
  'birthdate': 'birth_date',
  'date of birth': 'birth_date',
  'dob': 'birth_date',
  'cumpleanos': 'birth_date',
  'cumpleaños': 'birth_date',

  // ---- tax_id ----
  'dni': 'tax_id',
  'nie': 'tax_id',
  'nif': 'tax_id',
  'dni/nie': 'tax_id',
  'dni/nif': 'tax_id',
  'documento': 'tax_id',
  'documento identidad': 'tax_id',
  'tax id': 'tax_id',
  'tax-id': 'tax_id',
  'passport': 'tax_id',

  // ---- address ----
  'direccion': 'address',
  'domicilio': 'address',
  'calle': 'address',
  'address': 'address',
  'street': 'address',
  'street address': 'address',

  // ---- city ----
  'ciudad': 'city',
  'localidad': 'city',
  'poblacion': 'city',
  'city': 'city',
  'town': 'city',

  // ---- postal_code ----
  'codigo postal': 'postal_code',
  'cp': 'postal_code',
  'postal code': 'postal_code',
  'postal-code': 'postal_code',
  'postcode': 'postal_code',
  'zip': 'postal_code',
  'zip code': 'postal_code',

  // ---- member_number ----
  'numero socio': 'member_number',
  'numero de socio': 'member_number',
  'num socio': 'member_number',
  'id socio': 'member_number',
  'id cliente': 'member_number',
  'member number': 'member_number',
  'member id': 'member_number',
  'member-id': 'member_number',
  'customer id': 'member_number',

  // ---- status ----
  'estado': 'status',
  'estado cliente': 'status',
  'estado socio': 'status',
  'status': 'status',
  'activo': 'status',
  'active': 'status',

  // ---- join_date ----
  'fecha alta': 'join_date',
  'fecha de alta': 'join_date',
  'alta': 'join_date',
  'fecha inscripcion': 'join_date',
  'join date': 'join_date',
  'joindate': 'join_date',
  'signup date': 'join_date',
  'registration date': 'join_date',
  'created': 'join_date',
  'created at': 'join_date',

  // ---- notes ----
  'notas': 'notes',
  'observaciones': 'notes',
  'comentarios': 'notes',
  'notes': 'notes',
  'comments': 'notes',
  'remarks': 'notes',

  // ---- RGPD consents ----
  'consentimiento rgpd': 'rgpd_consent',
  'rgpd': 'rgpd_consent',
  'gdpr': 'rgpd_consent',
  'gdpr consent': 'rgpd_consent',
  'consentimiento marketing': 'marketing_consent',
  'marketing': 'marketing_consent',
  'marketing consent': 'marketing_consent',
  'consentimiento imagen': 'image_consent',
  'imagen': 'image_consent',
  'image consent': 'image_consent',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Devuelve el mapping sugerido para una columna CSV.
 * Returns 'ignore' si no hay match heurístico (el super-admin elige manualmente).
 */
export function suggestMapping(csvColumnName: string): MemberField {
  const key = normalize(csvColumnName)
  return LEGACY_COLUMN_MAP[key] ?? 'ignore'
}

/**
 * Genera mapping inicial auto-detectando todas las columnas del CSV.
 */
export function autoDetectMapping(csvColumns: string[]): Record<string, MemberField> {
  const mapping: Record<string, MemberField> = {}
  for (const col of csvColumns) {
    mapping[col] = suggestMapping(col)
  }
  return mapping
}

export const MEMBER_FIELD_OPTIONS: { value: MemberField; label: string; required?: boolean }[] = [
  { value: 'ignore', label: '— Ignorar —' },
  { value: 'full_name', label: 'Nombre completo (se divide auto)' },
  { value: 'first_name', label: 'Nombre', required: true },
  { value: 'last_name', label: 'Apellidos', required: true },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'birth_date', label: 'Fecha nacimiento' },
  { value: 'tax_id', label: 'DNI/NIE/NIF' },
  { value: 'address', label: 'Dirección' },
  { value: 'city', label: 'Ciudad' },
  { value: 'postal_code', label: 'Código postal' },
  { value: 'member_number', label: 'Nº de socio' },
  { value: 'status', label: 'Estado' },
  { value: 'join_date', label: 'Fecha de alta' },
  { value: 'notes', label: 'Notas' },
  { value: 'rgpd_consent', label: 'Consentimiento RGPD' },
  { value: 'marketing_consent', label: 'Consentimiento marketing' },
  { value: 'image_consent', label: 'Consentimiento imagen' },
]

export const REQUIRED_FIELDS: MemberField[] = ['first_name', 'last_name']

/**
 * Check si los required están satisfechos. Soporta `full_name` como
 * alternativa que satisface first_name Y last_name a la vez.
 */
export function checkRequiredSatisfied(mapping: Record<string, MemberField>): MemberField[] {
  const assigned = new Set<MemberField>(Object.values(mapping))
  if (assigned.has('full_name')) return [] // full_name cubre first+last
  return REQUIRED_FIELDS.filter((f) => !assigned.has(f))
}
