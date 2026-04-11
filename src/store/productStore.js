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

// Prevents initProducts from overwriting state during a bulk import
let _bulkImporting = false;

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

      // One-time migration: fix all-caps and singular category names in the DB
      if (!localStorage.getItem('orion_cat_fix_v3')) {
        const fixes = [
          ['ILUMINACION', 'Iluminación'],
          ['CABLE',       'Cables'],
          ['CABLES',      'Cables'],
          ['CAJA',        'Cajas'],
          ['CAJAS',       'Cajas'],
          ['PROTECCION',  'Protecciones'],
          ['PROTECCIONES','Protecciones'],
          ['OTROS',       'Otros'],
          ['OTRO',        'Otros'],
        ];
        await Promise.all(fixes.map(([from, to]) => supabaseService.fixCategoryCase(from, to)));
        localStorage.setItem('orion_cat_fix_v3', '1');
      }

      const liveProducts = await supabaseService.getAllProducts();

      // If a bulk import ran while we were waiting for Supabase,
      // don't overwrite — the import already set the correct state.
      if (_bulkImporting) {
        set({ isLoadingProducts: false });
        return;
      }

      if (liveProducts) {
        // Supabase is always the source of truth
        set({ products: liveProducts });
        localStorage.setItem('orion_products', JSON.stringify(liveProducts));
      } else {
        // Supabase unreachable → fall back to local cache
        if (localProducts.length) set({ products: localProducts });
      }
    } catch (error) {
      console.error('Failed to init products:', error);
      const localRaw = localStorage.getItem('orion_products');
      if (localRaw) set({ products: JSON.parse(localRaw) });
    }

    set({ isLoadingProducts: false });
  },

  bulkAddProducts: async (productList, onProgress) => {
    _bulkImporting = true;

    try {
      const result = await supabaseService.bulkAddProducts(productList, onProgress);

      // Merge into current state sorted alphabetically.
      // Uses existing UUID when available; temp ID resolved on next reload.
      set((state) => {
        const byCode = new Map(state.products.map(p => [p.code, p]));
        for (const p of productList) {
          const existing = byCode.get(p.code);
          byCode.set(p.code, { ...p, id: existing?.id || `temp-${p.code}` });
        }
        const next = [...byCode.values()].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'es')
        );
        console.log(`[Import] Estado actualizado: ${next.length} productos en store`);
        try { localStorage.setItem('orion_products', JSON.stringify(next)); } catch (_) {}
        return { products: next };
      });

      onProgress?.(100);
      return result;
    } finally {
      _bulkImporting = false;
    }
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
