-- 1. Enable RLS and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Otros',
    stock NUMERIC DEFAULT 0,
    codigo_precio NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    base_code NUMERIC DEFAULT 1,
    min_stock NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'unidad',
    list_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: add list_price column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS list_price NUMERIC DEFAULT 0;

-- Migration: add product presentation/packaging columns
-- parent_product_id: if set, this product is a package/presentation of the parent
-- units_per_package: how many units of the parent's stock 1 unit of this product represents
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES public.products(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units_per_package NUMERIC DEFAULT 1;

-- Migration: snapshot parent info in sale_items so cancellations restore stock correctly
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS parent_product_id UUID;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS units_per_package NUMERIC DEFAULT 1;

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    credit_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SALES TABLE
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT, -- For #1234 format
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total NUMERIC NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'completada', -- completada, cancelada
    customer_id UUID REFERENCES public.customers(id),
    customer_dni TEXT, -- Legacy support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SALE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_code TEXT,
    product_name TEXT,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL, -- Price at sale time
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CREDIT NOTES TABLE
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT,
    amount NUMERIC NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CAJA MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.caja_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    amount NUMERIC NOT NULL,
    description TEXT DEFAULT '',
    seller_name TEXT DEFAULT '',
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. SET UP ROW LEVEL SECURITY (RLS)
-- Since the user requested "without login" for now, we will enable public access.
-- Warning: In a production app with sensitive data, this should be restricted to authenticated users.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movements ENABLE ROW LEVEL SECURITY;

-- Create public access policies (Temporary, as per "without login" requirement)
CREATE POLICY "Public Access Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Sale Items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Credit Notes" ON public.credit_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Caja Movements" ON public.caja_movements FOR ALL USING (true) WITH CHECK (true);

-- 8. RPC: Decrement Stock Safely
-- This function handles the atomic decrement of stock to avoid race conditions.
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id UUID, qty NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET stock = stock - qty,
        updated_at = NOW()
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8b. RPC: Increment Stock (used by returns/devoluciones)
CREATE OR REPLACE FUNCTION public.increment_stock(product_id UUID, qty NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET stock = stock + qty,
        updated_at = NOW()
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Updated At Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 10. PROFILES TABLE (Linked to Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'vendedor', -- admin, vendedor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 11. Auth Trigger to create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Restore original RLS policies (restricted to auth users for production, but following user request for now)
-- Update: If we use Login, we probably want to restrict some things, but I'll keep them public for now as per user previous request, just adding the admin logic.
