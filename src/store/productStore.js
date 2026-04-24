import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';
import { productService } from '../services/productService';

// Defer localStorage writes off the main thread so they don't block renders
let _lsTimer = null;
function scheduleSave(products) {
  if (_lsTimer) clearTimeout(_lsTimer);
  _lsTimer = setTimeout(() => {
    try { localStorage.setItem('orion_products', JSON.stringify(products)); } catch { /* localStorage quota exceeded — ignore */ }
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

      // Mostrar productos cacheados inmediatamente para evitar pantalla vacía
      if (localProducts.length > 0) {
        set({ products: localProducts });
      }

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

      if (_bulkImporting) {
        set({ isLoadingProducts: false });
        return;
      }

      if (liveProducts && liveProducts.length > 0) {
        // Supabase tiene datos: actualizar estado y caché local
        set({ products: liveProducts });
        localStorage.setItem('orion_products', JSON.stringify(liveProducts));
      } else if (liveProducts && liveProducts.length === 0 && localProducts.length === 0) {
        // Ambas fuentes están vacías: la DB está genuinamente sin productos
        set({ products: [] });
      }
      // Si Supabase devuelve vacío pero localStorage tiene datos,
      // conservar el caché local (puede ser un problema de red temporal)
    } catch (error) {
      console.error('Failed to init products:', error);
      // No limpiar el estado en caso de error — conservar lo que haya en caché local
    }

    set({ isLoadingProducts: false });
  },

  bulkAddProducts: async (productList, onProgress) => {
    _bulkImporting = true;

    try {
      const result = await supabaseService.bulkAddProducts(productList, onProgress);

      const importedRows = result.rows || [];
      // Si Supabase devolvió las filas reales (con IDs), usarlas.
      // Si no (error de red, migration no corrida, etc.), usar productList como fallback
      // para que el usuario vea los productos localmente aunque no hayan llegado a la DB.
      const sourceList = importedRows.length > 0 ? importedRows : productList;

      set((state) => {
        const byCode = new Map(state.products.map(p => [p.code, p]));

        for (const p of sourceList) {
          const existing = byCode.get(p.code);
          // Prefer real ID from Supabase; fall back to existing or temp ID
          byCode.set(p.code, { ...p, id: p.id && !p.id.startsWith('temp-') ? p.id : (existing?.id || `temp-${p.code}`) });
        }

        const nextProducts = [...byCode.values()].sort((a, b) => {
          const na = (a.name || '').toUpperCase();
          const nb = (b.name || '').toUpperCase();
          return na < nb ? -1 : na > nb ? 1 : 0;
        });

        try { localStorage.setItem('orion_products', JSON.stringify(nextProducts)); } catch { /* localStorage quota exceeded — ignore */ }
        return { products: nextProducts };
      });

      onProgress?.(100);
      return result;
    } finally {
      _bulkImporting = false;
    }
  },

  addProduct: async (product) => {
    // Note: We no longer handle optimistic stock here if we rely on DB triggers, 
    // but for UI responsiveness we can still keep local state.
    const tempId = `temp-${Date.now()}`;
    const newProduct = { ...product, id: tempId };

    set((state) => ({ products: [...state.products, newProduct] }));

    try {
      const saved = await supabaseService.addProduct(product);
      if (saved) {
        set((state) => {
          const nextProducts = state.products.map(p => p.id === tempId ? saved : p);
          scheduleSave(nextProducts);
          return { products: nextProducts };
        });
      }
    } catch (error) {
       console.error('Error adding product:', error);
       set(state => {
         const nextProducts = state.products.filter(p => p.id !== tempId);
         scheduleSave(nextProducts);
         return { products: nextProducts };
       });
    }
  },

  incrementParentStock: async (parentId, units) => {
    await supabaseService.incrementStock(parentId, units);
    set(state => {
      const nextProducts = state.products.map(p =>
        p.id === parentId ? { ...p, stock: p.stock + units } : p
      );
      scheduleSave(nextProducts);
      return { products: nextProducts };
    });
  },

  updateProduct: async (id, updatedProduct, originalCode) => {
    try {
      const saved = await supabaseService.updateProduct(id, updatedProduct);
      if (saved) {
        set((state) => {
          const nextProducts = state.products.map(p => p.id === id ? saved : p);
          scheduleSave(nextProducts);
          return { products: nextProducts };
        });
      } else {
        // Supabase returned no rows — likely a session or RLS issue
        throw new Error('No se pudo guardar. La sesión puede haber expirado — recargá la página e intentá de nuevo.');
      }
    } catch (e) {
      console.error('Update Product Error:', e);
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
      
      const errorMsg = e.message || '';
      if (errorMsg.includes('foreign key constraint')) {
        alert("No se puede eliminar el producto porque tiene ventas asociadas. Podés editarlo o cambiarle el stock a 0.");
      } else {
        alert("Error al eliminar el producto: " + (e.message || "Error desconocido"));
      }
    }
  },

  // Manual stock manipulation removed. Trusting DB triggers.
  // Realtime handlers from external sources
  handleRealtimeEvent: (payload) => {
    const { eventType, new: newItem, old: oldItem } = payload;
    
    set((state) => {
      let nextProducts = [...state.products];
      
      if (eventType === 'INSERT') {
        if (!nextProducts.some(p => p.id === newItem.id)) {
          nextProducts = [newItem, ...nextProducts];
        }
      } else if (eventType === 'UPDATE') {
        nextProducts = nextProducts.map(p => p.id === newItem.id ? { ...p, ...newItem } : p);
      } else if (eventType === 'DELETE') {
        const deletedId = oldItem?.id;
        if (!deletedId) {
          console.warn('[Realtime] DELETE event received without ID. This is a Supabase config issue, but we will try to sync by reloading if needed.');
          return state;
        }
        // Remove both the product and any of its package presentations
        nextProducts = state.products.filter(p => 
          p.id !== deletedId && p.parentProductId !== deletedId
        );
      }
      
      scheduleSave(nextProducts);
      return { products: nextProducts };
    });
  }
}));
