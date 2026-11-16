-- HIGH security: bucket gym-assets listing era publico (anon podia list() todos los files).
-- URLs directas (public object) siguen accesibles -> no rompe web publica ni render <img>.
-- Solo restringe LIST operations (storage.from().list()).
-- Supabase advisor lint 0025_public_bucket_allows_listing.

DROP POLICY IF EXISTS "Public can read gym assets" ON storage.objects;

CREATE POLICY "Gym staff can list own assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gym-assets'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT private.current_user_gym_ids()
    )
  );
