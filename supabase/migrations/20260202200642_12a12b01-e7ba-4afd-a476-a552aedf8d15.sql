-- Fix Security Issue 1: Add explicit restrictive policies for anon role on profiles table
-- Block INSERT for unauthenticated users
CREATE POLICY "Block unauthenticated insert to profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (false);

-- Block UPDATE for unauthenticated users  
CREATE POLICY "Block unauthenticated update to profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

-- Block DELETE for unauthenticated users
CREATE POLICY "Block unauthenticated delete to profiles"
ON public.profiles
FOR DELETE
TO anon
USING (false);

-- Fix Security Issue 2: Add explicit restrictive policies for anon role on customers table
-- Block INSERT for unauthenticated users
CREATE POLICY "Block unauthenticated insert to customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (false);

-- Block UPDATE for unauthenticated users
CREATE POLICY "Block unauthenticated update to customers"
ON public.customers
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

-- Block DELETE for unauthenticated users
CREATE POLICY "Block unauthenticated delete to customers"
ON public.customers
FOR DELETE
TO anon
USING (false);