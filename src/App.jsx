import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './modules/metricas/Dashboard';
import Sales from './modules/ventas/Sales';
import Returns from './modules/ventas/Returns';
import Stock from './modules/stock/Stock';
import Customers from './modules/clientes/Customers';
import Quotes from './modules/presupuestos/Quotes';
import Caja from './modules/caja/Caja';
import Login from './modules/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useStoreInitializer } from './store/storeInitializer';

function App() {
  useStoreInitializer();

  return (
    <Router>
      <Routes>
        {/* Ruta Pública: Login */}
        <Route path="/login" element={<Login />} />

        {/* Rutas Protegidas dentro del Layout de la App */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ventas"
          element={
            <ProtectedRoute>
              <Layout>
                <Sales />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute>
              <Layout>
                <Stock />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <Layout>
                <Customers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/devoluciones"
          element={
            <ProtectedRoute>
              <Layout>
                <Returns />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/presupuestos"
          element={
            <ProtectedRoute>
              <Layout>
                <Quotes />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/caja"
          element={
            <ProtectedRoute>
              <Layout>
                <Caja />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

