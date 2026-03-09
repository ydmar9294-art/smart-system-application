-- Clean up duplicate (user_id, device_id) rows, keeping only the most recent
DELETE FROM public.devices d1
USING public.devices d2
WHERE d1.user_id = d2.user_id
  AND d1.device_id = d2.device_id
  AND d1.created_at < d2.created_at;

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_device_unique ON public.devices (user_id, device_id);