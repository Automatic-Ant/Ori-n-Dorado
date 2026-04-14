import { useEffect } from 'react';
import { useProductStore } from './productStore';
import { useCustomerStore } from './customerStore';
import { useSaleStore } from './saleStore';
import { useAuthStore } from './authStore';
import { useCajaStore } from './cajaStore';

export const useStoreInitializer = () => {
  const initProducts = useProductStore((state) => state.initProducts);
  const initCustomers = useCustomerStore((state) => state.initCustomers);
  const initSales = useSaleStore((state) => state.initSales);
  const initAuth = useAuthStore((state) => state.initAuth);
  const initCaja = useCajaStore((state) => state.initCaja);

  useEffect(() => {
    // Initialize all stores — runs once on mount
    // Zustand store methods are stable references; deps array is intentionally empty
    initAuth();
    initProducts();
    initCustomers();
    initSales();
    initCaja();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

