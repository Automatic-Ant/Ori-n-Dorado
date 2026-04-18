import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  FileText,
  X
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { useProductStore } from '../store/productStore';

const Sidebar = ({ isOpen, onClose }) => {
  const products = useProductStore((state) => state.products);
  const lowStockCount = useMemo(() => products.filter(p => {
    const stockVal = Number(p.stock) || 0;
    const minStockVal = Number(p.minStock) || 0;
    const pName = p.name ? p.name.toString().trim() : '';
    const pCode = p.code ? p.code.toString().trim() : '';
    if (!pName && !pCode) return false;
    return stockVal <= minStockVal;
  }).length, [products]);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/' },
    { icon: <ShoppingCart size={20} />, label: 'Ventas', path: '/ventas' },
    { icon: <Package size={20} />, label: 'Stock', path: '/stock' },
    { icon: <RotateCcw size={20} />, label: 'Devoluciones', path: '/devoluciones' },
    { icon: <Users size={20} />, label: 'Notas de Crédito', path: '/clientes' },
    { icon: <Wallet size={20} />, label: 'Agregar/Sacar dinero', path: '/caja' },
    { icon: <FileText size={20} />, label: 'Facturas', path: '/facturas' },
  ];

  return (
    <aside className={`sidebar glass${isOpen ? ' open' : ''}`}>
      <div className="sidebar-header">
        <img src="/logo.png" alt="Orion Dorado Logo" className="sidebar-logo" />
        <div className="sidebar-title-group">
          <h1 className="sidebar-title">ORIÓN <span className="gold-text">DORADO</span></h1>
          <p className="sidebar-subtitle">CASA DE ELECTRICIDAD</p>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} title="Cerrar menú">
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/stock"
          state={{ filterLowStock: lowStockCount > 0 }}
          className={`stock-alert-mini ${lowStockCount > 0 ? 'danger' : 'success'}`}
          onClick={onClose}
        >
          {lowStockCount > 0 ? (
            <>
              <AlertTriangle size={16} className="warning-icon" />
              <span>{lowStockCount} productos bajo stock</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} className="success-icon" />
              <span>El stock está al día</span>
            </>
          )}
        </Link>
      </div>

      <style jsx>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          border-right: 1px solid var(--border-color);
          z-index: 100;
        }

        .sidebar-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-bottom: 3rem;
          position: relative;
        }

        .sidebar-close-btn {
          display: none;
          position: absolute;
          top: 0;
          right: 0;
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sidebar-close-btn:hover {
          border-color: var(--error);
          color: var(--error);
        }

        .sidebar-logo {
          width: 80px;
          height: auto;
          filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.3));
        }

        .sidebar-title-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .sidebar-title {
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 2px;
          text-align: center;
          line-height: 1.2;
        }

        .sidebar-subtitle {
          font-size: 0.6rem;
          font-weight: 500;
          letter-spacing: 1.5px;
          color: var(--text-secondary);
          opacity: 0.8;
          text-transform: uppercase;
        }

        .gold-text {
          color: var(--primary-gold);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-item.active {
          background: linear-gradient(90deg, rgba(212, 175, 55, 0.2) 0%, transparent 100%);
          color: var(--primary-gold);
          border-left: 3px solid var(--primary-gold);
        }

        .sidebar-footer {
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .stock-alert-mini {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          padding: 0.85rem;
          border-radius: 12px;
          text-decoration: none;
          transition: all 0.3s ease;
          border: 1px solid transparent;
        }

        .stock-alert-mini.danger {
          color: white;
          background: #e74c3c;
          border-color: #c0392b;
          font-weight: 700;
        }

        .stock-alert-mini.success {
          color: #2ecc71;
          background: rgba(46, 204, 113, 0.1);
          border-color: rgba(46, 204, 113, 0.2);
        }

        .stock-alert-mini:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .warning-icon { animation: pulse 2s infinite; }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        @media (max-width: 1600px) {
          .sidebar {
            width: 240px;
            padding: 1.25rem;
          }
          .sidebar-header {
            margin-bottom: 2rem;
          }
          .sidebar-logo {
            width: 70px;
          }
        }

        @media (max-width: 1366px) {
          .sidebar {
            width: 210px;
            padding: 1rem;
          }
          .sidebar-header {
            gap: 0.6rem;
            margin-bottom: 1.25rem;
          }
          .sidebar-logo {
            width: 54px;
          }
          .sidebar-title {
            font-size: 0.95rem;
            letter-spacing: 1.5px;
          }
          .sidebar-subtitle {
            font-size: 0.55rem;
            letter-spacing: 1px;
          }
          .sidebar-nav {
            gap: 0.25rem;
          }
          .nav-item {
            padding: 0.65rem 0.75rem;
            font-size: 0.9rem;
            gap: 0.75rem;
          }
          .stock-alert-mini {
            padding: 0.65rem;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 280px;
            padding: 1.5rem;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 200;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-close-btn {
            display: flex;
          }
          .sidebar-header {
            margin-bottom: 2rem;
          }
          .sidebar-logo {
            width: 64px;
          }
          .sidebar-title {
            font-size: 1rem;
          }
          .nav-item {
            padding: 0.9rem 1rem;
            font-size: 1rem;
          }
          .sidebar-nav {
            gap: 0.4rem;
          }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
