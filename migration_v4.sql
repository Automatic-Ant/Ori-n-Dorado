-- MIGRATION V4: Fix caja_movements sync and realtime

-- 1. Ensure caja_movements is included in the realtime publication
--    (required for cross-device sync via Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.caja_movements;

-- 2. Grant explicit permissions to anon and authenticated roles
--    (needed if the table was created via raw SQL instead of Supabase UI)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caja_movements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caja_movements TO authenticated;
