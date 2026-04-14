import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  CreditCard, 
  QrCode, 
  Banknote,
  CheckCircle,
  X,
  ShoppingCart,
  Receipt,
  Download,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductStore } from '../../store/productStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateCartTotal } from '../../utils/calculateTotals';
import { matchProduct } from '../../utils/searchHelpers';
import { useDeferredValue } from 'react';

const QuantityInput = ({ item, products, handleSetQuantity }) => {
  const [localValue, setLocalValue] = React.useState(item.quantity.toString());
  
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
        setLocalValue(item.quantity.toString());
    }
  }, [item.quantity]);
  
  const inputRef = React.useRef(null);
  
  const handleChange = (e) => {
    let val = e.target.value.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(val)) return;
    setLocalValue(val);
    if (val === '' || val === '.') return;
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
       handleSetQuantity(item.id, val);
    }
  };

  const handleBlur = () => {
    setLocalValue(item.quantity.toString());
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className="qty-input"
    />
  );
};

const Quotes = () => {
  const products = useProductStore((state) => state.products);
  
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [searchResults, setSearchResults] = useState([]);
  const [customerDni, setCustomerDni] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [isSuccess, setIsSuccess] = useState(false);

  const searchInputRef = useRef(null);

  // Search logic
  useEffect(() => {
    if (deferredSearch.trim().length >= 2) {
      const results = products.filter(p => matchProduct(p, deferredSearch));
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [deferredSearch, products]);

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        const u = (product?.unit || '').toLowerCase();
        const isMeter = u.includes('metro') || u.includes('mt');
        const adjustedDelta = isMeter ? (delta > 0 ? 0.5 : -0.5) : delta;
        const minVal = isMeter ? 0.5 : 1;
        const currentQty = parseFloat(item.quantity) || 0;
        const newQty = Math.max(minVal, currentQty + adjustedDelta);
        return { ...item, quantity: isMeter ? parseFloat(newQty.toFixed(2)) : Math.round(newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleSetQuantity = (id, value) => {
    if (value === '') return;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    
    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity: parsed } : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsSuccess(true);
  };

  const handleCloseSuccess = () => {
    setIsSuccess(false);
    setCart([]);
    setCustomerDni('');
  };

  // Totals calculation
  const subtotal = calculateCartTotal(cart);
  const isEfectivo = paymentMethod === 'efectivo';
  let finalTotal = subtotal;
  let discount = 0;

  if (isEfectivo) {
    const rawDiscount = subtotal * 0.10;
    const discountedTotal = subtotal - rawDiscount;
    const rounded = Math.round(discountedTotal);
    const mod = rounded % 100;
    finalTotal = mod <= 50 ? rounded - mod : rounded + (100 - mod);
    discount = subtotal - finalTotal;
  }

  return (
    <div className="quotes-container">
      <div className="search-section card glass">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Buscar producto por nombre o código..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="results-container">
          <AnimatePresence>
            {searchResults.map((product) => (
              <motion.div 
                key={product.id}
                className="product-result-item"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => addToCart(product)}
              >
                <div className="prod-main">
                  <span className="prod-code">{product.code}</span>
                  <span className="prod-name">{product.name}</span>
                </div>
                <div className="prod-extra">
                  <span className="prod-price">{formatCurrency(product.price)}</span>
                  <button className="btn-add"><Plus size={16} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="cart-section card glass">
        <div className="cart-header">
          <h3>Carrito de Presupuesto</h3>
          <span className="item-count">{cart.length} productos</span>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={48} />
              <p>El presupuesto está vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <motion.div key={item.id} className="cart-item" layout>
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <div className="cart-item-meta">
                    <span className="cart-item-price">{formatCurrency(item.price)}</span>
                    <span className="stock-available">Disponibles: {products.find(p => p.id === item.id)?.stock}</span>
                  </div>
                </div>
                <div className="cart-item-controls">
                  <div className="quantity-badge">
                    <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                    <QuantityInput 
                      item={item} 
                      products={products} 
                      handleSetQuantity={handleSetQuantity} 
                    />
                    <button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button>
                  </div>
                  <span className="cart-item-subtotal">{formatCurrency(item.price * item.quantity)}</span>
                  <button className="btn-remove" onClick={() => removeFromCart(item.id)}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="customer-input">
            <User size={18} />
            <input 
              type="text" 
              placeholder="DNI / Referencia Cliente" 
              value={customerDni}
              onChange={(e) => setCustomerDni(e.target.value)}
            />
          </div>

          <div className="payment-methods">
            <button 
              className={`pay-btn ${paymentMethod === 'efectivo' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('efectivo')}
            >
              <Banknote size={20} />
              <span>Efectivo</span>
            </button>
            <button 
              className={`pay-btn ${paymentMethod === 'QR' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('QR')}
            >
              <QrCode size={20} />
              <span>QR / Transf.</span>
            </button>
            <button 
              className={`pay-btn ${paymentMethod === 'tarjeta' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('tarjeta')}
            >
              <CreditCard size={20} />
              <span>Tarjeta</span>
            </button>
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row discount">
                <span>Dto. Efectivo (10%)</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>TOTAL</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
          </div>

          <button 
            className="btn-primary checkout-btn" 
            disabled={cart.length === 0}
            onClick={handleCheckout}
          >
            Generar Presupuesto
          </button>
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
            <div className="success-modal card glass" style={{ position: 'relative' }}>
              <button 
                className="close-success-btn" 
                onClick={handleCloseSuccess}
                style={{ 
                  position: 'absolute', 
                  top: '1.5rem', 
                  right: '1.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <X size={24} />
              </button>
              <CheckCircle size={64} style={{ color: '#d4af37' }} />
              <h2>Presupuesto Listo</h2>
              <p>Se ha generado el presupuesto para <strong>{customerDni || 'Cliente'}</strong>.</p>
              <div className="success-actions">
                <button className="btn-secondary"><Printer size={18} /> Imprimir</button>
                <button className="btn-secondary"><Download size={18} /> Descargar PDF</button>
              </div>
              <button className="btn-primary" onClick={handleCloseSuccess} style={{marginTop: '2rem', width: '100%'}}>
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .quotes-container {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
          height: calc(100vh - 160px);
        }

        .search-section {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .search-input-wrapper {
          position: relative;
          margin-bottom: 1rem;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary-gold);
        }

        .search-input-wrapper input {
          width: 100%;
          padding-left: 3rem;
          font-size: 1.1rem;
          height: 60px;
        }

        .results-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-right: 0.5rem;
        }

        .product-result-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .product-result-item:hover {
          background: rgba(212, 175, 55, 0.1);
          border-color: var(--primary-gold);
        }

        .prod-main { display: flex; flex-direction: column; }
        .prod-code { font-size: 0.75rem; color: var(--primary-gold); font-weight: bold; }
        .prod-name { font-weight: 600; }
        .prod-extra { display: flex; align-items: center; gap: 1.5rem; }
        .prod-price { font-weight: 700; color: white; }

        .btn-add {
          background: var(--primary-gold);
          border: none;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          color: black;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cart-section {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }

        .item-count { font-size: 0.85rem; color: var(--primary-gold); }

        .cart-items { flex: 1; overflow-y: auto; margin-bottom: 2rem; }
        .empty-cart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          opacity: 0.5;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          padding: 1rem 0;
          border-bottom: 1px solid #222;
        }

        .cart-item-name { display: block; font-weight: 600; font-size: 0.95rem; }
        .cart-item-meta { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary); }
        .stock-available { color: var(--primary-gold); opacity: 0.7; }

        .cart-item-controls { display: flex; align-items: center; gap: 1.5rem; }
        .quantity-badge {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
        }

        .quantity-badge button { background: transparent; border: none; color: var(--primary-gold); }
        .qty-input {
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          width: 48px;
          text-align: center;
          padding: 0;
          -moz-appearance: textfield;
        }
        .qty-input::-webkit-outer-spin-button, .qty-input::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }

        .cart-item-subtotal { font-weight: 700; width: 80px; text-align: right; }
        .btn-remove { color: var(--error); background: transparent; border: none; }

        .cart-footer { display: flex; flex-direction: column; gap: 1.5rem; }
        .customer-input {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          padding: 0 1rem;
          border-radius: 8px;
        }
        .customer-input input { background: transparent; border: none; width: 100%; height: 45px; }

        .payment-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .pay-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem;
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-secondary);
          gap: 0.25rem;
          cursor: pointer;
        }
        .pay-btn.active { border-color: var(--primary-gold); color: var(--primary-gold); background: rgba(212, 175, 55, 0.1); }

        .cart-summary { background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 10px; }
        .summary-row { display: flex; justify-content: space-between; color: var(--text-secondary); }
        .summary-row.discount { color: var(--primary-gold); font-weight: 600; margin-top: 0.25rem; }
        .summary-row.total {
          margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);
          color: white; font-size: 1.4rem; font-weight: 800;
        }

        .checkout-btn { width: 100%; height: 55px; font-size: 1.1rem; }

        .success-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .success-modal {
          background: var(--surface-color); border: 1px solid var(--primary-gold);
          padding: 3rem; border-radius: 20px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
        }
        .success-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; width: 100%; }
        .btn-secondary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          background: rgba(255,255,255,0.1); border: 1px solid var(--border-color);
          padding: 1rem; border-radius: 10px; color: white; cursor: pointer;
        }

        @media (max-width: 1366px) {
          .quotes-container { height: calc(100vh - 116px); gap: 1.25rem; }
        }

        @media (max-width: 1200px) {
          .quotes-container { grid-template-columns: 1fr; height: auto; }
          .results-container { max-height: 400px; }
        }
      `}</style>
    </div>
  );
};

export default Quotes;
