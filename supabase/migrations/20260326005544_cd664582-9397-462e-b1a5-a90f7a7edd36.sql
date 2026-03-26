
-- Drop the old ALL policy and create specific ones
DROP POLICY IF EXISTS "Developers can manage app_settings" ON public.app_settings;

-- Developers can update existing settings
CREATE POLICY "Developers can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Developers can insert new settings
CREATE POLICY "Developers can insert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );
