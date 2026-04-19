/* 
  PASO 1: EJECUTAR ESTO EN EL SQL EDITOR DE SUPABASE
  ================================================
  Copiá y pegá todo este bloque para activar la automatización de stock y ventas.
*/

-- 1. Mejorar tabla de ventas para soportar pagos combinados y descuentos detallados
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_splits JSONB DEFAULT '[]';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;

-- 2. Asegurar campos de trazabilidad en ítems de venta (para devoluciones precisas)
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS parent_product_id UUID;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS units_per_package NUMERIC DEFAULT 1;

-- 3. Función para descontar stock automáticamente al insertar un ítem de venta
CREATE OR REPLACE FUNCTION public.tr_handle_stock_on_sale_item()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
    total_qty NUMERIC;
BEGIN
    -- Determinar el ID del producto que realmente tiene el stock físico
    target_id := COALESCE(NEW.parent_product_id, NEW.product_id);
    
    -- Calcular cantidad real (cantidad vendida * unidades por bulto/pack)
    total_qty := NEW.quantity * COALESCE(NEW.units_per_package, 1);

    IF target_id IS NOT NULL THEN
        UPDATE public.products
        SET stock = stock - total_qty,
            updated_at = NOW()
        WHERE id = target_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para devolver stock automáticamente al cancelar una venta
CREATE OR REPLACE FUNCTION public.tr_handle_stock_on_sale_cancel()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar si el estado cambia a 'cancelado' (devolución)
    IF (NEW.status = 'cancelado' AND OLD.status != 'cancelado') THEN
        -- Recorrer todos los ítems de esa venta y devolver el stock
        UPDATE public.products p
        SET stock = p.stock + (si.quantity * COALESCE(si.units_per_package, 1)),
            updated_at = NOW()
        FROM public.sale_items si
        WHERE si.sale_id = NEW.id
          AND p.id = COALESCE(si.parent_product_id, si.product_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear los disparadores (Triggers)
DROP TRIGGER IF EXISTS tr_deduct_stock ON public.sale_items;
CREATE TRIGGER tr_deduct_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE PROCEDURE public.tr_handle_stock_on_sale_item();

DROP TRIGGER IF EXISTS tr_restore_stock ON public.sales;
CREATE TRIGGER tr_restore_stock
AFTER UPDATE ON public.sales
FOR EACH ROW EXECUTE PROCEDURE public.tr_handle_stock_on_sale_cancel();

-- 6. Garantizar que Realtime esté activo para las tablas críticas
-- (Esto permite que todos los dispositivos vean los cambios al instante)
ALTER publication supabase_realtime ADD TABLE public.products;
ALTER publication supabase_realtime ADD TABLE public.sales;
ALTER publication supabase_realtime ADD TABLE public.sale_items;
ALTER publication supabase_realtime ADD TABLE public.customers;
ALTER publication supabase_realtime ADD TABLE public.caja_movements;
