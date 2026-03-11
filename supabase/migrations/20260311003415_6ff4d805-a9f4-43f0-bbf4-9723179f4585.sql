
-- Add unique constraint on (user_id, device_id) for upsert support
-- First check if it exists, use IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'devices_user_id_device_id_key'
  ) THEN
    ALTER TABLE public.devices ADD CONSTRAINT devices_user_id_device_id_key UNIQUE (user_id, device_id);
  END IF;
END $$;

-- Add index for fast lookup of active devices by user
CREATE INDEX IF NOT EXISTS idx_devices_user_active ON public.devices (user_id, is_active) WHERE is_active = true;

-- Enable Realtime for devices table
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
