
-- App settings table for developer-controlled configuration
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only developers can update settings
CREATE POLICY "Developers can manage app_settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Insert default ShamCash address
INSERT INTO public.app_settings (key, value) VALUES ('shamcash_address', 'efd5411a5f29e0cdb279363de2dd62b3');
