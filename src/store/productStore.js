import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';

// Defer localStorage writes off the main thread so they don't block renders
let _lsTimer = null;
function scheduleSave(products) {
  if (_lsTimer) clearTimeout(_lsTimer);
  _lsTimer = setTimeout(() => {
    try { localStorage.setItem('orion_products', JSON.stringify(products)); } catch (_) {}
  }, 300);
}

export const useProductStore = create((set, get) => ({
  products: [],
  isLoadingProducts: true,
  
  setProducts: (items) => {
    const validItems = items.filter(p => p.name && p.name.trim() !== '');
    set({ products: validItems });
  },
  
  setIsLoading: (status) => set({ isLoadingProducts: status }),

  initProducts: async () => {
    set({ isLoadingProducts: true });

    try {
      const localRaw = localStorage.getItem('orion_products');
      const localProducts = localRaw ? JSON.parse(localRaw) : [];

      const liveProducts = await supabaseService.getAllProducts();

      if (!liveProducts) {
        // Supabase falló → usar cache local
        if (localProducts.length) set({ products: localProducts });
      } else if (liveProducts.length > localProducts.length) {
        // Supabase tiene MÁS productos (p.ej. importados desde otro dispositivo)
        set({ products: liveProducts });
        localStorage.setItem('orion_products', JSON.stringify(liveProducts));
      } else {
        // Local tiene igual o más productos → confiar en local (puede tener ediciones recientes)
        // Esto evita que un reload sobreescriba ediciones que ya se guardaron localmente
        if (localProducts.length > 0) {
          set({ products: localProducts });
        } else {
          set({ products: liveProducts });
          localStorage.setItem('orion_products', JSON.stringify(liveProducts));
        }
        // Sincronizar a Supabase los productos que faltan
        const liveCodeSet = new Set(liveProducts.map(lp => lp.code));
        const missingInSupabase = localProducts.filter(p => !liveCodeSet.has(p.code));
        for (const p of missingInSupabase) {
          try { await supabaseService.addProduct(p); } catch (e) { /* ignora duplicados */ }
        }
      }
    } catch (error) {
      console.error('Failed to init products:', error);
      const localRaw = localStorage.getItem('orion_products');
      if (localRaw) set({ products: JSON.parse(localRaw) });
    }

    set({ isLoadingProducts: false });
  },

  bulkAddProducts: async (productList, onProgress) => {
    const result = await supabaseService.bulkAddProducts(productList, onProgress);

    // Merge imported products into current state, sorted alphabetically.
    // Keeps existing UUID when available; uses temp ID otherwise (resolved on next reload).
    set((state) => {
      const byCode = new Map(state.products.map(p => [p.code, p]));
      for (const p of productList) {
        const existing = byCode.get(p.code);
        byCode.set(p.code, { ...p, id: existing?.id || `temp-${p.code}` });
      }
      const next = [...byCode.values()].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es')
      );
      try { localStorage.setItem('orion_products', JSON.stringify(next)); } catch (_) {}
      return { products: next };
    });

    onProgress?.(100);
    return result;
  },

  addProduct: async (product) => {
    const tempId = `temp-${Date.now()}`;
    const newProduct = { ...product, id: tempId };
    
    // Optimistic UI update
    set((state) => {
      const updatedProducts = [...state.products, newProduct];
      return { products: updatedProducts };
    });
    
    // Sync to Supabase
    try {
      await supabaseService.addProduct(product);
      // Re-fetch to get the proper UUID from DB
      const updatedList = await supabaseService.getAllProducts();
      if (updatedList) {
        set({ products: updatedList });
        localStorage.setItem('orion_products', JSON.stringify(updatedList));
      }
    } catch (error) {
       console.error('Error adding product:', error);
    }
  },

  updateProduct: async (id, updatedProduct, originalCode) => {
    const previousProducts = get().products;

    // 1. Optimistic local update
    let nextProducts;
    set((state) => {
      nextProducts = state.products.map(p => p.id === id ? { ...p, ...updatedProduct } : p);
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);

    // 2. Sync to Supabase
    try {
      await supabaseService.updateProduct(id, updatedProduct, originalCode);
    } catch (e) {
      console.error('Update Product Error, rolling back:', e);
      set({ products: previousProducts });
      scheduleSave(previousProducts);
      throw e;
    }
  },

  deleteProduct: async (id) => {
    const previousProducts = get().products;

    // 1. Optimistic Update
    let nextProducts;
    set((state) => {
      nextProducts = state.products.filter(p => p.id !== id);
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);

    // 2. Sync to Supabase
    try {
      await supabaseService.deleteProduct(id);
    } catch (e) {
      console.error('Delete Product Error, rolling back:', e);
      set({ products: previousProducts });
      scheduleSave(previousProducts);
    }
  },

  decreaseStock: (itemsToDecrease) => {
    let nextProducts;
    set((state) => {
      nextProducts = state.products.map(p => {
        const soldItem = itemsToDecrease.find(item => item.id === p.id);
        if (soldItem) return { ...p, stock: Math.max(0, p.stock - soldItem.quantity) };
        return p;
      });
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);
  },

  increaseStock: (itemsToIncrease) => {
    let nextProducts;
    set((state) => {
      nextProducts = state.products.map(p => {
        const returnedItem = itemsToIncrease.find(item => item.id === p.id);
        if (returnedItem) return { ...p, stock: p.stock + returnedItem.quantity };
        return p;
      });
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);
  }
}));


