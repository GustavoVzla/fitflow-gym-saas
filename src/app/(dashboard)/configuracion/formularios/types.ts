export type FormFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date'
export type FormScope = 'member_signup' | 'prospect_signup'

export interface FormFieldRow {
  id: string
  formScope: FormScope
  fieldName: string
  fieldLabel: string
  fieldType: FormFieldType
  options: string[]
  placeholder: string | null
  helpText: string | null
  isRequired: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export const FIELD_TYPE_LABEL: Record<FormFieldType, string> = {
  text: 'Texto corto',
  number: 'Número',
  select: 'Desplegable (opciones)',
  checkbox: 'Sí / No',
  textarea: 'Texto largo',
  date: 'Fecha',
}

export const SCOPE_LABEL: Record<FormScope, string> = {
  member_signup: 'Alta de socio',
  prospect_signup: 'Alta de potencial',
}
