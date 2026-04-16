import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, CheckCircle, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductStore } from '../../store/productStore';
import { useCustomerStore } from '../../store/customerStore';
import { useSaleStore } from '../../store/saleStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { getCurrentISO } from '../../utils/dateHelpers';
import { supabaseService } from '../../services/supabaseService';
import { matchProduct } from '../../utils/searchHelpers';
import { useDeferredValue } from 'react';
import { productService } from '../../services/productService';
import { saleService } from '../../services/saleService';

const Returns = () => {
  const products = useProductStore((s) => s.products);
  const increaseStock = useProductStore((s) => s.increaseStock);
  const customers = useCustomerStore((s) => s.customers);
  const addCredit = useCustomerStore((s) => s.addCredit);
  const addCreditNote = useSaleStore((s) => s.addCreditNote);
  const creditNotes = useSaleStore((s) => s.creditNotes);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [returnItems, setReturnItems] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const searchResults = useMemo(() => {
    if (deferredSearch.trim().length < 2) return [];
    return products.filter((p) => matchProduct(p, deferredSearch));
  }, [deferredSearch, products]);

  const foundCustomer = useMemo(() => {
    if (customerQuery.length < 2) return null;
    return customers.find(
      (c) =>
        c.dni === customerQuery ||
        c.name.toLowerCase().includes(customerQuery.toLowerCase())
    ) || null;
  }, [customerQuery, customers]);

  const addToReturn = (product) => {
    const existing = returnItems.find((i) => i.id === product.id);
    if (existing) {
      setReturnItems(returnItems.map((i) =>
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setReturnItems([...returnItems, { ...product, quantity: 1 }]);
    }
    setSearchTerm('');
    searchRef.current?.focus();
  };

  const updateQty = (id, delta) => {
    setReturnItems(returnItems.map((i) =>
      i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    ));
  };

  const removeItem = (id) => setReturnItems(returnItems.filter((i) => i.id !== id));

  const resetForm = () => {
    setReturnItems([]);
    setDiscountPct(0);
    setCustomerQuery('');
    setSearchTerm('');
    searchRef.current?.focus();
  };

  // Same rounding logic as the sales cart
  const subtotal = returnItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  let creditAmount = subtotal;
  let discountAmount = 0;
  if (discountPct > 0) {
    const discounted = subtotal * (1 - discountPct / 100);
    const rounded = Math.round(discounted);
    const mod = rounded % 100;
    creditAmount = mod <= 50 ? rounded - mod : rounded + (100 - mod);
    discountAmount = subtotal - creditAmount;
  }

  const handleConfirm = async () => {
    if (returnItems.length === 0) return;
    setIsLoading(true);

    try {
      const customerName = foundCustomer?.name || customerQuery || 'Cliente General';
      const productsSummary = returnItems.map((i) => `${i.name} (x${i.quantity})`).join(', ');

      await Promise.all(
        returnItems.map(item => productService.adjustStock(item.id, item.quantity))
      );

      await addCreditNote({
        customer_name: customerName,
        amount: creditAmount,
        reason: `Devolución: ${productsSummary}`,
        date: getCurrentISO(),
      });

      if (foundCustomer) {
        await addCredit(foundCustomer.name, creditAmount);
      }

      setIsSuccess(true);
      resetForm();
    } catch (e) {
      console.error("Error processing return:", e);
      alert("Error al procesar la devolución. Intente nuevamente.");
    } finally {
      setIsLoading(false);
    }
    
    setTimeout(() => {
      setIsSuccess(false);
    }, 2500);
  };

  return (
    <div className="returns-page">
      <header className="page-header">
        <div>
          <h2 className="page-title">Devoluciones</h2>
          <p className="page-subtitle">Devolvé un producto al stock y acreditá el saldo al cliente.</p>
        </div>
      </header>

      <div className="returns-grid">

        {/* LEFT: Form */}
        <div className="card glass returns-form">

          {/* Product search */}
          <div className="form-section">
            <label className="section-label">Producto a devolver</label>
            <div className="search-wrapper">
              <Search size={16} className="search-icon-inner" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  className="search-results"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {searchResults.map((p) => (
                    <div key={p.id} className="result-item" onClick={() => addToReturn(p)}>
                      <div className="result-left">
                        <span className="result-code">{p.code}</span>
                        <span className="result-name">{p.name}</span>
                      </div>
                      <span className="result-price">{formatCurrency(p.price)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Return items list */}
          {returnItems.length > 0 && (
            <div className="form-section">
              <label className="section-label">Productos a devolver</label>
              <div className="return-items-list">
                {returnItems.map((item) => (
                  <div key={item.id} className="return-item">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-unit-price">{formatCurrency(item.price)} c/u</span>
                    </div>
                    <div className="item-controls">
                      <div className="qty-control">
                        <button onClick={() => updateQty(item.id, -1)}><Minus size={13} /></button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)}><Plus size={13} /></button>
                      </div>
                      <span className="item-subtotal">{formatCurrency(item.price * item.quantity)}</span>
                      <button className="btn-remove-item" onClick={() => removeItem(item.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount */}
          <div className="form-section">
            <label className="section-label">Descuento que tenía la compra original</label>
            <div className="discount-row">
              <div className="discount-presets">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    className={`preset-btn ${discountPct === pct ? 'active' : ''}`}
                    onClick={() => setDiscountPct(pct)}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="discount-custom">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPct}
                  onChange={(e) =>
                    setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="form-section">
            <label className="section-label">Cliente</label>
            <div className="customer-row">
              <User size={16} className="customer-icon" />
              <input
                type="text"
                placeholder="DNI del cliente..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              {foundCustomer && (
                <span className="customer-badge">{foundCustomer.name}</span>
              )}
            </div>
            {!foundCustomer && customerQuery.length >= 2 && (
              <p className="customer-warn">
                Cliente no encontrado. La nota de crédito se registra sin saldo asociado.
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="return-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row summary-discount">
                <span>Descuento ({discountPct}%)</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="summary-row summary-credit">
              <span>Saldo a acreditar</span>
              <span>{formatCurrency(creditAmount)}</span>
            </div>
            {foundCustomer && creditAmount > 0 && (
              <p className="summary-note">
                Se acreditarán <strong>{formatCurrency(creditAmount)}</strong> a <strong>{foundCustomer.name}</strong> para su próxima compra.
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn-primary confirm-btn"
            disabled={returnItems.length === 0 || isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? 'Procesando...' : 'Confirmar Devolución'}
          </button>
        </div>

        {/* RIGHT: Recent credit notes */}
        <div className="card glass credit-history">
          <h3>Devoluciones Recientes</h3>
          <div className="history-list">
            {creditNotes.length === 0 ? (
              <p className="empty-history">No hay devoluciones registradas.</p>
            ) : (
              creditNotes.slice(0, 10).map((note, i) => (
                <div key={i} className="history-item">
                  <div className="history-info">
                    <span className="history-customer">{note.customer_name || note.customer || 'Cliente General'}</span>
                    <span className="history-reason">{note.reason}</span>
                    <span className="history-date">
                      {new Date(note.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="history-amount">{formatCurrency(note.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSuccess && (
          <motion.div
            className="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="success-modal">
              <CheckCircle size={64} color="#d4af37" />
              <h2>Devolución Registrada</h2>
              <p>Stock actualizado. Saldo acreditado al cliente.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .returns-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .page-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-top: 0.25rem;
        }

        .returns-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        .returns-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .section-label {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .search-wrapper {
          position: relative;
        }

        .search-icon-inner {
          position: absolute;
          left: 0.9rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary-gold);
        }

        .search-wrapper input {
          width: 100%;
          padding-left: 2.75rem;
          height: 48px;
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: white;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-wrapper input:focus { border-color: var(--primary-gold); }

        .search-results {
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          overflow: hidden;
          max-height: 220px;
          overflow-y: auto;
        }

        .result-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 0.15s;
        }

        .result-item:hover { background: rgba(212, 175, 55, 0.1); }
        .result-item:last-child { border-bottom: none; }

        .result-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .result-code {
          font-size: 0.7rem;
          color: var(--primary-gold);
          font-weight: 700;
        }

        .result-name { font-weight: 500; font-size: 0.9rem; }
        .result-price { font-weight: 700; }

        .return-items-list {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .return-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .item-name { font-weight: 600; font-size: 0.9rem; }
        .item-unit-price { font-size: 0.75rem; color: var(--text-secondary); }

        .item-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .qty-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--surface-lighter);
          border-radius: 6px;
          padding: 0.25rem 0.5rem;
        }

        .qty-control button {
          background: transparent;
          border: none;
          color: var(--primary-gold);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .qty-control span {
          font-weight: 700;
          min-width: 18px;
          text-align: center;
          font-size: 0.9rem;
        }

        .item-subtotal {
          font-weight: 700;
          min-width: 70px;
          text-align: right;
          font-size: 0.9rem;
        }

        .btn-remove-item {
          background: transparent;
          border: none;
          color: var(--error);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .discount-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          padding: 0.6rem 1rem;
          border-radius: 10px;
        }

        .discount-presets {
          display: flex;
          gap: 0.35rem;
          flex: 1;
        }

        .preset-btn {
          flex: 1;
          padding: 0.35rem 0;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }

        .preset-btn.active {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
          background: rgba(212, 175, 55, 0.12);
        }

        .preset-btn:hover:not(.active) {
          border-color: rgba(212, 175, 55, 0.4);
          color: white;
        }

        .discount-custom {
          display: flex;
          align-items: center;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0 0.5rem;
          gap: 2px;
        }

        .discount-custom input {
          width: 42px;
          height: 30px;
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          text-align: center;
          padding: 0;
          -moz-appearance: textfield;
          outline: none;
        }

        .discount-custom input::-webkit-outer-spin-button,
        .discount-custom input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .discount-custom span { color: var(--primary-gold); font-weight: 700; }

        .customer-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          padding: 0 1rem;
          border-radius: 10px;
          height: 48px;
          transition: border-color 0.2s;
        }

        .customer-row:focus-within { border-color: var(--primary-gold); }
        .customer-icon { color: var(--text-secondary); flex-shrink: 0; }

        .customer-row input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          height: 100%;
          font-size: 0.95rem;
          outline: none;
        }

        .customer-badge {
          font-size: 0.73rem;
          font-weight: 700;
          color: #2ecc71;
          background: rgba(46, 204, 113, 0.12);
          border: 1px solid rgba(46, 204, 113, 0.3);
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .customer-warn {
          font-size: 0.78rem;
          color: #f39c12;
          font-style: italic;
          margin: 0;
        }

        .return-summary {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .summary-discount {
          color: var(--primary-gold);
          font-weight: 600;
        }

        .summary-credit {
          color: #2ecc71;
          font-weight: 800;
          font-size: 1.1rem;
          margin-top: 0.4rem;
          padding-top: 0.4rem;
          border-top: 1px solid var(--border-color);
        }

        .summary-note {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-style: italic;
          margin: 0.25rem 0 0;
        }

        .summary-note strong { color: #2ecc71; font-style: normal; }

        .confirm-error {
          color: var(--error);
          font-size: 0.82rem;
          font-weight: 600;
          background: rgba(231, 76, 60, 0.08);
          border: 1px solid rgba(231, 76, 60, 0.25);
          border-radius: 8px;
          padding: 0.6rem 0.9rem;
          margin: 0;
        }

        .confirm-btn {
          width: 100%;
          height: 54px;
          font-size: 1.05rem;
        }

        /* History panel */
        .credit-history {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .credit-history h3 {
          color: var(--primary-gold);
          font-size: 1.1rem;
          margin: 0;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .empty-history {
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-style: italic;
          text-align: center;
          padding: 2rem;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          gap: 1rem;
        }

        .history-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
          min-width: 0;
        }

        .history-customer {
          font-weight: 700;
          font-size: 0.9rem;
        }

        .history-reason {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-date {
          font-size: 0.72rem;
          color: var(--text-secondary);
          opacity: 0.7;
        }

        .history-amount {
          font-weight: 800;
          font-size: 1rem;
          color: #2ecc71;
          white-space: nowrap;
        }

        /* Success overlay */
        .success-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .success-modal {
          background: var(--surface-color);
          border: 1px solid var(--primary-gold);
          padding: 3rem;
          border-radius: 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        @media (max-width: 1200px) {
          .returns-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Returns;
