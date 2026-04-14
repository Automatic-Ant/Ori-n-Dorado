import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';

export const useCustomerStore = create((set, get) => ({
  customers: [],
  isLoadingCustomers: true,
  
  initCustomers: async () => {
    set({ isLoadingCustomers: true });
    try {
      const localRaw = localStorage.getItem('orion_customers');
      const localCustomers = localRaw ? JSON.parse(localRaw) : [];

      const liveCustomers = await supabaseService.getAllCustomers();

      if (liveCustomers) {
        // Supabase is source of truth for all persisted records.
        // Only sync local customers that have a temp ID (created offline, not yet in Supabase).
        const unsynced = localCustomers.filter((c) => c.id && c.id.startsWith('temp-'));

        let finalCustomers = liveCustomers;
        for (const c of unsynced) {
          try {
            const saved = await supabaseService.addCustomer(c);
            if (saved) {
              finalCustomers = [...finalCustomers, { ...saved, creditBalance: Number(saved.credit_balance || 0) }];
            }
          } catch { /* ignore duplicates */ }
        }

        set({ customers: finalCustomers });
        localStorage.setItem('orion_customers', JSON.stringify(finalCustomers));
      } else {
        // Supabase unreachable → fall back to local cache
        if (localCustomers.length) set({ customers: localCustomers });
      }
    } catch (e) {
      console.error('Error init customers:', e);
      const localRaw = localStorage.getItem('orion_customers');
      if (localRaw) set({ customers: JSON.parse(localRaw) });
    }
    set({ isLoadingCustomers: false });
  },

  setCustomers: (items) => {
    set({ customers: items });
    localStorage.setItem('orion_customers', JSON.stringify(items));
  },

  addCustomer: async (customer) => {
    // 1. Optimistic local update
    const tempId = `temp-${Date.now()}`;
    const optimisticCustomer = { ...customer, id: tempId, creditBalance: 0 };
    set((state) => {
      const newCustomers = [...state.customers, optimisticCustomer];
      localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
      return { customers: newCustomers };
    });

    // 2. Sync to Supabase and replace temp with real record
    try {
      const saved = await supabaseService.addCustomer(customer);
      if (saved) {
        set((state) => {
          const newCustomers = state.customers.map((c) =>
            c.id === tempId
              ? { ...saved, creditBalance: Number(saved.credit_balance || 0) }
              : c
          );
          localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
          return { customers: newCustomers };
        });
      } else {
        // Supabase returned null — roll back the optimistic add
        set((state) => {
          const rolled = state.customers.filter((c) => c.id !== tempId);
          localStorage.setItem('orion_customers', JSON.stringify(rolled));
          return { customers: rolled };
        });
      }
    } catch (e) {
      console.error('Error adding customer to Supabase:', e);
      // Roll back the optimistic add so state stays consistent
      set((state) => {
        const rolled = state.customers.filter((c) => c.id !== tempId);
        localStorage.setItem('orion_customers', JSON.stringify(rolled));
        return { customers: rolled };
      });
    }
  },

  updateCustomer: async (id, updatedCustomer) => {
    set((state) => {
      const newCustomers = state.customers.map(c => c.id === id ? { ...c, ...updatedCustomer } : c);
      localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
      return { customers: newCustomers };
    });
    await supabaseService.updateCustomer(id, updatedCustomer);
  },

  deleteCustomer: async (id) => {
    const previousCustomers = get().customers;
    
    // 1. Optimistic Update
    set((state) => {
      const newCustomers = state.customers.filter(c => c.id !== id);
      localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
      return { customers: newCustomers };
    });
    
    // 2. Sync to Supabase
    try {
      await supabaseService.deleteCustomer(id);
    } catch (e) {
      console.error('Delete Customer Error, rolling back:', e);
      set({ customers: previousCustomers });
      localStorage.setItem('orion_customers', JSON.stringify(previousCustomers));
    }
  },

  deductCredit: async (idOrName, amount) => {
    const customer = get().customers.find((c) => c.id === idOrName || c.name === idOrName);
    if (!customer) return;

    const newBalance = Math.max(0, (customer.creditBalance || 0) - Number(amount));

    set((state) => {
      const newCustomers = state.customers.map((c) =>
        c.id === customer.id ? { ...c, creditBalance: newBalance } : c
      );
      localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
      return { customers: newCustomers };
    });

    await supabaseService.updateCustomer(customer.id, { ...customer, creditBalance: newBalance });
  },

  addCredit: async (idOrName, amount) => {
    const customer = get().customers.find(c => c.id === idOrName || c.name === idOrName);
    if (!customer) return;

    const newBalance = (customer.creditBalance || 0) + Number(amount);
    
    // update locally
    set((state) => {
      const newCustomers = state.customers.map(c => 
        c.id === customer.id ? { ...c, creditBalance: newBalance } : c
      );
      localStorage.setItem('orion_customers', JSON.stringify(newCustomers));
      return { customers: newCustomers };
    });

    // sync to supabase
    await supabaseService.updateCustomer(customer.id, { ...customer, creditBalance: newBalance });
  },

  handleRealtimeEvent: (payload) => {
    const { eventType, new: newItem, old: oldItem } = payload;
    set((state) => {
      let next = [...state.customers];
      if (eventType === 'INSERT') {
        if (!next.some(c => c.id === newItem.id)) {
          const mapped = { ...newItem, creditBalance: Number(newItem.credit_balance || 0) };
          next = [...next, mapped];
        }
      } else if (eventType === 'UPDATE') {
        const mapped = { ...newItem, creditBalance: Number(newItem.credit_balance || 0) };
        next = next.map(c => c.id === mapped.id ? { ...c, ...mapped } : c);
      } else if (eventType === 'DELETE') {
        next = next.filter(c => c.id !== oldItem.id);
      }
      localStorage.setItem('orion_customers', JSON.stringify(next));
      return { customers: next };
    });
  }
}));

