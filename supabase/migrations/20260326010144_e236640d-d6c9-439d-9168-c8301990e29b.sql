-- Fix app_settings write authorization to rely on canonical developer role check
DROP POLICY IF EXISTS "Developers can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Developers can insert app_settings" ON public.app_settings;

CREATE POLICY "Developers can update app_settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_developer())
  WITH CHECK (public.is_developer());

CREATE POLICY "Developers can insert app_settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_developer());