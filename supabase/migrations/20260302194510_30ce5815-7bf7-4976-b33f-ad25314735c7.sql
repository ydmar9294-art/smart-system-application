SELECT
cron.schedule(
  'expire-licenses-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nrqueogifxxdwladewey.supabase.co/functions/v1/expire-licenses',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycXVlb2dpZnh4ZHdsYWRld2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU3NTcsImV4cCI6MjA4NzM2MTc1N30.JhZ51PugdGM8Op4B1ynxZrqFLIygiYX44EbeGU997GY"}'::jsonb,
        body:='{"time": "scheduled"}'::jsonb
    ) as request_id;
  $$
);
