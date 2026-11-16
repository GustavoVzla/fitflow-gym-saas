export interface ClauseRow {
  id: string
  code: string
  title: string
  body: string
  isRequired: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * 3 plantillas preset sembradas en `seedDefaultClausesAction` cuando
 * owner/admin hace click "Sembrar 3 plantillas demo".
 * Basadas en modelos AEPD comunes para centros deportivos ES.
 */
export const CLAUSE_PRESETS: Array<{
  code: string
  title: string
  body: string
  is_required: boolean
}> = [
  {
    code: 'RGPD_BASICA',
    title: 'Consentimiento RGPD básico',
    is_required: true,
    body: `PROTECCIÓN DE DATOS PERSONALES

Al firmar el presente documento, declaro haber sido informado/a por [NOMBRE DEL CENTRO] de que mis datos personales serán incorporados a un fichero del que es responsable el propio centro, con la finalidad de gestionar mi alta como socio/a, facturación, reservas de clases y envío de comunicaciones relacionadas con el servicio.

Base legal: ejecución del contrato de prestación de servicios deportivos (Art. 6.1.b RGPD) y consentimiento explícito (Art. 6.1.a RGPD) para comunicaciones comerciales.

Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [EMAIL DEL CENTRO] acreditando mi identidad.

Reclamación ante Autoridad de Control: Agencia Española de Protección de Datos (www.aepd.es).

☐ He leído y acepto la política de privacidad del centro.`,
  },
  {
    code: 'RC_ENTRENAMIENTO',
    title: 'Renuncia responsabilidad entrenamiento',
    is_required: true,
    body: `RENUNCIA DE RESPONSABILIDAD — ACTIVIDAD FÍSICA

Declaro bajo mi responsabilidad que:

1. Me encuentro en adecuado estado de salud para realizar la actividad física del centro, y he consultado con un profesional médico si procede según mi historial.

2. Comunicaré al centro cualquier lesión, patología cardiaca, respiratoria, articular o embarazo que pueda afectar al desarrollo de la actividad.

3. Seguiré en todo momento las indicaciones del personal técnico, usando el material correctamente y respetando los límites de mi condición física.

4. Eximo al centro y a su personal técnico de cualquier responsabilidad derivada de daños, lesiones o accidentes sufridos durante la realización de la actividad, salvo en casos de negligencia manifiesta del propio centro.

5. En caso de urgencia médica, autorizo al personal del centro a llamar a los servicios médicos oportunos.

Firma del socio: _____________________________   Fecha: ____/____/________`,
  },
  {
    code: 'IMAGEN_VIDEO',
    title: 'Consentimiento imagen y vídeo',
    is_required: false,
    body: `AUTORIZACIÓN DE USO DE IMAGEN Y VÍDEO

Con la firma del presente, autorizo a [NOMBRE DEL CENTRO] a:

☐ Captar imágenes/vídeos durante las actividades del centro.
☐ Publicar las imágenes/vídeos en redes sociales del centro (Instagram, Facebook, TikTok) con finalidad promocional.
☐ Usar las imágenes/vídeos en web, folletos y material publicitario.

Esta autorización se otorga con carácter gratuito y por tiempo indefinido, siendo revocable en cualquier momento mediante comunicación escrita al centro.

El centro se compromete a retirar cualquier imagen/vídeo a requerimiento del socio dentro de un plazo razonable.

SI NO firmas esta autorización, el centro evitará publicar cualquier imagen donde aparezcas identificable. Tu decisión no afecta al uso del servicio deportivo.

Firma del socio: _____________________________   Fecha: ____/____/________`,
  },
]
