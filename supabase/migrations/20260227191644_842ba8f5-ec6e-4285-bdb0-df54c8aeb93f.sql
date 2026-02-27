
-- Create devices table for single-active-device policy
CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text NOT NULL DEFAULT 'Unknown',
  is_active boolean NOT NULL DEFAULT true,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  replaced_device_id text
);

-- Unique partial index: only ONE active device per user
CREATE UNIQUE INDEX idx_devices_user_active ON public.devices (user_id) WHERE is_active = true;

-- Index for fast lookup by user_id + device_id
CREATE INDEX idx_devices_user_device ON public.devices (user_id, device_id);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Users can read their own devices
CREATE POLICY "Users can read own devices"
ON public.devices FOR SELECT
USING (user_id = auth.uid());

-- No direct insert/update/delete from client — all managed via edge function with service role
-- System (service role) can manage all devices — handled by edge function
