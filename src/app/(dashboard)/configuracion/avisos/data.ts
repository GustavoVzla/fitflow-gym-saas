import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { AvisoTemplate, DispatchQueueRow, TriggerType, Channel } from './types'

export const getAvisoTemplates = cache(async (): Promise<AvisoTemplate[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_alerts')
    .select(
      'id, name, trigger_type, trigger_value, channel, subject, message_template, send_offset_minutes, is_active, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAvisoTemplates] error:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    triggerType: row.trigger_type as TriggerType,
    triggerValue: row.trigger_value,
    channel: row.channel as Channel,
    subject: row.subject,
    messageTemplate: row.message_template,
    sendOffsetMinutes: row.send_offset_minutes ?? 0,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
})

export const getRecentDispatches = cache(async (hours = 24): Promise<DispatchQueueRow[]> => {
  const supabase = await createClient()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('avisos_dispatch_queue')
    .select(
      `
      id, template_id, member_id, status, scheduled_for, sent_at, error_message,
      template:template_id ( name, channel ),
      member:member_id ( first_name, last_name )
      `,
    )
    .gte('scheduled_for', since)
    .order('scheduled_for', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[getRecentDispatches] error:', error)
    return []
  }

  return (data ?? []).map((row): DispatchQueueRow => {
    const template = Array.isArray(row.template) ? row.template[0] : row.template
    const member = Array.isArray(row.member) ? row.member[0] : row.member
    const memberName = member
      ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      : 'Socio eliminado'
    return {
      id: row.id,
      templateId: row.template_id,
      templateName: template?.name ?? null,
      memberId: row.member_id,
      memberName,
      channel: (template?.channel as Channel) ?? 'in_app',
      status: row.status as DispatchQueueRow['status'],
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      errorMessage: row.error_message,
    }
  })
})
