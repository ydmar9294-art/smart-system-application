
-- Fix: Add storage INSERT policy so owners can upload payment receipts
CREATE POLICY "Owners can upload payment receipts"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Make bucket public so receipts can be viewed by developers
UPDATE storage.buckets SET public = true WHERE id = 'payment-receipts';

-- Also allow UPDATE for re-uploading
CREATE POLICY "Users can update own payment receipts"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'payment-receipts'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
