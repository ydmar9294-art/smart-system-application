
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  version_name TEXT NOT NULL,
  version_code INTEGER NOT NULL DEFAULT 1,
  min_required_version TEXT NOT NULL DEFAULT '1.0.0',
  force_update BOOLEAN NOT NULL DEFAULT false,
  update_url TEXT DEFAULT '',
  release_notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, is_active)
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of app versions"
  ON public.app_versions FOR SELECT
  USING (true);

CREATE POLICY "Only developers can manage versions"
  ON public.app_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER'));

-- Seed default web version so the 404 stops
INSERT INTO public.app_versions (platform, version_name, version_code, min_required_version)
VALUES ('web', '1.0.0', 1, '1.0.0');
