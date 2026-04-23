import { useEffect } from 'react';
import { useProductStore } from './productStore';
import { useCustomerStore } from './customerStore';
import { useSaleStore } from './saleStore';
import { useAuthStore } from './authStore';
import { useCajaStore } from './cajaStore';
import { useFacturaStore } from './facturaStore';
import { realtimeService } from '../services/realtimeService';

export const useStoreInitializer = () => {
  const initProducts = useProductStore((state) => state.initProducts);
  const initCustomers = useCustomerStore((state) => state.initCustomers);
  const initSales = useSaleStore((state) => state.initSales);
  const initAuth = useAuthStore((state) => state.initAuth);
  const initCaja = useCajaStore((state) => state.initCaja);
  const initFacturas = useFacturaStore((state) => state.initFacturas);

  useEffect(() => {
    // Initialize all stores — runs once on mount
    initAuth();
    initProducts();
    initCustomers();
    initSales();
    initCaja();
    initFacturas();

    // Start Realtime synchronization
    realtimeService.subscribe();

    // Fallback: re-sync data when the tab becomes visible again
    // (catches changes from other devices and recovers from WebSocket drops)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        initCaja();
        initProducts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      realtimeService.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

