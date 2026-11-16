-- =============================================================================
-- Fix: authenticated role necesita USAGE en schema private + EXECUTE en sus funciones
-- (para que RPCs SECURITY INVOKER puedan llamarlas)
-- =============================================================================
-- Las funciones en private son SECURITY DEFINER, lo cual resuelve la lógica,
-- pero el caller (authenticated) necesita USAGE en el schema para invocarlas.
--
-- Nota: esto NO expone las funciones a la API PostgREST (sigue no estando en
-- search_path público). Solo permite llamarlas desde otras funciones.

grant usage on schema private to authenticated;
grant execute on function private.current_user_gym_ids() to authenticated;
grant execute on function private.user_role_in_gym(uuid) to authenticated;
grant execute on function private.is_gym_admin(uuid) to authenticated;
