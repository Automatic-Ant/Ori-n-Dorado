import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  CreditCard,
  Edit2,
  Trash2,
  Save,
  Receipt,
  FileText,
  AlertCircle,
  PlusCircle,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerStore } from '../../store/customerStore';
import { useSaleStore } from '../../store/saleStore';
import { useProductStore } from '../../store/productStore';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/formatCurrency';

const Customers = () => {
  const customers = useCustomerStore((state) => state.customers);
  const deleteCustomer = useCustomerStore((state) => state.deleteCustomer);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const addCredit = useCustomerStore((state) => state.addCredit);
  
  const creditNotes = useSaleStore((state) => state.creditNotes);
  const addCreditNote = useSaleStore((state) => state.addCreditNote);
  const products = useProductStore((state) => state.products);

  const [activeTab, setActiveTab] = useState('directorio');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [selectedCustomerForCredit, setSelectedCustomerForCredit] = useState(null);
  
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    dni: '',
    phone: '',
    email: '',
    address: '',
    creditBalance: 0
  });

  const [creditFormData, setCreditFormData] = useState({
    product: '',
    quantity: 1,
    reason: '',
    amount: 0
  });

  const filteredCustomers = customers.filter(c => {
    const cName = c.name ? c.name.toString().toLowerCase() : '';
    const cDni = c.dni ? c.dni.toString() : '';
    const term = searchTerm.toLowerCase();
    const matchesSearch = cName.includes(term) || cDni.includes(searchTerm);
    const hasBalance = !onlyWithBalance || (c.creditBalance > 0);
    return matchesSearch && hasBalance;
  });

  const handleOpenCustomerModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerFormData({ ...customer });
    } else {
      setEditingCustomer(null);
      setCustomerFormData({
        name: '',
        dni: '',
        phone: '',
        email: '',
        address: '',
        creditBalance: 0
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleOpenCreditModal = (customer) => {
    setSelectedCustomerForCredit(customer);
    setCreditFormData({
      product: '',
      quantity: 1,
      reason: '',
      amount: 0
    });
    setIsCreditModalOpen(true);
  };

  const handleCustomerSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, customerFormData);
    } else {
      addCustomer(customerFormData);
    }
    setIsCustomerModalOpen(false);
  };

  const handleCreditSubmit = (e) => {
    e.preventDefault();
    if (!creditFormData.product) {
      alert('Por favor selecciona un producto.');
      return;
    }
    
    addCreditNote({
      customer_name: selectedCustomerForCredit.name,
      product: creditFormData.product,
      quantity: creditFormData.quantity,
      amount: creditFormData.amount,
      reason: creditFormData.reason
    });

    addCredit(selectedCustomerForCredit.id, creditFormData.amount);
    setIsCreditModalOpen(false);
  };

  const confirmDelete = (customer) => {
    setCustomerToDelete(customer);
    setIsDeleteModalOpen(true);
  };

  const handleExecuteDelete = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id);
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  };

  return (
    <div className="customers-page">
      <header className="page-header">
        <div className="header-left">
          <h2 className="page-title">Notas de Crédito</h2>
          <p className="page-subtitle">Gestión centralizada de clientes y saldos a favor.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => handleOpenCustomerModal()}>
            <Plus size={20} /> Registrar Cliente
          </button>
        </div>
      </header>

      <div className="tabs card glass">
        <button 
          className={`tab-btn ${activeTab === 'directorio' ? 'active' : ''}`}
          onClick={() => setActiveTab('directorio')}
        >
          <Users size={18} /> Directorio de Clientes
        </button>
        <button 
          className={`tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          <Receipt size={18} /> Historial de Créditos
        </button>
      </div>

      <div className="content-area">
        {activeTab === 'directorio' && (
          <div className="tab-content">
            <div className="search-and-filters">
              <div className="search-bar card glass">
                <Search size={20} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o DNI..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                className={`filter-toggle card glass ${onlyWithBalance ? 'active' : ''}`}
                onClick={() => setOnlyWithBalance(!onlyWithBalance)}
              >
                <Filter size={18} />
                <span>Solo con Saldo</span>
              </button>
            </div>

            <div className="customers-grid">
              <AnimatePresence>
                {filteredCustomers.map((customer) => (
                  <motion.div 
                    key={customer.id} 
                    className="customer-card card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -5 }}
                    layout
                  >
                    <div className="customer-header">
                      <div className="customer-avatar">
                        {(customer.name || 'C').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="customer-main-info">
                        <h3>{customer.name}</h3>
                        <span className="dni-text">DNI: {customer.dni}</span>
                      </div>
                      <div className="customer-actions">
                        <button className="icon-btn edit" onClick={() => handleOpenCustomerModal(customer)} title="Editar"><Edit2 size={16} /></button>
                        <button className="icon-btn delete" onClick={() => confirmDelete(customer)} title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="customer-contact">
                      <div className="contact-item">
                        <Phone size={14} />
                        <span>{customer.phone || 'Sin teléfono'}</span>
                      </div>
                    </div>

                    <div className="customer-balance-section">
                      <div className="balance-info">
                        <span className="balance-label">Saldo a Favor</span>
                        <span className={`balance-amount ${Number(customer.creditBalance) > 0 ? 'positive' : ''}`}>
                          {formatCurrency(Number(customer.creditBalance))}
                        </span>
                      </div>
                      <button 
                        className="btn-secondary mini-btn"
                        onClick={() => handleOpenCreditModal(customer)}
                      >
                        <PlusCircle size={14} /> Nota Crédito
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredCustomers.length === 0 && (
                <div className="empty-state card glass full-width">
                  <Users size={48} className="muted-icon" />
                  <p>No se encontraron clientes que coincidan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="tab-content">
            <div className="card glass recent-notes-card">
              <div className="section-header">
                <h3>Últimas Notas de Crédito Emitidas</h3>
                <span className="badge">{creditNotes.length} registros</span>
              </div>
              <div className="notes-list">
                {creditNotes.length === 0 ? (
                  <div className="empty-list-msg">
                    <FileText size={32} />
                    <p>No hay notas de crédito registradas todavía.</p>
                  </div>
                ) : (
                  creditNotes.map((note, index) => (
                    <div key={note.id || index} className="note-row card glass">
                      <div className="note-main">
                        <div className="note-icon-wrapper">
                          <Receipt size={20} />
                        </div>
                        <div className="note-info">
                          <span className="note-customer-name">{note.customer}</span>
                          <span className="note-date">{new Date(note.date).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>
                      <div className="note-details">
                        <div className="detail-item">
                          <span className="detail-label">Producto</span>
                          <span className="detail-value">{note.product}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Cantidad</span>
                          <span className="detail-value">{note.quantity}u</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Saldo Generado</span>
                          <span className="detail-value text-gold">{formatCurrency(note.amount)}</span>
                        </div>
                      </div>
                      <div className="note-reason">
                        <span className="detail-label">Motivo de devolución</span>
                        <p>{note.reason}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isCustomerModalOpen} 
        onClose={() => setIsCustomerModalOpen(false)} 
        title={editingCustomer ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
      >
        <form className="unified-form" onSubmit={handleCustomerSubmit}>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input type="text" name="name" required value={customerFormData.name} onChange={(e) => setCustomerFormData({...customerFormData, name: e.target.value})} />
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>DNI / CUIT</label>
              <input type="text" name="dni" required value={customerFormData.dni} onChange={(e) => setCustomerFormData({...customerFormData, dni: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" name="phone" value={customerFormData.phone} onChange={(e) => setCustomerFormData({...customerFormData, phone: e.target.value})} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" value={customerFormData.email} onChange={(e) => setCustomerFormData({...customerFormData, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input type="text" name="address" value={customerFormData.address} onChange={(e) => setCustomerFormData({...customerFormData, address: e.target.value})} />
            </div>
          </div>

          <button type="submit" className="btn-primary full-width" style={{ marginTop: '1rem' }}>
            <Save size={20} /> {editingCustomer ? 'Actualizar Cliente' : 'Registrar Cliente'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        title={`Emitir Nota de Crédito: ${selectedCustomerForCredit?.name}`}
      >
        <form className="unified-form" onSubmit={handleCreditSubmit}>
          <div className="form-group">
            <label>Producto Devuelto</label>
            <select 
              required
              value={creditFormData.product}
              onChange={e => setCreditFormData({...creditFormData, product: e.target.value})}
            >
              <option value="">Seleccionar producto...</option>
              {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Cantidad</label>
              <input 
                type="number" 
                min="1"
                required
                value={creditFormData.quantity}
                onChange={e => setCreditFormData({...creditFormData, quantity: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Monto a Favor ($)</label>
              <input 
                type="number" 
                min="0"
                required
                placeholder="0.00"
                value={creditFormData.amount}
                onChange={e => setCreditFormData({...creditFormData, amount: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Motivo de la Devolución</label>
            <textarea 
              rows="3" 
              required
              placeholder="Ej: Producto dañado, error en talle..."
              value={creditFormData.reason}
              onChange={e => setCreditFormData({...creditFormData, reason: e.target.value})}
            ></textarea>
          </div>

          <div className="info-alert card glass">
            <AlertCircle size={18} />
            <p>Este monto se sumará al saldo a favor del cliente para próximas compras.</p>
          </div>

          <button type="submit" className="btn-primary full-width" style={{ marginTop: '1rem' }}>
            <CreditCard size={20} /> Generar Saldo a Favor
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Eliminación"
      >
        <div className="delete-confirm-content" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <AlertTriangle size={48} color="var(--error)" />
          <p>¿Estás seguro de que deseas eliminar a <strong>{customerToDelete?.name}</strong>?</p>
          <p className="delete-warning" style={{ fontSize: '0.85rem', opacity: 0.8 }}>Esta acción no se puede deshacer y el cliente será borrado permanentemente.</p>
          <div className="modal-actions" style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
            <button className="btn-secondary" style={{ flex: 1, padding: '0.8rem', borderRadius: '10px' }} onClick={() => setIsDeleteModalOpen(false)}>Cancelar</button>
            <button className="btn-danger" style={{ flex: 1.5, background: 'var(--error)', border: 'none', color: 'white', fontWeight: 700, padding: '0.8rem', borderRadius: '10px' }} onClick={handleExecuteDelete}>Eliminar Cliente</button>
          </div>
        </div>
      </Modal>

      <style jsx>{`
        .customers-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .tabs {
          display: flex;
          gap: 1rem;
          padding: 0.5rem;
          margin-bottom: -1rem;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 1rem 2rem;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .tab-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }

        .tab-btn.active {
          background: var(--primary-gold);
          color: black;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
        }

        .search-and-filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
        }

        .search-bar input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          outline: none;
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 1.5rem;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-toggle.active {
          background: rgba(212, 175, 55, 0.1);
          border-color: var(--primary-gold);
          color: var(--primary-gold);
        }

        .customers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .customer-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .customer-avatar {
          width: 48px;
          height: 48px;
          background: rgba(212, 175, 55, 0.05);
          border: 1px solid var(--primary-gold);
          color: var(--primary-gold);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
        }

        .customer-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .customer-main-info {
          flex: 1;
        }

        .customer-main-info h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .dni-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .customer-contact {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .customer-balance-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .balance-amount {
          font-size: 1.3rem;
          font-weight: 800;
          display: block;
        }

        .balance-amount.positive {
          color: var(--primary-gold);
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
        }

        .text-gold { color: var(--primary-gold); }

        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .note-row {
          padding: 1.5rem;
          display: grid;
          grid-template-columns: 200px 1fr 200px;
          gap: 2rem;
          align-items: center;
        }

        .note-main {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .note-icon-wrapper {
          width: 40px;
          height: 40px;
          background: rgba(212, 175, 55, 0.1);
          color: var(--primary-gold);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .note-info { display: flex; flex-direction: column; }
        .note-customer-name { font-weight: 700; }
        .note-date { font-size: 0.8rem; color: var(--text-secondary); }
        .note-details { display: flex; gap: 2rem; }
        .detail-item { display: flex; flex-direction: column; }
        .detail-label, .balance-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-value { font-weight: 600; font-size: 0.95rem; }
        .note-reason { border-left: 1px solid var(--border-color); padding-left: 1.5rem; }
        .note-reason p { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary); font-style: italic; }

        .unified-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { font-size: 0.85rem; color: var(--text-secondary); }
        .form-group input, .form-group select, .form-group textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.85rem;
          border-radius: 10px;
          outline: none;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--primary-gold); }

        .info-alert {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(212, 175, 55, 0.05);
          color: var(--primary-gold);
          font-size: 0.85rem;
          border-radius: 10px;
        }

        .full-width { width: 100%; }
        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .icon-btn:hover { border-color: var(--primary-gold); color: var(--primary-gold); }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          opacity: 0.5;
        }

        @media (max-width: 1366px) {
          .customers-grid {
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
          }
          .customer-card {
            padding: 1.1rem;
          }
        }

        @media (max-width: 1100px) {
          .note-row { grid-template-columns: 1fr; gap: 1rem; }
          .note-reason { border-left: none; border-top: 1px solid var(--border-color); padding-top: 1rem; }
        }

        @media (max-width: 768px) {
          .customers-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Customers;
