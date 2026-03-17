
-- Fix: remove overly permissive insert policy on user_notifications
-- Service role key bypasses RLS anyway, so we don't need WITH CHECK (true)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.user_notifications;
