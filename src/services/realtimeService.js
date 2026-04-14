import { supabase } from '../lib/supabase';
import { useProductStore } from '../store/productStore';
import { useCustomerStore } from '../store/customerStore';
import { useSaleStore } from '../store/saleStore';
import { useCajaStore } from '../store/cajaStore';
import { 
  supabaseService, 
  mapProduct, 
  mapCustomer, 
  mapCajaMovement 
} from './supabaseService';

let subscription = null;

export const realtimeService = {
  subscribe: () => {
    if (subscription) return;

    subscription = supabase
      .channel('db-changes')
      // PRODUCTS: Direct mapping is enough
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        console.log('[Realtime] Product change:', payload.eventType);
        if (payload.new) {
          useProductStore.getState().handleRealtimeEvent({
            ...payload,
            new: mapProduct(payload.new)
          });
        } else {
          useProductStore.getState().handleRealtimeEvent(payload);
        }
      })
      // CUSTOMERS: Full fetch to ensure we have creditBalance and all fields
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, async (payload) => {
        console.log('[Realtime] Customer change:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const fullCustomer = await supabaseService.getCustomerById(payload.new.id);
          if (fullCustomer) {
            useCustomerStore.getState().handleRealtimeEvent({
              ...payload,
              new: fullCustomer
            });
          }
        } else {
          useCustomerStore.getState().handleRealtimeEvent(payload);
        }
      })
      // SALES: MUST FETCH FULL SALE TO GET ITEMS
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload) => {
        console.log('[Realtime] Sale change:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Wait 1 second to ensure sale_items are also inserted before fetching full object
          setTimeout(async () => {
            const fullSale = await supabaseService.getSaleById(payload.new.id);
            if (fullSale) {
              useSaleStore.getState().handleRealtimeEvent({
                ...payload,
                table: 'sales',
                new: fullSale
              });
            }
          }, 1000);
        } else {
          useSaleStore.getState().handleRealtimeEvent({ ...payload, table: 'sales' });
        }
      })
      // CAJA: Direct mapping is enough
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_movements' }, (payload) => {
        console.log('[Realtime] Caja change:', payload.eventType);
        if (payload.new) {
          useCajaStore.getState().handleRealtimeEvent({
            ...payload,
            new: mapCajaMovement(payload.new)
          });
        } else {
          useCajaStore.getState().handleRealtimeEvent(payload);
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Status:', status);
      });

    console.log('[Realtime] Subscribing to all table changes...');
  },

  unsubscribe: () => {
    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
      console.log('[Realtime] Unsubscribed');
    }
  }
};
