import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';
import { getCurrentISO } from '../utils/dateHelpers';

export const useSaleStore = create((set, get) => ({
  sales: [],
  creditNotes: [],
  isLoadingSales: true,
  
  initSales: async () => {
    set({ isLoadingSales: true });
    try {
      const [liveSales, credits] = await Promise.all([
        supabaseService.getAllSales(),
        supabaseService.getAllCreditNotes()
      ]);

      if (liveSales) {
        set({ sales: liveSales });
        localStorage.setItem('orion_sales', JSON.stringify(liveSales));
      } else {
        const localSales = localStorage.getItem('orion_sales');
        if (localSales) set({ sales: JSON.parse(localSales) });
      }

      if (credits) {
        set({ creditNotes: credits });
        localStorage.setItem('orion_credit_notes', JSON.stringify(credits));
      }
    } catch (e) {
      console.error('Error init sales/credits:', e);
      const localSales = localStorage.getItem('orion_sales');
      if (localSales) set({ sales: JSON.parse(localSales) });
    }
    set({ isLoadingSales: false });
  },

  addSale: async (sale, decreaseStockFn) => {
    const existingSales = get().sales;
    const maxNum = existingSales.reduce((max, s) => {
      const num = parseInt((s.id || '').replace('#', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const saleId = `#${maxNum + 1}`;
    const newSale = { 
      ...sale, 
      id: saleId, 
      time: new Date().toLocaleTimeString('es-AR'),
      date: getCurrentISO(),
      status: 'completada'
    };
    
    // 1. Add Sale locally
    set((state) => {
      const newSales = [newSale, ...state.sales];
      localStorage.setItem('orion_sales', JSON.stringify(newSales));
      return { sales: newSales };
    });

    // 2. Subtract Stock locally
    if (decreaseStockFn) {
      decreaseStockFn(sale.items);
    }

    // 3. Sync to Supabase
    try {
      await supabaseService.syncSale(newSale);
    } catch (e) {
      console.error("Error syncing sale to Supabase:", e);
    }
  },

  addCreditNote: async (note) => {
    const newNote = { ...note, date: getCurrentISO() };
    
    // local update
    set((state) => {
      const newNotes = [newNote, ...state.creditNotes];
      localStorage.setItem('orion_credit_notes', JSON.stringify(newNotes));
      return { creditNotes: newNotes };
    });

    // sync to supabase
    await supabaseService.addCreditNote(newNote);
  },

  cancelSale: async (saleId, increaseStockFn) => {
    let canceledSale = null;

    set((state) => {
      const updatedSales = state.sales.map((s) => {
        if (s.id === saleId && s.status !== 'cancelado') {
          canceledSale = { ...s }; 
          return { ...s, status: 'cancelado' };
        }
        return s;
      });

      if (canceledSale) {
        localStorage.setItem('orion_sales', JSON.stringify(updatedSales));
        return { sales: updatedSales };
      }
      return state;
    });

    if (canceledSale && increaseStockFn) {
      // 1. Return stock locally
      increaseStockFn(canceledSale.items);
      
      // 2. Sync to Supabase
      try {
        await Promise.all([
          supabaseService.updateSaleStatus(saleId, 'cancelado'),
          ...canceledSale.items.map(item => {
            // If this item was a package product, restore to the parent's stock
            const targetId = item.parentProductId || item.id;
            const qty = item.quantity * (item.unitsPerPackage || 1);
            return supabaseService.incrementStock(targetId, qty);
          })
        ]);
      } catch (e) {
        console.error("Error syncing cancellation to Supabase:", e);
      }
    }
  },

  handleRealtimeEvent: (payload) => {
    const { eventType, new: newItem, old: oldItem, table } = payload;
    
    set((state) => {
      if (table === 'sales') {
        let next = [...state.sales];
        if (eventType === 'INSERT') {
          // Note: Full sale object with items is preferred, but for realtime INSERT 
          // we might just trigger a single fetch if we want the items.
          // For now, let's just add it if not present.
          if (!next.some(s => s.id === newItem.id)) {
             next = [newItem, ...next];
          }
        } else if (eventType === 'UPDATE') {
          next = next.map(s => s.id === newItem.id ? { ...s, ...newItem } : s);
        } else if (eventType === 'DELETE') {
          next = next.filter(s => s.id !== oldItem.id);
        }
        localStorage.setItem('orion_sales', JSON.stringify(next));
        return { sales: next };
      }
      
      if (table === 'credit_notes') {
        let next = [...state.creditNotes];
        if (eventType === 'INSERT') {
          if (!next.some(n => n.id === newItem.id)) next = [newItem, ...next];
        } else if (eventType === 'UPDATE') {
          next = next.map(n => n.id === newItem.id ? { ...n, ...newItem } : n);
        } else if (eventType === 'DELETE') {
          next = next.filter(n => n.id !== oldItem.id);
        }
        localStorage.setItem('orion_credit_notes', JSON.stringify(next));
        return { creditNotes: next };
      }
      return state;
    });
  }
}));

