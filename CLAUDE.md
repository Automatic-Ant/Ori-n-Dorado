# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

No test framework is configured.

## Architecture

This is a React + Vite business management app (inventory & sales) for "Orión Dorado" — an electrical materials retailer. The UI is in Spanish (es-AR locale) with a dark/gold design system.

**Stack:** React 19, React Router 7, Zustand 5, Supabase (PostgreSQL + Auth), Framer Motion, Recharts, Lucide React.

### Layer Structure

```
src/modules/       → Feature UI (ventas, stock, clientes, presupuestos, metricas)
src/store/         → Zustand global state (authStore, productStore, customerStore, saleStore)
src/services/      → supabaseService.js (all DB calls abstracted here)
src/lib/supabase.js → Supabase client singleton
```

### State & Data Flow

- **Local-first with cloud sync**: data is cached in `localStorage` and synced to Supabase in the background.
- **Optimistic UI**: stores update local state immediately before the async Supabase call completes.
- `src/store/storeInitializer.js` bootstraps all stores on app load.
- `supabase_schema.sql` contains the full DB schema including RLS policies and triggers.

### Key Domain Logic

- **Sales (ventas)**: cart managed by `useCart.js` hook; 10% discount applied for cash payments with automatic rounding. Cancelling a sale restores stock.
- **Stock**: uses Supabase RPC `decrement_stock()` for atomic updates.
- **Customers**: have a `credit_balance` adjusted via credit notes (`credit_notes` table).
- **Auth**: Supabase email/password; users have roles (`admin` / `vendedor`) stored in a `profiles` table linked to `auth.users`.

### Routing

`App.jsx` defines all routes. `ProtectedRoute.jsx` guards authenticated pages by checking the Zustand `authStore` session.

### Environment

Supabase credentials are read from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The `.env` file is not committed — create it locally from these variable names.
