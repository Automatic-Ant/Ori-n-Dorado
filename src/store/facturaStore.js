import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';

const STORAGE_KEY = 'orion_facturas_proveedores';

export const useFacturaStore = create((set, get) => ({
  facturas: [],
  isLoadingFacturas: true,

  initFacturas: async () => {
    set({ isLoadingFacturas: true });
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) set({ facturas: JSON.parse(local) });

    try {
      const live = await supabaseService.getAllFacturasProveedores();
      set({ facturas: live });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(live));
    } catch (e) {
      console.error('Error loading facturas from Supabase:', e);
    }
    set({ isLoadingFacturas: false });
  },

  addFactura: async (formData) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      proveedor: formData.proveedor,
      fecha: formData.fecha,
      descripcion: formData.descripcion || '',
      imagen_url: URL.createObjectURL(formData.imageFile),
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const updated = [optimistic, ...state.facturas];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { facturas: updated };
    });

    try {
      const saved = await supabaseService.addFacturaProveedor(formData);
      set((state) => {
        const updated = state.facturas.map(f => f.id === tempId ? saved : f);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return { facturas: updated };
      });
    } catch (e) {
      console.error('Error saving factura:', e);
      set((state) => {
        const rolled = state.facturas.filter(f => f.id !== tempId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rolled));
        return { facturas: rolled };
      });
      throw e;
    }
  },

  deleteFactura: async (id, imagenUrl) => {
    const previous = get().facturas;
    set((state) => {
      const updated = state.facturas.filter(f => f.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { facturas: updated };
    });

    try {
      await supabaseService.deleteFacturaProveedor(id, imagenUrl);
    } catch (e) {
      console.error('Error deleting factura:', e);
      set({ facturas: previous });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
      throw e;
    }
  },
}));
