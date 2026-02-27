
-- Add stamp_url column to organization_legal_info
ALTER TABLE public.organization_legal_info
ADD COLUMN stamp_url text DEFAULT NULL;

-- Create storage bucket for company stamps
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-stamps', 'company-stamps', true);

-- RLS: Anyone can view stamps (needed for invoice rendering)
CREATE POLICY "Public read stamps"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-stamps');

-- Only org owners can upload stamps
CREATE POLICY "Owners upload stamps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-stamps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owners can update their stamps
CREATE POLICY "Owners update stamps"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-stamps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owners can delete their stamps
CREATE POLICY "Owners delete stamps"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-stamps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
