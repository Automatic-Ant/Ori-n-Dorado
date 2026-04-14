import { create } from 'zustand';
import { getCurrentISO } from '../utils/dateHelpers';
import { supabaseService } from '../services/supabaseService';

const STORAGE_KEY = 'orion_caja_movements';

export const useCajaStore = create((set) => ({
  movements: [],

  initCaja: async () => {
    // Load from localStorage first for instant UI
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) set({ movements: JSON.parse(local) });

    // Then sync from Supabase
    try {
      const live = await supabaseService.getAllCajaMovements();
      if (live) {
        set({ movements: live });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(live));
      }
    } catch (e) {
      console.error('Error loading caja movements from Supabase:', e);
    }
  },

  addMovement: async ({ type, amount, description, sellerName }) => {
    const movement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      amount: Number(amount),
      description: description || '',
      date: getCurrentISO(),
      time: new Date().toLocaleTimeString('es-AR'),
      sellerName: sellerName || '',
    };

    // Optimistic local update
    set((state) => {
      const updated = [movement, ...state.movements];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { movements: updated };
    });

    // Sync to Supabase
    try {
      await supabaseService.addCajaMovement(movement);
    } catch (e) {
      console.error('Error syncing caja movement to Supabase:', e);
    }
  },

  removeMovement: async (id) => {
    // Optimistic local update
    set((state) => {
      const updated = state.movements.filter((m) => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { movements: updated };
    });

    // Sync to Supabase
    try {
      await supabaseService.deleteCajaMovement(id);
    } catch (e) {
      console.error('Error deleting caja movement from Supabase:', e);
    }
  },

  handleRealtimeEvent: (payload) => {
    const { eventType, new: newItem, old: oldItem } = payload;
    set((state) => {
      let next = [...state.movements];
      if (eventType === 'INSERT') {
        if (!next.some(m => m.id === newItem.id)) next = [newItem, ...next];
      } else if (eventType === 'UPDATE') {
        next = next.map(m => m.id === newItem.id ? { ...m, ...newItem } : m);
      } else if (eventType === 'DELETE') {
        next = next.filter(m => m.id !== oldItem.id);
      }
      localStorage.setItem('orion_caja_movements', JSON.stringify(next));
      return { movements: next };
    });
  }
}));
