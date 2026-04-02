import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  user: null,
  error: null,
  loading: false,

  // Initialize auth state from Supabase
  initAuth: async () => {
    set({ loading: true });
    
    // Check current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session) {
      // Fetch profile for role
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      set({ 
        isAuthenticated: true, 
        user: { ...session.user, ...profile },
        loading: false 
      });
    } else {
      set({ isAuthenticated: false, user: null, loading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({ isAuthenticated: true, user: { ...session.user, ...profile } });
      } else {
        set({ isAuthenticated: false, user: null });
      }
    });
  },

  login: async (username, password) => {
    set({ loading: true, error: null });

    const base = username.trim().toLowerCase().split('@')[0];
    const email = `${base}@orioninterno.local`;

    try {
      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );

      const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

      if (error) {
        set({ error: 'Usuario o contraseña incorrectos', loading: false });
        return false;
      }

      set({ loading: false });
      return true;
    } catch (err) {
      const msg = err.message === 'timeout'
        ? 'Sin respuesta del servidor. Intentá de nuevo.'
        : 'Error al iniciar sesión';
      set({ error: msg, loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('sb-lmxgvxsxffamfbpxvvhh-auth-token');
    set({ isAuthenticated: false, user: null, error: null, loading: false });
    supabase.auth.signOut();
  }
}));

