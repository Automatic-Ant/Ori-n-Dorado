import { supabase } from '../lib/supabase';
import { useProductStore } from '../store/productStore';
import { useCustomerStore } from '../store/customerStore';
import { useSaleStore } from '../store/saleStore';
import { useCajaStore } from '../store/cajaStore';

let subscription = null;

export const realtimeService = {
  subscribe: () => {
    if (subscription) return;

    subscription = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        useProductStore.getState().handleRealtimeEvent(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        useCustomerStore.getState().handleRealtimeEvent(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        useSaleStore.getState().handleRealtimeEvent({ ...payload, table: 'sales' });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_notes' }, (payload) => {
        useSaleStore.getState().handleRealtimeEvent({ ...payload, table: 'credit_notes' });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_movements' }, (payload) => {
        useCajaStore.getState().handleRealtimeEvent(payload);
      })
      .subscribe();

    console.log('[Realtime] Subscribed to all table changes');
  },

  unsubscribe: () => {
    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
      console.log('[Realtime] Unsubscribed');
    }
  }
};
