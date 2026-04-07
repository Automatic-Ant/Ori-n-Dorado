import { create } from 'zustand';
import { supabaseService } from '../services/supabaseService';

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
        const missingInSupabase = localProducts.filter(p => !liveProducts.find(lp => lp.code === p.code));
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

  bulkAddProducts: async (productList) => {
    const result = await supabaseService.bulkAddProducts(productList);

    // Re-fetch once after all inserts
    const updatedList = await supabaseService.getAllProducts();
    if (updatedList) {
      set({ products: updatedList });
      localStorage.setItem('orion_products', JSON.stringify(updatedList));
    }

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
    set((state) => {
      const updatedProducts = state.products.map(p => p.id === id ? { ...p, ...updatedProduct } : p);
      localStorage.setItem('orion_products', JSON.stringify(updatedProducts));
      return { products: updatedProducts };
    });

    // 2. Sync to Supabase (optimistic update ya quedó en local y localStorage)
    try {
      await supabaseService.updateProduct(id, updatedProduct, originalCode);
    } catch (e) {
      console.error('Update Product Error, rolling back:', e);
      set({ products: previousProducts });
      localStorage.setItem('orion_products', JSON.stringify(previousProducts));
      throw e;
    }
  },

  deleteProduct: async (id) => {
    const previousProducts = get().products;

    // 1. Optimistic Update
    set((state) => {
      const updatedProducts = state.products.filter(p => p.id !== id);
      localStorage.setItem('orion_products', JSON.stringify(updatedProducts));
      return { products: updatedProducts };
    });

    // 2. Sync to Supabase
    try {
      await supabaseService.deleteProduct(id);
    } catch (e) {
      console.error('Delete Product Error, rolling back:', e);
      set({ products: previousProducts });
      localStorage.setItem('orion_products', JSON.stringify(previousProducts));
    }
  },

  decreaseStock: (itemsToDecrease) => {
    set((state) => {
      const newProductsState = state.products.map(p => {
        const soldItem = itemsToDecrease.find(item => item.id === p.id);
        if (soldItem) {
          const newStock = Math.max(0, p.stock - soldItem.quantity);
          return { ...p, stock: newStock };
        }
        return p;
      });
      localStorage.setItem('orion_products', JSON.stringify(newProductsState));
      return { products: newProductsState };
    });
  },

  increaseStock: (itemsToIncrease) => {
    set((state) => {
      const newProductsState = state.products.map(p => {
        const returnedItem = itemsToIncrease.find(item => item.id === p.id);
        if (returnedItem) {
          const newStock = p.stock + returnedItem.quantity;
          return { ...p, stock: newStock };
        }
        return p;
      });
      localStorage.setItem('orion_products', JSON.stringify(newProductsState));
      return { products: newProductsState };
    });
  }
}));


