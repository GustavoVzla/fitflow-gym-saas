# pgTAP RLS tests

Tests SQL ejecutados contra la DB de desarrollo/staging. Validan que las policies RLS de `fitflow` aíslan correctamente datos entre gyms (multi-tenant) y roles (super-admin, tenant staff, member).

## Dependencias

- Extensión pgTAP activada (migración `0019_pgtap_extension.sql` ya aplicada)
- Cliente Postgres (psql) o MCP Supabase `execute_sql`

## Archivos

| Test | Qué valida |
|---|---|
| `rls_members.sql` | Owner gym A ve/modifica SUS members; NO los de gym B. Socio ve su propio record |
| `rls_bookings.sql` | Mismo patrón para bookings |
| `rls_payments.sql` | Staff gym A lee SUS payments; socio ve SUS pagos NO los de otro socio |
| `rls_gym_users.sql` | Owner gym A NO lee gym_users de B. Super-admin SÍ cross-tenant |
| `rls_app_admins.sql` | Super-admin SÍ lee app_admins; user normal NO |

## Patrón de cada test

Cada archivo:

1. `BEGIN;` — abre transacción
2. Crea fixtures (2 gyms, users, roles) con `INSERT` directos bypassing RLS (rol postgres)
3. `SELECT plan(N);` — declara número de assertions
4. Usa `SET LOCAL role authenticated;` + `SET LOCAL "request.jwt.claims" TO '...';` para simular contexto de user específico
5. Ejecuta queries y usa `results_eq`, `is_empty`, `throws_ok`, `ok` de pgTAP
6. `SELECT * FROM finish();` — cierra plan
7. `ROLLBACK;` — deshace todos los fixtures (no toca data real)

## Cómo ejecutar

### Via MCP Supabase (recomendado para Claude Code)

```ts
// ejecutar cada archivo con mcp__supabase__execute_sql
```

Ver script `scripts/run-rls-tests.mjs`.

### Via psql + pg_prove (si lo tienes instalado)

```bash
pg_prove --dbname=$DATABASE_URL supabase/tests/rls_*.sql
```

### Via npm script

```bash
npm run test:rls
```

Llama a `scripts/run-rls-tests.mjs` que usa MCP interno o Supabase REST para ejecutar y parsear TAP output.

## Convenciones

- Cada test autosuficiente: crea y destruye sus fixtures
- `BEGIN;` ... `ROLLBACK;` obligatorio — tests nunca modifican DB persistentemente
- IDs deterministas cuando sea posible (UUIDs hardcodeados por test)
- Sin dependencia entre tests — orden de ejecución irrelevante

## Añadir un test nuevo

1. Crear `rls_<tabla>.sql` siguiendo el patrón
2. Actualizar README con entrada en la tabla de arriba
3. Añadir al array `TESTS` en `scripts/run-rls-tests.mjs`

## Qué NO probar aquí

- Lógica de negocio (eso son unit tests de funciones/server actions)
- UI (eso son Playwright E2E)
- Rendimiento (eso es pgbench u otro benchmark)

Solo **políticas RLS**: ¿quién puede leer/escribir qué?
