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

      const importedRows = result.rows || [];
      
      set((state) => {
        // Map current products by code
        const byCode = new Map(state.products.map(p => [p.code, p]));
        
        // Update with imported data (this includes the real IDs from Supabase)
        for (const p of importedRows) {
          byCode.set(p.code, p);
        }

        const nextProducts = [...byCode.values()].sort((a, b) => {
          const na = (a.name || '').toUpperCase();
          const nb = (b.name || '').toUpperCase();
          return na < nb ? -1 : na > nb ? 1 : 0;
        });

        // Save immediately to localStorage for maximum persistence
        try { localStorage.setItem('orion_products', JSON.stringify(nextProducts)); } catch (_) {}
        
        console.log(`[Import] Estado actualizado: ${nextProducts.length} productos en store`);
        return { products: nextProducts };
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
      const saved = await supabaseService.addProduct(product);
      if (saved) {
        set((state) => {
          // Replace tempId item with the real one from DB
          const next = state.products.map(p => p.id === tempId ? saved : p);
          try { localStorage.setItem('orion_products', JSON.stringify(next)); } catch (_) {}
          return { products: next };
        });
      }
    } catch (error) {
       console.error('Error adding product:', error);
       // Rollback if needed, but since it's a new product, we can just leave it as temp for now 
       // or remove it. Let's remove it if it failed to persist.
       set(state => ({ products: state.products.filter(p => p.id !== tempId) }));
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
    // Save immediately so a reload mid-flight sees the updated data
    try { localStorage.setItem('orion_products', JSON.stringify(nextProducts)); } catch (_) {}

    // 2. Sync to Supabase
    try {
      const saved = await supabaseService.updateProduct(id, updatedProduct, originalCode);
      if (saved) {
        set((state) => {
          const confirmedList = state.products.map(p => p.id === id ? saved : p);
          try { localStorage.setItem('orion_products', JSON.stringify(confirmedList)); } catch (_) {}
          return { products: confirmedList };
        });
      }
    } catch (e) {
      console.error('Update Product Error, rolling back:', e);
      set({ products: previousProducts });
      try { localStorage.setItem('orion_products', JSON.stringify(previousProducts)); } catch (_) {}
      throw e;
    }
  },

  deleteProduct: async (id, code) => {
    const previousProducts = get().products;

    // 1. Optimistic Update
    let nextProducts;
    set((state) => {
      nextProducts = state.products.filter(p => p.id !== id);
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);

    // 2. Sync to Supabase (falls back to code lookup if id is a temp ID)
    try {
      await supabaseService.deleteProduct(id, code);
    } catch (e) {
      console.error('Delete Product Error, rolling back:', e);
      set({ products: previousProducts });
      scheduleSave(previousProducts);
    }
  },

  decreaseStock: (itemsToDecrease) => {
    let nextProducts;
    set((state) => {
      // Build a map of productId -> totalUnitsToDecrement, resolving package products to their parent
      const decrementMap = new Map();
      for (const item of itemsToDecrease) {
        const product = state.products.find(p => p.id === item.id);
        if (product?.parentProductId) {
          const units = item.quantity * (product.unitsPerPackage || 1);
          decrementMap.set(product.parentProductId, (decrementMap.get(product.parentProductId) || 0) + units);
        } else {
          decrementMap.set(item.id, (decrementMap.get(item.id) || 0) + item.quantity);
        }
      }

      nextProducts = state.products.map(p => {
        const decrement = decrementMap.get(p.id);
        if (decrement) return { ...p, stock: Math.max(0, p.stock - decrement) };
        return p;
      });
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);
  },

  increaseStock: (itemsToIncrease) => {
    let nextProducts;
    set((state) => {
      // Build a map of productId -> totalUnitsToRestore, resolving package products to their parent
      const incrementMap = new Map();
      for (const item of itemsToIncrease) {
        if (item.parentProductId) {
          const units = item.quantity * (item.unitsPerPackage || 1);
          incrementMap.set(item.parentProductId, (incrementMap.get(item.parentProductId) || 0) + units);
        } else {
          // Also check current product state in case parentProductId is set there but not on the item
          const product = state.products.find(p => p.id === item.id);
          if (product?.parentProductId) {
            const units = item.quantity * (product.unitsPerPackage || 1);
            incrementMap.set(product.parentProductId, (incrementMap.get(product.parentProductId) || 0) + units);
          } else {
            incrementMap.set(item.id, (incrementMap.get(item.id) || 0) + item.quantity);
          }
        }
      }

      nextProducts = state.products.map(p => {
        const increment = incrementMap.get(p.id);
        if (increment) return { ...p, stock: p.stock + increment };
        return p;
      });
      return { products: nextProducts };
    });
    scheduleSave(nextProducts);
  }
}));
