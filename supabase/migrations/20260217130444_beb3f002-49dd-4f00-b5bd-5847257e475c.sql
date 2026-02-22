
-- Fix overly permissive INSERT policy
DROP POLICY "System can insert notifications" ON public.user_notifications;

-- Only authenticated users can insert notifications for their org
CREATE POLICY "Authenticated users can insert notifications"
ON public.user_notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
