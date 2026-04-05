import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/authStore';
import { LogOut, Menu } from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <header className="top-header glass">
          <div className="header-left-group">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Menú">
              <Menu size={22} />
            </button>
            <span className="current-date">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user?.name || 'Invitado'}</span>
              <span className="user-role">{user?.role === 'admin' ? 'Administrador' : 'Vendedor'}</span>
            </div>
            <button className="logout-btn" onClick={logout} title="Cerrar Sesión">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-container">
          {children}
        </div>
      </main>

      <style jsx>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background-image: linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('/bg.png');
          background-size: cover;
          background-attachment: fixed;
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          z-index: 150;
          backdrop-filter: blur(2px);
        }

        .main-content {
          flex: 1;
          margin-left: 260px;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .top-header {
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 90;
        }

        .header-left-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .hamburger-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: white;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .hamburger-btn:hover {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
        }

        .current-date {
          text-transform: capitalize;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-align: right;
        }

        .logout-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(231, 76, 60, 0.3);
          background: rgba(231, 76, 60, 0.05);
          color: var(--error);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .logout-btn:hover {
          background: var(--error);
          color: white;
          border-color: var(--error);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        }

        .page-container {
          padding: 2rem;
          flex: 1;
        }

        @media (max-width: 1600px) {
          .main-content {
            margin-left: 240px;
          }
        }

        @media (max-width: 1366px) {
          .main-content {
            margin-left: 210px;
          }
          .top-header {
            height: 56px;
            padding: 0 1.25rem;
          }
          .page-container {
            padding: 1.25rem;
          }
          .current-date {
            font-size: 0.8rem;
          }
          .user-name {
            font-size: 0.85rem;
          }
          .user-role {
            font-size: 0.7rem;
          }
          .logout-btn {
            width: 34px;
            height: 34px;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
          }
          .top-header {
            height: 56px;
            padding: 0 1rem;
          }
          .page-container {
            padding: 1rem;
          }
          .hamburger-btn {
            display: flex;
          }
          .current-date {
            font-size: 0.75rem;
            /* On very small screens hide the long date */
          }
          .user-info {
            display: none;
          }
          .logout-btn {
            width: 36px;
            height: 36px;
          }
        }

        @media (max-width: 400px) {
          .current-date {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
