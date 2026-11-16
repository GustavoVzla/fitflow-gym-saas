-- Migration 0020 — app_admins: require aal2 (TOTP verified) para mutaciones.
--
-- Contexto:
--   FASE 4 sesion 8 (2026-04-22) — MFA TOTP obligatorio para super-admins.
--   Supabase Auth upgrade JWT claim 'aal' de 'aal1' a 'aal2' tras verificar TOTP.
--
-- SELECT sigue con aal1: necesario para que el middleware detecte que el user
-- es super-admin ANTES de forzar el challenge (si no, no sabemos a dónde
-- redirigir). La tabla tiene 1 sola columna de datos (is_active) y la key es
-- user_id = auth.uid() → no hay PII cross-tenant en SELECT.
--
-- UPDATE/DELETE requieren aal2: cambios en app_admins (ej. self-deactivate,
-- futuro: gestión de otros super-admins) son irreversibles por RLS, necesitan
-- segundo factor.
--
-- Previo estado: solo existe policy "app_admins self read" (SELECT).
-- Post migración: 3 policies — self read aal1+, update aal2 only, delete aal2 only.

-- No hay INSERT public policy: creación de super-admins se hace via service role
-- (admin_create_gym_with_owner / seeds manuales). Intencional.

CREATE POLICY "app_admins self update aal2 only"
  ON public.app_admins
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2')
  WITH CHECK (user_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "app_admins self delete aal2 only"
  ON public.app_admins
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');
