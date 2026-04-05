import React from 'react';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/authStore';
import { LogOut } from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="top-header glass">
          <div className="search-bar-mock">
            {/* Contextual info or global search could go here */}
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

        .main-content {
          flex: 1;
          margin-left: 260px;
          display: flex;
          flex-direction: column;
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

        .avatar {
          width: 40px;
          height: 40px;
          background: var(--primary-gold);
          color: black;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
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

      `}</style>
    </div>
  );
};

export default Layout;
