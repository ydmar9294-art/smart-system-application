-- =====================================================
-- إصلاح المشاكل الأمنية ذات مستوى error
-- =====================================================

-- 1. إضافة سياسة PERMISSIVE للوصول المصرح لجدول profiles
-- السياسات الموجودة حالياً هي RESTRICTIVE فقط، نحتاج PERMISSIVE

-- حذف السياسات القديمة وإعادة إنشائها بشكل صحيح
DROP POLICY IF EXISTS "Block unauthenticated access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view org profiles" ON public.profiles;

-- إنشاء سياسة رفض افتراضي للوصول غير المصرح (RESTRICTIVE)
CREATE POLICY "Default deny profiles access"
ON public.profiles FOR SELECT
TO anon
USING (false);

-- سياسة للمستخدم لرؤية ملفه الشخصي (PERMISSIVE)
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- سياسة للمطور لرؤية جميع الملفات (PERMISSIVE)
CREATE POLICY "Developers can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'DEVELOPER'));

-- سياسة للمالك لرؤية ملفات موظفي منشأته (PERMISSIVE)
CREATE POLICY "Owners can view org profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- 2. إصلاح جدول customers بنفس النمط
DROP POLICY IF EXISTS "Block unauthenticated access to customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers in their org" ON public.customers;
DROP POLICY IF EXISTS "Field agents and owners can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Block unauthenticated delete to customers" ON public.customers;
DROP POLICY IF EXISTS "Block unauthenticated insert to customers" ON public.customers;
DROP POLICY IF EXISTS "Block unauthenticated update to customers" ON public.customers;

-- رفض افتراضي للزوار
CREATE POLICY "Default deny customers access"
ON public.customers FOR SELECT
TO anon
USING (false);

CREATE POLICY "Default deny customers insert"
ON public.customers FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Default deny customers update"
ON public.customers FOR UPDATE
TO anon
USING (false);

CREATE POLICY "Default deny customers delete"
ON public.customers FOR DELETE
TO anon
USING (false);

-- سياسات للمستخدمين المصرح لهم (PERMISSIVE)
CREATE POLICY "Org users can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Developers can view all customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'DEVELOPER'));

CREATE POLICY "Org users can manage customers"
ON public.customers FOR ALL
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- 3. إصلاح view_customer_balances بإضافة security_invoker
-- حذف وإعادة إنشاء الـ view مع security_invoker
DROP VIEW IF EXISTS public.view_customer_balances;

CREATE VIEW public.view_customer_balances
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  phone,
  created_at,
  balance,
  organization_id
FROM public.customers;

-- منح صلاحيات الـ view
GRANT SELECT ON public.view_customer_balances TO authenticated;
GRANT SELECT ON public.view_customer_balances TO anon;