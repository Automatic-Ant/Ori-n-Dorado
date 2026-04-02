import { create } from 'zustand';
import { getCurrentISO } from '../utils/dateHelpers';

const STORAGE_KEY = 'orion_caja_movements';

export const useCajaStore = create((set, get) => ({
  movements: [],

  initCaja: () => {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) set({ movements: JSON.parse(local) });
  },

  addMovement: ({ type, amount, description, sellerName }) => {
    const movement = {
      id: Date.now().toString(),
      type,           // 'ingreso' | 'egreso'
      amount: Number(amount),
      description: description || '',
      date: getCurrentISO(),
      time: new Date().toLocaleTimeString('es-AR'),
      sellerName: sellerName || '',
    };

    set((state) => {
      const updated = [movement, ...state.movements];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { movements: updated };
    });
  },

  removeMovement: (id) => {
    set((state) => {
      const updated = state.movements.filter((m) => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { movements: updated };
    });
  },
}));
