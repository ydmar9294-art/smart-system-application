
-- Phase 1: Add missing columns to devices table
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS app_version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS ip_address text;

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices (user_id);

-- Create index on device_id for fast lookups  
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices (device_id);

-- Create index for active session queries
CREATE INDEX IF NOT EXISTS idx_devices_user_active ON public.devices (user_id, is_active) WHERE is_active = true;

-- Phase 2: Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  device_id text,
  device_name text,
  platform text,
  ip_address text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Index on user_id for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events (user_id);

-- Index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events (event_type);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events (created_at DESC);

-- RLS policies for security_events
-- Users can read their own security events
CREATE POLICY "Users can read own security events"
  ON public.security_events FOR SELECT
  USING (user_id = auth.uid());

-- Developers can read all security events
CREATE POLICY "Developers can read all security events"
  ON public.security_events FOR SELECT
  USING (is_developer());

-- No direct client insert (service role only via edge functions)
-- No update or delete allowed
