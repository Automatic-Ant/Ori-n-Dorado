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

      if (liveProducts && liveProducts.length >= localProducts.length) {
        // Supabase tiene igual o más productos → es la fuente de verdad
        set({ products: liveProducts });
        localStorage.setItem('orion_products', JSON.stringify(liveProducts));
      } else if (liveProducts && liveProducts.length < localProducts.length) {
        // Supabase tiene menos → usar local y sincronizar los faltantes
        set({ products: localProducts });
        for (const p of localProducts) {
          const exists = liveProducts.find(lp => lp.code === p.code);
          if (!exists) {
            try { await supabaseService.addProduct(p); } catch (e) { /* ignora duplicados */ }
          }
        }
        // Refetch tras sync
        const synced = await supabaseService.getAllProducts();
        if (synced) {
          set({ products: synced });
          localStorage.setItem('orion_products', JSON.stringify(synced));
        }
      } else {
        // Supabase falló → usar cache local
        if (localProducts.length) set({ products: localProducts });
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

    // 2. Sync to Supabase
    try {
      await supabaseService.updateProduct(id, updatedProduct, originalCode);
    } catch (e) {
      console.error('Update Product Error, rolling back:', e);
      set({ products: previousProducts });
      localStorage.setItem('orion_products', JSON.stringify(previousProducts));
      throw e;
    }

    // 3. Re-fetch para confirmar que el cambio se guardó en Supabase
    const refreshed = await supabaseService.getAllProducts();
    if (refreshed) {
      set({ products: refreshed });
      localStorage.setItem('orion_products', JSON.stringify(refreshed));
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


