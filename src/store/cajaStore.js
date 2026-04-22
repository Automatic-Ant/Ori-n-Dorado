import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';

const STORAGE_KEY = 'orion_caja_movements';
const DELETED_KEY = 'orion_caja_deleted_ids';

const getDeletedIds = () => new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || '[]'));
const saveDeletedIds = (ids) => localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));

export const useCajaStore = create((set) => ({
  movements: [],

  initCaja: async () => {
    // Load from localStorage first for instant UI
    const local = localStorage.getItem(STORAGE_KEY);
    const localMovements = local ? JSON.parse(local) : [];
    if (localMovements.length) set({ movements: localMovements });

    try {
      const live = await supabaseService.getAllCajaMovements();
      if (live !== null) {
        // Retry any pending deletes that may have failed previously
        const deletedIds = getDeletedIds();
        for (const id of deletedIds) {
          try {
            await supabaseService.deleteCajaMovement(id);
            deletedIds.delete(id);
          } catch {}
        }
        saveDeletedIds(deletedIds);

        // Merge: Supabase is authoritative, but exclude pending deletes
        // and include local items not yet synced (pending inserts)
        const liveFiltered = live.filter((m) => !deletedIds.has(m.id));
        const liveIds = new Set(liveFiltered.map((m) => m.id));
        const pendingLocal = localMovements.filter(
          (m) => !liveIds.has(m.id) && !deletedIds.has(m.id)
        );
        const merged = [...liveFiltered, ...pendingLocal].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        set({ movements: merged });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
    } catch (e) {
      console.error('Error loading caja movements from Supabase:', e);
    }
  },

  addMovement: async ({ type, amount, description, sellerName }) => {
    const now = new Date();
    const movement = {
      id: crypto.randomUUID(),
      type,
      amount: Number(amount),
      description: description || '',
      date: now.toISOString(),
      time: now.toLocaleTimeString('es-AR'),
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
      console.error('[Caja] Error al guardar movimiento en Supabase:', e?.message || e);
    }
  },

  removeMovement: async (id) => {
    // Track deletion intent before optimistic update
    const deletedIds = getDeletedIds();
    deletedIds.add(id);
    saveDeletedIds(deletedIds);

    // Optimistic local update
    set((state) => {
      const updated = state.movements.filter((m) => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { movements: updated };
    });

    // Sync to Supabase
    try {
      await supabaseService.deleteCajaMovement(id);
      // On success, remove from pending deletes tracker
      const confirmed = getDeletedIds();
      confirmed.delete(id);
      saveDeletedIds(confirmed);
    } catch (e) {
      console.error('[Caja] Error al eliminar movimiento en Supabase:', e?.message || e);
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
