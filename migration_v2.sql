-- STOCK MANAGEMENT TRIGGERS V2
-- Centralizing all business logic for stock in the database

-- 1. Reducir stock al vender
CREATE OR REPLACE FUNCTION public.reducir_stock_al_vender()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock = stock - (NEW.quantity * COALESCE(NEW.units_per_package, 1)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.parent_product_id, NEW.product_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reducir_stock_al_vender ON public.sale_items;
CREATE TRIGGER trg_reducir_stock_al_vender
    AFTER INSERT ON public.sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.reducir_stock_al_vender();

-- 2. Restaurar stock al borrar item (CANCELACIÓN FÍSICA / DELETE)
CREATE OR REPLACE FUNCTION public.restaurar_stock_al_borrar_item_venta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock = stock + (OLD.quantity * COALESCE(OLD.units_per_package, 1)),
        updated_at = NOW()
    WHERE id = COALESCE(OLD.parent_product_id, OLD.product_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurar_stock_al_borrar ON public.sale_items;
CREATE TRIGGER trg_restaurar_stock_al_borrar
    AFTER DELETE ON public.sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.restaurar_stock_al_borrar_item_venta();

-- 3. Restaurar stock al cambiar estado a "cancelado" (SOFT CANCELLATION)
CREATE OR REPLACE FUNCTION public.restaurar_stock_al_cancelar_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si el estado cambia a 'cancelado' y no lo estaba antes
    IF (NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado')) THEN
        UPDATE public.products p
        SET stock = p.stock + (si.quantity * COALESCE(si.units_per_package, 1)),
            updated_at = NOW()
        FROM public.sale_items si
        WHERE si.sale_id = NEW.id
          AND p.id = COALESCE(si.parent_product_id, si.product_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurar_stock_al_cancelar ON public.sales;
CREATE TRIGGER trg_restaurar_stock_al_cancelar
    AFTER UPDATE OF status ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.restaurar_stock_al_cancelar_venta();

-- 4. Actualizar metadata técnica en sale_items (opcional pero recomendado)
-- Captura parent_product_id y units_per_package al insertar si no vienen definidos
CREATE OR REPLACE FUNCTION public.capture_product_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_product_id IS NULL THEN
        SELECT parent_product_id, units_per_package 
        INTO NEW.parent_product_id, NEW.units_per_package
        FROM public.products WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_capture_metadata ON public.sale_items;
CREATE TRIGGER trg_capture_metadata
    BEFORE INSERT ON public.sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.capture_product_metadata();

-- 5. Extend sales table to support mixed payments and precise discounts
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_detail JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;

-- 6. Restaurar saldo a favor del cliente si se cancela la venta (SOFT CANCELLATION)
CREATE OR REPLACE FUNCTION public.restaurar_credito_al_cancelar_venta()
RETURNS TRIGGER AS $$
DECLARE
    credit_used NUMERIC;
BEGIN
    -- Extraer el monto de 'saldo_favor' del payment_detail
    -- Se asume que el JSON tiene la forma {"saldo_favor": 123.45}
    credit_used := (NEW.payment_detail->>'saldo_favor')::NUMERIC;
    
    IF (NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado') AND credit_used > 0) THEN
        UPDATE public.customers
        SET credit_balance = credit_balance + credit_used,
            updated_at = NOW()
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurar_credito_al_cancelar ON public.sales;
CREATE TRIGGER trg_restaurar_credito_al_cancelar
    AFTER UPDATE OF status ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.restaurar_credito_al_cancelar_venta();
