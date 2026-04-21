-- MIGRATION V3: Add missing columns to sales table
-- These columns are required by syncSale() but were absent from the schema.

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_name TEXT DEFAULT '';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';

-- Sequential sale number (auto-incremented by DB, never changes)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_number BIGSERIAL;
