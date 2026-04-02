import React, { useState } from 'react';
import { Receipt, Search, FileText, AlertCircle, Save, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerStore } from '../../store/customerStore';
import { useProductStore } from '../../store/productStore';
import { useSaleStore } from '../../store/saleStore';

const CreditNotes = () => {
  const customers = useCustomerStore((state) => state.customers);
  const addCredit = useCustomerStore((state) => state.addCredit);
  const products = useProductStore((state) => state.products);
  const addCreditNote = useSaleStore((state) => state.addCreditNote);
  const creditNotes = useSaleStore((state) => state.creditNotes);

  const [formData, setFormData] = useState({
    customer: '',
    product: '',
    quantity: 1,
    reason: '',
    amount: 0
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.customer || !formData.product) {
      alert('Por favor selecciona un cliente y un producto.');
      return;
    }
    // Add Credit Note to History
    addCreditNote({
      customer: formData.customer,
      product: formData.product,
      quantity: formData.quantity,
      amount: formData.amount,
      reason: formData.reason
    });

    // Add Credit to Customer Balance
    addCredit(formData.customer, formData.amount);
    
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setFormData({ customer: '', product: '', quantity: 1, reason: '', amount: 0 });
    }, 3000);
  };

  return (
    <div className="credit-notes-page">
      <header className="page-header">
        <div>
          <h2 className="page-title">Notas de Crédito</h2>
          <p className="page-subtitle">Gestión de devoluciones y saldos a favor.</p>
        </div>
      </header>

      <div className="credit-grid">
        <div className="card glass form-card">
          <h3>Nueva Nota de Crédito</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Cliente</label>
              <select 
                required
                value={formData.customer} 
                onChange={e => setFormData({...formData, customer: e.target.value})}
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map(c => <option key={c.id} value={c.name}>{c.name} (DNI: {c.dni})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Producto</label>
              <select 
                required
                value={formData.product}
                onChange={e => setFormData({...formData, product: e.target.value})}
              >
                <option value="">Seleccionar producto...</option>
                {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Cantidad</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Monto a Acreditar</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  placeholder="$ 0.00"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Motivo de la Devolución</label>
              <textarea 
                rows="3" 
                required
                placeholder="Ej: Producto fallado, error en pedido..."
                value={formData.reason}
                onChange={e => setFormData({...formData, reason: e.target.value})}
              ></textarea>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              <Save size={20} /> Guardar Nota de Crédito
            </button>
          </form>
        </div>

        <div className="card glass list-card">
          <h3>Registros Recientes</h3>
          <div className="recent-list">
            {creditNotes.length === 0 ? (
              <p className="empty-msg" style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>No hay notas de crédito registradas.</p>
            ) : (
              creditNotes.slice(0, 5).map((note, i) => (
                <div key={i} className="receipt-item">
                  <div className="receipt-icon"><Receipt size={20} /></div>
                  <div className="receipt-details">
                    <span className="receipt-customer">{note.customer}</span>
                    <span className="receipt-meta">{new Date(note.date).toLocaleDateString('es-AR')} - {note.product} ({note.quantity}u)</span>
                  </div>
                  <div className="receipt-amount">{formatCurrency(note.amount)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            className="success-toast"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <CheckCircle size={20} />
            <span>Nota de Crédito guardada exitosamente</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .credit-notes-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .credit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        h3 {
          margin-bottom: 1.5rem;
          color: var(--primary-gold);
        }

        .form-group {
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        input, select, textarea {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.75rem;
          border-radius: 8px;
          outline: none;
        }

        textarea { resize: none; }

        input:focus, select:focus, textarea:focus {
          border-color: var(--primary-gold);
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .receipt-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .receipt-icon {
          color: var(--primary-gold);
        }

        .receipt-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .receipt-customer {
          font-weight: 600;
        }

        .receipt-meta {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .receipt-amount {
          font-weight: 700;
          color: var(--success);
        }

        .success-toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: var(--success);
          color: white;
          padding: 1rem 2rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 1000;
        }

        @media (max-width: 1024px) {
          .credit-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CreditNotes;
