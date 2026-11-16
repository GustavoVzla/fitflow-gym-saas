import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { FormFieldRow, FormFieldType, FormScope } from './types'

export type { FormFieldRow, FormFieldType, FormScope } from './types'

export const getFormFields = cache(async (): Promise<FormFieldRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gym_form_fields')
    .select(
      'id, form_scope, field_name, field_label, field_type, options, placeholder, help_text, is_required, is_active, sort_order, created_at'
    )
    .order('form_scope', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getFormFields] error:', error)
    return []
  }

  return (data ?? []).map((f): FormFieldRow => ({
    id: f.id,
    formScope: f.form_scope as FormScope,
    fieldName: f.field_name,
    fieldLabel: f.field_label,
    fieldType: f.field_type as FormFieldType,
    options: Array.isArray(f.options) ? (f.options as string[]) : [],
    placeholder: f.placeholder,
    helpText: f.help_text,
    isRequired: f.is_required,
    isActive: f.is_active,
    sortOrder: f.sort_order ?? 0,
    createdAt: f.created_at,
  }))
})
