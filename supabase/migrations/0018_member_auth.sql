-- =============================================================================
-- 0018 — Member auth + RLS self-read (Fase 1C)
--
-- - RPC link_member_auth_user(member_id): vincula auth.users con members row
--   (llamada al aterrizar en /mi-cuenta/welcome tras magic link).
-- - RLS SELECT members cuando auth.uid() = members.auth_user_id (socio ve su propio row).
-- - RLS SELECT payments cuando es dueño del member asociado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.link_member_auth_user(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_email text;
  v_member_email text;
BEGIN
  -- Obtener email del user autenticado
  SELECT email INTO v_auth_email FROM auth.users WHERE id = auth.uid();

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '42501';
  END IF;

  -- Obtener email del member
  SELECT email INTO v_member_email FROM public.members WHERE id = p_member_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Socio no encontrado: %', p_member_id USING ERRCODE = '42P01';
  END IF;

  IF lower(v_auth_email) != lower(v_member_email) THEN
    RAISE EXCEPTION 'Email no coincide con el socio' USING ERRCODE = '42501';
  END IF;

  -- Link (si ya estaba linkeado a otro auth_user_id, sobreescribe; caso migracion email)
  UPDATE public.members
  SET auth_user_id = auth.uid(),
      updated_at = now()
  WHERE id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_member_auth_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_member_auth_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.link_member_auth_user IS
  'Vincula auth.users con members row via email match. Llamada desde /mi-cuenta/welcome tras magic link.';


-- -----------------------------------------------------------------------------
-- RLS members: socio ve su propio row
-- -----------------------------------------------------------------------------
CREATE POLICY "member_read_own_record"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "member_update_own_contact"
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- RLS payments: socio ve sus propios pagos
-- -----------------------------------------------------------------------------
CREATE POLICY "member_read_own_payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payments.member_id
        AND m.auth_user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- RLS tariffs: socio ve su tarifa actual (para mostrar precio/nombre en /mi-cuenta)
-- -----------------------------------------------------------------------------
CREATE POLICY "member_read_own_current_tariff"
  ON public.tariffs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.current_tariff_id = tariffs.id
        AND m.auth_user_id = auth.uid()
    )
  );
