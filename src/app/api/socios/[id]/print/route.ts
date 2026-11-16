import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function row(label: string, value: string | null | undefined): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || '—')}</td></tr>`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: member, error } = await supabase
    .from('members')
    .select(
      `id, gym_id, first_name, last_name, second_last_name, email, phone,
       birth_date, gender, tax_id, address, city, postal_code,
       join_date, status, notes, internal_notes, medical_notes,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
       tariffs:current_tariff_id (name, price),
       gyms:gym_id (name, address, phone, tax_id)`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !member) {
    return NextResponse.json(
      { error: 'Socio no encontrado o sin permiso' },
      { status: 404 }
    )
  }

  const tariff = Array.isArray(member.tariffs) ? member.tariffs[0] : member.tariffs
  const gym = Array.isArray(member.gyms) ? member.gyms[0] : member.gyms

  const fullName = [member.first_name, member.last_name, member.second_last_name]
    .filter(Boolean)
    .join(' ')

  const generatedAt = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Ficha — ${escapeHtml(fullName)}</title>
<style>
  @page { margin: 18mm 16mm; size: A4; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 2px solid #3b8bea; margin-bottom: 18px; }
  .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
  .header .gym { text-align: right; font-size: 11px; color: #64748b; }
  .header .gym strong { color: #0f172a; font-size: 13px; }
  h2 { font-size: 14px; color: #3b8bea; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { text-align: left; padding: 4px 8px; vertical-align: top; }
  th { width: 30%; font-weight: 600; color: #475569; background: #f8fafc; }
  td { color: #0f172a; border-bottom: 1px solid #f1f5f9; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .badge-active { background: #d1fae5; color: #047857; }
  .badge-pending { background: #fef3c7; color: #b45309; }
  .badge-inactive { background: #f1f5f9; color: #475569; }
  .badge-blocked { background: #fee2e2; color: #b91c1c; }
  .footer { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  .notes { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 8px 12px; margin: 6px 0; font-size: 12px; color: #78350f; white-space: pre-wrap; }
  .print-button { background: #3b8bea; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 12px; text-align: right;">
    <button class="print-button" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>${escapeHtml(fullName)}</h1>
      <p style="margin: 4px 0 0; color: #64748b; font-size: 11px;">Ficha del socio · Generada ${escapeHtml(generatedAt)}</p>
    </div>
    <div class="gym">
      <strong>${escapeHtml(gym?.name ?? '')}</strong><br>
      ${escapeHtml(gym?.address ?? '')}<br>
      ${escapeHtml(gym?.tax_id ?? '')} ${gym?.phone ? '· ' + escapeHtml(gym.phone) : ''}
    </div>
  </div>

  <h2>Datos personales</h2>
  <div class="grid-2">
    <table>
      ${row('Nombre completo', fullName)}
      ${row('DNI / NIE', member.tax_id)}
      ${row('Fecha nacimiento', fmtDate(member.birth_date))}
      ${row('Género', member.gender === 'male' ? 'Hombre' : member.gender === 'female' ? 'Mujer' : member.gender === 'other' ? 'Otro' : '—')}
    </table>
    <table>
      ${row('Email', member.email)}
      ${row('Teléfono', member.phone)}
      ${row('Fecha de alta', fmtDate(member.join_date))}
      <tr><th>Estado</th><td><span class="badge badge-${escapeHtml(member.status)}">${escapeHtml(member.status)}</span></td></tr>
    </table>
  </div>

  <h2>Dirección</h2>
  <table>
    ${row('Dirección', member.address)}
    ${row('Ciudad', member.city)}
    ${row('Código postal', member.postal_code)}
  </table>

  <h2>Contacto de emergencia</h2>
  <table>
    ${row('Nombre', member.emergency_contact_name)}
    ${row('Teléfono', member.emergency_contact_phone)}
    ${row('Relación', member.emergency_contact_relation)}
  </table>

  <h2>Tarifa</h2>
  <table>
    ${row('Tarifa actual', tariff?.name)}
    ${row('Precio', tariff?.price != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(tariff.price)) : '—')}
  </table>

  ${member.medical_notes ? `<h2>Notas médicas</h2><div class="notes">${escapeHtml(member.medical_notes)}</div>` : ''}
  ${member.notes ? `<h2>Notas</h2><div style="padding: 6px 0; white-space: pre-wrap;">${escapeHtml(member.notes)}</div>` : ''}
  ${member.internal_notes ? `<h2>Notas internas (staff)</h2><div style="padding: 6px 0; white-space: pre-wrap; color: #64748b; font-style: italic;">${escapeHtml(member.internal_notes)}</div>` : ''}

  <div class="footer">
    Documento generado por FitFlow · ${escapeHtml(gym?.name ?? '')} · ${escapeHtml(generatedAt)}<br>
    Datos personales protegidos según el Reglamento (UE) 2016/679 (RGPD).
  </div>

  <script>
    // Auto-trigger print dialog 300ms after load
    setTimeout(function () { window.print(); }, 300);
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
