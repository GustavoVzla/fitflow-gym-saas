# MFA Super-Admin — Setup & Recovery

**Estado:** activo desde sesión 8 (2026-04-22, migración `0020_rls_app_admins_require_aal2.sql`).
**Scope:** solo super-admins (tabla `app_admins`). Tenants + members NO están afectados.

## Cómo funciona

1. Super-admin hace login normal con email + password (`supabase.auth.signInWithPassword`).
2. Middleware detecta `is_app_admin(user.id) = true`.
3. Consulta `supabase.auth.mfa.listFactors()`:
   - Si **no hay factor TOTP verificado** → redirect a `/admin/mfa/enroll`.
   - Si lo hay pero `currentLevel !== 'aal2'` → redirect a `/admin/mfa/challenge?next=<ruta>`.
   - Si `currentLevel === 'aal2'` → pasa a `/admin` (o ruta solicitada).
4. RLS en `public.app_admins`:
   - `SELECT` permitido con aal1 (el middleware necesita detectar admin antes de forzar challenge).
   - `UPDATE` y `DELETE` requieren `auth.jwt()->>'aal' = 'aal2'`.

## Primer enroll (flujo usuario)

1. Super-admin va a cualquier ruta `/admin/*` por primera vez post-update.
2. Middleware redirect a `/admin/mfa/enroll`.
3. Página llama `supabase.auth.mfa.enroll({ factorType: 'totp' })` y renderiza:
   - **Código QR** para escanear con authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…).
   - **Secret alternativo** en formato legible por bloques de 4 chars (collapse/expand).
4. Usuario introduce código de 6 dígitos del app.
5. Server Action llama `supabase.auth.mfa.challengeAndVerify({ factorId, code })`.
6. Si OK → sesión se eleva a `aal2`, redirect a `/admin`.
7. Si falla → el factor no verificado se elimina (`mfa.unenroll`) para permitir reintento limpio.

## Logins posteriores

1. Login con password (`aal1`).
2. Middleware redirect a `/admin/mfa/challenge?next=<ruta-original>`.
3. Usuario introduce código TOTP actual.
4. Server Action verifica → sesión `aal2` → redirect a `next`.

## Recovery — super-admin pierde device

**El owner de la plataforma ejecuta desde Supabase Dashboard:**

1. https://supabase.com/dashboard/project/your-project-ref/auth/users
2. Localizar email del super-admin.
3. Click en row → panel con detalles.
4. Botón **"Factors"** o sección MFA → **Delete TOTP factor**.
5. El super-admin, al siguiente login, será redirigido automáticamente a `/admin/mfa/enroll` para re-enrollar un nuevo device.

**Alternativa SQL (service role only):**

```sql
DELETE FROM auth.mfa_factors
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'target@example.com')
  AND factor_type = 'totp';
```

## Testing local

- `npm run test:rls` — pgTAP suite (`supabase/tests/rls_app_admins.sql`) con 8 assertions que cubren `aal1` denied / `aal2` allowed para UPDATE+DELETE.
- Manual E2E: login con super-admin → enroll → logout → login → challenge → verificar que `/admin/gyms` carga.

## Troubleshooting

- **"Código incorrecto" repetido:** reloj del device y del servidor Supabase deben estar sincronizados (TOTP = time-based). Verificar hora del móvil.
- **Middleware loop:** confirmar que las rutas `/admin/mfa/*` y `/auth/*` están excluidas del check MFA en `src/lib/supabase/middleware.ts`.
- **"Error al generar el factor TOTP":** posible rate limit Supabase (30 factors/hour max enroll). Esperar 1h o limpiar factores no verificados.

## Gotchas conocidos (post-bugfixes 22-abr)

Integraciones con `supabase.auth.mfa.*` tienen comportamientos no obvios detectados en producción. Ver (internal docs, not included) entrada 2026-04-22 EOD para detalle completo.

### 1. `enroll.totp.qr_code` es data URL completo — NO reprocesar
Supabase SDK devuelve `qr_code` como `data:image/svg+xml;utf8,<svg>...` listo para `<img src>`. **NO wrappear** con `data:image/svg+xml;utf8,${encodeURIComponent(qr_code)}` — eso produce src doble-codificado con `naturalWidth=0`, imagen invisible. Bug resuelto en PR #24.

```tsx
// ❌ Bug — double-encoded
<img src={`data:image/svg+xml;utf8,${encodeURIComponent(enroll.totp.qr_code)}`} />

// ✅ Correcto
<img src={enroll.totp.qr_code} />
```

### 2. `listFactors()` NO devuelve unverified por defecto
El SDK retorna solo factors con `status = 'verified'`. Los `unverified` existen en `auth.mfa_factors` pero no aparecen en el listado. Consecuencia: si intentas `enroll()` con el mismo `friendlyName` de un factor unverified previo, Supabase rechaza con "A factor with the friendly name X already exists".

**Workaround aplicado en `/admin/mfa/enroll/page.tsx`:** sufijo `timestamp-ms` en cada render hace el nombre único. Bug resuelto en PR #25.

```tsx
const now = new Date()
const uniqueSuffix = `${now.toISOString().slice(0, 10)} · ${now.getTime().toString().slice(-6)}`
friendlyName: `FitFlow Admin ${uniqueSuffix}`,
```

### 3. Secret manual debe ser siempre visible (no en `<details>`)
Enroll page debe mostrar QR + secret en texto simultáneamente. Casos reales:
- Dispositivo dual: authenticator app en otro device distinto del navegador
- Cámara no disponible o QR borroso
- Usuario prefiere copy-paste a escanear

Bug resuelto en PR #26 — secret renderiza permanente debajo del QR con `select-all` class.

### 4. OAuth callback handler requiere detectar AMBOS flows
`/auth/callback/route.ts` debe soportar:
- **OAuth** (Google, etc.): `?code=<authorization_code>` → `exchangeCodeForSession(code)`
- **OTP** (email confirm, magic link, recovery): `?token_hash=...&type=...` → `verifyOtp({token_hash, type})`

Si solo maneja uno de los dos, el otro flujo devuelve `invalid_link`. Patrón oficial Supabase Next.js SSR. Bug resuelto en PR #23.

### 5. Lección general
**Cualquier integración con Supabase Auth MFA debe probarse end-to-end con cuenta real** antes de marcar completado. TypeScript check + build OK + `browser_snapshot` NO detectan estos bugs — solo rendering visual + flujo humano real.

## No aplica a

- Tenants (gym staff) — login normal sin MFA.
- Members (socios area `/mi-cuenta`) — login normal sin MFA.
- Service-role operations (webhooks Stripe, GDPR deletes, admin RPCs) — bypass RLS total.

## Referencias

- Migración: `supabase/migrations/0020_rls_app_admins_require_aal2.sql`
- Tests: `supabase/tests/rls_app_admins.sql` (8 assertions)
- UI enroll: `src/app/(admin)/admin/mfa/enroll/`
- UI challenge: `src/app/(admin)/admin/mfa/challenge/`
- Middleware: `src/lib/supabase/middleware.ts` (bloque `if (isAdmin === true)`)
- Supabase docs: https://supabase.com/docs/guides/auth/auth-mfa/totp
