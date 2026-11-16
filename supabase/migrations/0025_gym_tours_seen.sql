-- =============================================================================
-- 0025 — Tours seen state (per-user persistence, backend)
--
-- Scope:
--   1. Tabla gym_tours_seen (user_id + tour_key + seen_at)
--   2. RLS: user solo ve/edita sus propias rows
--   3. RPC mark_tour_seen(tour_key) — upsert
--   4. RPC get_tours_seen() — returns setof text (tour_keys vistos)
--
-- Reemplaza la persistencia actual en localStorage (FeatureTour.tsx). Asi
-- el usuario no ve el tour de nuevo al cambiar de navegador/dispositivo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gym_tours_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

CREATE INDEX IF NOT EXISTS idx_gym_tours_seen_user ON public.gym_tours_seen(user_id);

ALTER TABLE public.gym_tours_seen ENABLE ROW LEVEL SECURITY;

-- SELECT: user solo ve sus propias rows
CREATE POLICY "tours_seen_select_own"
  ON public.gym_tours_seen FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: user solo inserta rows con su propio user_id
CREATE POLICY "tours_seen_insert_own"
  ON public.gym_tours_seen FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE policy — seen_at es immutable, solo insert via upsert RPC
-- No DELETE policy — user puede "olvidar" tours via backend si lo necesitamos en el futuro

-- =============================================================================
-- RPC mark_tour_seen
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_tour_seen(p_tour_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  IF p_tour_key IS NULL OR length(p_tour_key) = 0 OR length(p_tour_key) > 100 THEN
    RAISE EXCEPTION 'tour_key invalido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gym_tours_seen (user_id, tour_key, seen_at)
  VALUES (auth.uid(), p_tour_key, now())
  ON CONFLICT (user_id, tour_key) DO UPDATE SET seen_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_tour_seen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_tour_seen(text) TO authenticated;

-- =============================================================================
-- RPC get_tours_seen
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_tours_seen()
RETURNS setof text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT tour_key
  FROM public.gym_tours_seen
  WHERE user_id = auth.uid()
  ORDER BY seen_at DESC;
$fn$;

REVOKE ALL ON FUNCTION public.get_tours_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tours_seen() TO authenticated;
