-- PHASE 1: ADD NEW EMPLOYEE TYPES TO ENUM
-- These must be committed before they can be used
ALTER TYPE public.employee_type ADD VALUE IF NOT EXISTS 'SALES_MANAGER';
ALTER TYPE public.employee_type ADD VALUE IF NOT EXISTS 'WAREHOUSE_KEEPER';