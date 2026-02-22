
-- App Versions table for hybrid update system
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'windows', 'web')),
  version_name TEXT NOT NULL CHECK (version_name ~ '^\d+\.\d+\.\d+$'),
  version_code INTEGER NOT NULL CHECK (version_code > 0),
  min_required_version TEXT NOT NULL CHECK (min_required_version ~ '^\d+\.\d+\.\d+$'),
  force_update BOOLEAN NOT NULL DEFAULT false,
  release_notes TEXT,
  update_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active version per platform
CREATE UNIQUE INDEX idx_app_versions_active_platform 
  ON public.app_versions (platform) WHERE is_active = true;

-- Index for lookups
CREATE INDEX idx_app_versions_platform_active 
  ON public.app_versions (platform, is_active);

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Anyone can read active versions (needed for version check)
CREATE POLICY "Anyone can read active versions"
  ON public.app_versions FOR SELECT
  USING (is_active = true);

-- Only developers can manage versions
CREATE POLICY "Developers can manage versions"
  ON public.app_versions FOR ALL
  USING (has_role(auth.uid(), 'DEVELOPER'::user_role))
  WITH CHECK (has_role(auth.uid(), 'DEVELOPER'::user_role));

-- Trigger to enforce no downgrade: new version_code must be >= max existing for same platform
CREATE OR REPLACE FUNCTION public.check_version_no_downgrade()
RETURNS TRIGGER AS $$
DECLARE
  v_max_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_code), 0) INTO v_max_code
  FROM public.app_versions
  WHERE platform = NEW.platform AND id != NEW.id;
  
  IF NEW.version_code < v_max_code THEN
    RAISE EXCEPTION 'Cannot create version with code % which is less than current max %', NEW.version_code, v_max_code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_check_version_no_downgrade
  BEFORE INSERT OR UPDATE ON public.app_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_version_no_downgrade();
