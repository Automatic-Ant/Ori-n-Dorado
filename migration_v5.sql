-- MIGRATION V5: Stock independiente por presentación
-- Cada pack/presentación tiene su propio stock de cajas.
-- Los triggers ahora decrementan el producto vendido directamente,
-- en lugar de convertir a unidades y descontarle al padre.

-- 1. Reducir stock al vender: descuenta del producto vendido
CREATE OR REPLACE FUNCTION public.reducir_stock_al_vender()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock = stock - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Restaurar stock al borrar item (cancelación física / DELETE)
CREATE OR REPLACE FUNCTION public.restaurar_stock_al_borrar_item_venta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock = stock + OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. Restaurar stock al cambiar estado a "cancelado" (soft cancellation)
CREATE OR REPLACE FUNCTION public.restaurar_stock_al_cancelar_venta()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado')) THEN
        UPDATE public.products p
        SET stock = p.stock + si.quantity,
            updated_at = NOW()
        FROM public.sale_items si
        WHERE si.sale_id = NEW.id
          AND p.id = si.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
