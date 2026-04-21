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

  addSale: async (sale) => {
    // 1. Sync to Supabase
    // Note: We don't add it locally first anymore because the DB handles stock 
    // and we want to avoid UI flickering with incomplete data. 
    // The Realtime listener will catch the insert and update the state.
    try {
      await supabaseService.syncSale(sale);
      return true;
    } catch (e) {
      console.error("Error syncing sale to Supabase:", e);
      throw e;
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

  cancelSale: async (saleId) => {
    try {
      await supabaseService.updateSaleStatus(saleId, 'cancelado');
    } catch (e) {
      console.error("Error syncing cancellation to Supabase:", e);
      throw e;
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
            next = [...next, newItem];
          }
        } else if (eventType === 'UPDATE') {
          next = next.map(s => s.id === newItem.id ? { ...s, ...newItem } : s);
        } else if (eventType === 'DELETE') {
          // Match by internal UUID (supabaseId) or displayed ID
          next = next.filter(s => s.supabaseId !== oldItem.id && s.id !== oldItem.id);
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

