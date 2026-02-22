-- Add location column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS location text;