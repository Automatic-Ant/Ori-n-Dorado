import { useEffect } from 'react';
import { useProductStore } from './productStore';
import { useCustomerStore } from './customerStore';
import { useSaleStore } from './saleStore';
import { useAuthStore } from './authStore';
import { useCajaStore } from './cajaStore';
import { realtimeService } from '../services/realtimeService';

export const useStoreInitializer = () => {
  const initProducts = useProductStore((state) => state.initProducts);
  const initCustomers = useCustomerStore((state) => state.initCustomers);
  const initSales = useSaleStore((state) => state.initSales);
  const initAuth = useAuthStore((state) => state.initAuth);
  const initCaja = useCajaStore((state) => state.initCaja);

  useEffect(() => {
    // Initialize all stores — runs once on mount
    initAuth();
    initProducts();
    initCustomers();
    initSales();
    initCaja();

    // Start Realtime synchronization
    realtimeService.subscribe();

    return () => {
      realtimeService.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

