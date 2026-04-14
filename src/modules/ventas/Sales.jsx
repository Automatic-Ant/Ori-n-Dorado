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
  Wallet,
  ArrowRightLeft,
  CheckCircle,
  X,
  ShoppingCart,
  AlertTriangle,
  Wallet2,
  GitBranch,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductStore } from '../../store/productStore';
import { useSaleStore } from '../../store/saleStore';
import { useAuthStore } from '../../store/authStore';
import { useCustomerStore } from '../../store/customerStore';
import { useCart } from './useCart';
import { formatCurrency } from '../../utils/formatCurrency';
import { getCurrentISO } from '../../utils/dateHelpers';
import { generateQuotePDF } from './generateQuotePDF';
import { matchProduct } from '../../utils/searchHelpers';
import { useDeferredValue } from 'react';

const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo', Icon: Banknote },
  { key: 'QR', label: 'QR', Icon: QrCode },
  { key: 'debito', label: 'Débito', Icon: Wallet },
  { key: 'tarjeta', label: 'Tarjeta', Icon: CreditCard },
  { key: 'transferencia', label: 'Transf.', Icon: ArrowRightLeft },
];

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

const Sales = () => {
  const products = useProductStore((state) => state.products);
  const user = useAuthStore((state) => state.user);
  const decreaseStock = useProductStore((state) => state.decreaseStock);
  const addSale = useSaleStore((state) => state.addSale);
  const customers = useCustomerStore((state) => state.customers);
  const deductCredit = useCustomerStore((state) => state.deductCredit);

  const {
    cart,
    addToCart,
    updateQuantity,
    setQuantityDirect,
    removeFromCart,
    clearCart,
    customerDni,
    setCustomerDni,
    total,
  } = useCart();

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [searchResults, setSearchResults] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [applyCredit, setApplyCredit] = useState(false);

  // Split payment state
  // splits[0].amount: monto que paga con el método 0 (user-editable, null = auto)
  // splits[1]: método secundario, monto auto = remainder
  const [splits, setSplits] = useState([{ method: 'efectivo', amount: null }]);
  const [discountPct, setDiscountPct] = useState(10);

  const searchInputRef = useRef(null);

  const hasTwoSplits = splits.length === 2;

  // Customer credit lookup
  const matchedCustomer = customers.find(
    (c) => customerDni && (c.dni === customerDni || c.name.toLowerCase() === customerDni.toLowerCase())
  );
  const availableCredit = matchedCustomer?.creditBalance || 0;

  useEffect(() => {
    if (availableCredit === 0) setApplyCredit(false);
  }, [availableCredit]);

  // ── Calculation ──────────────────────────────────────────────
  // 1. Apply credit first
  const creditUsed = applyCredit ? Math.min(availableCredit, total) : 0;
  const afterCredit = total - creditUsed;

  // 2. Split base amounts (before discount)
  const split0Base = hasTwoSplits ? (splits[0].amount ?? 0) : afterCredit;
  const split1Base = hasTwoSplits ? Math.max(0, afterCredit - split0Base) : 0;

  // 3. Find efectivo portion
  const efectivoIdx = splits.findIndex(s => s.method === 'efectivo');
  const cashBase = efectivoIdx === 0 ? split0Base : efectivoIdx === 1 ? split1Base : 0;
  const hasEfectivo = efectivoIdx !== -1;

  // 4. Apply discount only to cash portion
  let cashFinal = cashBase;
  let discount = 0;
  if (discountPct > 0 && cashBase > 0) {
    const discounted = cashBase * (1 - discountPct / 100);
    const rounded = Math.round(discounted);
    const mod = rounded % 100;
    cashFinal = mod <= 50 ? rounded - mod : rounded + (100 - mod);
    discount = cashBase - cashFinal;
  }

  const nonCashBase = (split0Base + split1Base) - cashBase;
  const finalTotal = cashFinal + nonCashBase;

  // Actual amounts charged per split (after discount applied to cash)
  const split0Final = splits[0].method === 'efectivo' ? cashFinal
    : splits[0].method !== 'efectivo' && efectivoIdx === 1 ? split0Base
    : split0Base;
  const split1Final = splits.length === 2
    ? (splits[1].method === 'efectivo' ? cashFinal : split1Base)
    : 0;

  // ── Split helpers ─────────────────────────────────────────────
  const setSplitMethod = (index, method) => {
    const newSplits = splits.map((s, i) => i === index ? { ...s, method } : s);
    setSplits(newSplits);
    const newHasEfectivo = newSplits.some(s => s.method === 'efectivo');
    if (!newHasEfectivo) setDiscountPct(0);
    else if (discountPct === 0) setDiscountPct(10);
  };

  const setSplitAmount = (val) => {
    const raw = val.replace(/\./g, '').replace(',', '');
    const parsed = parseInt(raw, 10);
    setSplits(prev => [{ ...prev[0], amount: isNaN(parsed) ? null : parsed }, prev[1]]);
  };

  const addSecondSplit = () => {
    const defaultSecond = splits[0].method === 'debito' ? 'QR' : 'debito';
    setSplits(prev => [...prev, { method: defaultSecond, amount: null }]);
  };

  const removeSecondSplit = () => {
    setSplits(prev => [{ ...prev[0], amount: null }]);
  };

  // ── Search ────────────────────────────────────────────────────
  useEffect(() => {
    if (deferredSearch.trim().length >= 2) {
      const results = products.filter(p => matchProduct(p, deferredSearch));
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [deferredSearch, products]);

  const handleAddToCart = (product) => {
    if (addToCart(product, setError)) {
      setSearchTerm('');
      searchInputRef.current?.focus();
    }
  };

  const handleUpdateQuantity = (id, delta) => {
    const product = products.find(p => p.id === id);
    updateQuantity(id, delta, product, setError);
  };

  const handleSetQuantity = (id, value) => {
    const product = products.find(p => p.id === id);
    setQuantityDirect(id, value, product, setError);
  };

  // ── Checkout ──────────────────────────────────────────────────
  const handleCheckout = () => {
    if (cart.length === 0) return;

    const paymentMethodStr = splits.map(s => s.method).join('+');
    const paymentSplits = hasTwoSplits
      ? [
          { method: splits[0].method, amount: split0Final },
          { method: splits[1].method, amount: split1Final }
        ]
      : [{ method: splits[0].method, amount: finalTotal }];

    const saleData = {
      items: cart,
      subtotal: total,
      discount: creditUsed + discount,
      discountPct,
      total: finalTotal,
      customerDni,
      paymentMethod: paymentMethodStr,
      paymentSplits,
      timestamp: getCurrentISO(),
      sellerName: user?.name || 'Desconocido'
    };

    addSale(saleData, decreaseStock);

    if (creditUsed > 0 && matchedCustomer) {
      deductCredit(matchedCustomer.id, creditUsed);
    }

    setIsSuccess(true);
    setApplyCredit(false);
    setSplits([{ method: 'efectivo', amount: null }]);
    setDiscountPct(10);

    setTimeout(() => {
      setIsSuccess(false);
      clearCart();
    }, 3000);
  };

  const handleQuote = () => {
    if (cart.length === 0) return;
    generateQuotePDF({ cart, total, discount, discountPct, finalTotal, customerDni });
  };

  return (
    <div className="sales-container">
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

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-toast"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <AlertTriangle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="results-container">
          <AnimatePresence>
            {searchResults.map((product) => {
              if (!product.name || product.name.trim() === '') return null;
              return (
                <motion.div
                  key={product.id}
                  className={`product-result-item ${product.stock <= 0 ? 'out-of-stock' : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => product.stock > 0 && handleAddToCart(product)}
                >
                  <div className="prod-main">
                    <div className="prod-code-row">
                      <span className="prod-code">{product.code}</span>
                      {product.marca && <span className="prod-marca">{product.marca}</span>}
                    </div>
                    <span className="prod-name">{product.name}</span>
                  </div>
                  <div className="prod-extra">
                    <span className={`prod-stock ${product.stock < 10 ? 'low' : ''}`}>Stock: {product.stock}</span>
                    <span className="prod-price">{formatCurrency(product.price)}</span>
                    <button className="btn-add" disabled={product.stock <= 0}><Plus size={16} /></button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="cart-section card glass">
        <div className="cart-header">
          <h3>Carrito de Venta</h3>
          <span className="item-count">{cart.length} productos</span>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={48} />
              <p>El carrito está vacío</p>
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
                    <button onClick={() => handleUpdateQuantity(item.id, -1)}><Minus size={14} /></button>
                    <QuantityInput item={item} products={products} handleSetQuantity={handleSetQuantity} />
                    <button onClick={() => handleUpdateQuantity(item.id, 1)}><Plus size={14} /></button>
                  </div>
                  <span className="cart-item-subtotal">{formatCurrency(item.price * item.quantity)}</span>
                  <button className="btn-remove" onClick={() => removeFromCart(item.id)}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="cart-footer">
          {/* Customer DNI */}
          <div className="customer-input">
            <User size={18} />
            <input
              type="text"
              placeholder="DNI Cliente (Opcional)"
              value={customerDni}
              onChange={(e) => setCustomerDni(e.target.value)}
            />
          </div>

          {/* Payment section */}
          <div className="payment-section">
            {/* Split 0 */}
            <div className="split-row">
              <div className="split-method-btns">
                {PAYMENT_METHODS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    className={`pay-btn ${splits[0].method === key ? 'active' : ''}`}
                    onClick={() => setSplitMethod(0, key)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {hasTwoSplits && (
                <div className="split-amount-row">
                  <span className="split-amount-label">Monto {splits[0].method === 'efectivo' ? 'efectivo' : splits[0].method}:</span>
                  <div className="split-amount-input">
                    <span className="currency-sign">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={splits[0].amount ?? ''}
                      onChange={(e) => setSplitAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Discount (only when efectivo is involved) */}
            {hasEfectivo && (
              <div className="discount-selector">
                <label className="discount-label">Desc. efectivo</label>
                <div className="discount-presets">
                  {[0, 5, 10, 15, 20].map(pct => (
                    <button
                      key={pct}
                      className={`discount-preset-btn ${discountPct === pct ? 'active' : ''}`}
                      onClick={() => setDiscountPct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="discount-custom-input">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPct}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                      setDiscountPct(val);
                    }}
                  />
                  <span className="discount-pct-symbol">%</span>
                </div>
              </div>
            )}

            {/* Add / Remove second split */}
            {!hasTwoSplits ? (
              <button className="add-split-btn" onClick={addSecondSplit}>
                <GitBranch size={14} />
                Combinar con otro método de pago
              </button>
            ) : (
              <div className="split-row split-row-secondary">
                <div className="split-method-btns">
                  {PAYMENT_METHODS.filter(m => m.key !== splits[0].method).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      className={`pay-btn ${splits[1].method === key ? 'active' : ''}`}
                      onClick={() => setSplitMethod(1, key)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="split-secondary-info">
                  <span className="split-remainder-label">Resto:</span>
                  <span className="split-remainder-amount">{formatCurrency(split1Base)}</span>
                  <button className="remove-split-btn" onClick={removeSecondSplit} title="Quitar segundo método">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {availableCredit > 0 && (
              <div className="summary-row credit-row">
                <div className="credit-label">
                  <Wallet2 size={14} />
                  <span>Saldo a favor ({matchedCustomer.name})</span>
                </div>
                <div className="credit-toggle">
                  <span className="credit-available">{formatCurrency(availableCredit)}</span>
                  <button
                    className={`apply-credit-btn ${applyCredit ? 'applied' : ''}`}
                    onClick={() => setApplyCredit(!applyCredit)}
                  >
                    {applyCredit ? 'Aplicado' : 'Aplicar'}
                  </button>
                </div>
              </div>
            )}

            {creditUsed > 0 && (
              <div className="summary-row credit-used">
                <span>Saldo aplicado</span>
                <span>-{formatCurrency(creditUsed)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="summary-row discount">
                <span>Desc. efectivo ({discountPct}%)</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}

            {hasTwoSplits && finalTotal > 0 && (
              <div className="summary-splits">
                <div className="split-detail-row">
                  <span>{splits[0].method.charAt(0).toUpperCase() + splits[0].method.slice(1)}</span>
                  <span>{formatCurrency(split0Final)}</span>
                </div>
                <div className="split-detail-row">
                  <span>{splits[1].method.charAt(0).toUpperCase() + splits[1].method.slice(1)}</span>
                  <span>{formatCurrency(split1Final)}</span>
                </div>
              </div>
            )}

            <div className="summary-row total">
              <span>TOTAL</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
          </div>

          <div className="checkout-actions">
            <button
              className="btn-secondary quote-btn"
              disabled={cart.length === 0}
              onClick={handleQuote}
            >
              <FileText size={18} />
              Presupuesto
            </button>
            <button
              className="btn-primary checkout-btn"
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              Confirmar Venta
            </button>
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
              <h2>Venta Registrada</h2>
              <p>El stock se ha actualizado automáticamente.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .sales-container {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
          height: calc(100vh - 160px);
        }

        .error-toast {
          background: var(--error);
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
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

        .out-of-stock {
          opacity: 0.4;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .prod-main {
          display: flex;
          flex-direction: column;
        }

        .prod-code-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .prod-code {
          font-size: 0.75rem;
          color: var(--primary-gold);
          font-weight: bold;
        }

        .prod-marca {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .prod-name {
          font-weight: 600;
        }

        .prod-extra {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .prod-stock.low { color: var(--error); font-weight: 700; }

        .prod-price {
          font-weight: 700;
          color: white;
        }

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

        .item-count {
          font-size: 0.85rem;
          color: var(--primary-gold);
        }

        .cart-items {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 1.5rem;
        }

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

        .cart-item-name {
          display: block;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .cart-item-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .stock-available { color: var(--primary-gold); opacity: 0.7; }

        .cart-item-controls {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .quantity-badge {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
        }

        .quantity-badge button {
          background: transparent;
          border: none;
          color: var(--primary-gold);
        }

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

        .qty-input::-webkit-outer-spin-button,
        .qty-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .cart-item-subtotal {
          font-weight: 700;
          width: 80px;
          text-align: right;
        }

        .btn-remove {
          color: var(--error);
          background: transparent;
          border: none;
        }

        .cart-footer {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .customer-input {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface-lighter);
          padding: 0 1rem;
          border-radius: 8px;
        }

        .customer-input input {
          background: transparent;
          border: none;
          width: 100%;
          height: 45px;
        }

        /* ── Payment Section ── */
        .payment-section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          background: var(--surface-lighter);
          padding: 0.75rem;
          border-radius: 12px;
        }

        .split-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .split-method-btns {
          display: flex;
          gap: 0.35rem;
        }

        .pay-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.25rem;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-secondary);
          gap: 0.2rem;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .pay-btn.active {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
          background: rgba(212, 175, 55, 0.12);
        }

        .pay-btn:hover:not(.active) {
          border-color: rgba(212, 175, 55, 0.3);
          color: rgba(255,255,255,0.7);
        }

        .split-amount-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .split-amount-label {
          font-size: 0.78rem;
          color: var(--text-secondary);
          white-space: nowrap;
          text-transform: capitalize;
        }

        .split-amount-input {
          display: flex;
          align-items: center;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0 0.6rem;
          gap: 4px;
          flex: 1;
        }

        .split-amount-input:focus-within {
          border-color: var(--primary-gold);
        }

        .currency-sign {
          color: var(--primary-gold);
          font-weight: 700;
        }

        .split-amount-input input {
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          height: 34px;
          width: 100%;
          padding: 0;
          -moz-appearance: textfield;
        }

        .split-amount-input input::-webkit-outer-spin-button,
        .split-amount-input input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .add-split-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          width: 100%;
          padding: 0.45rem;
          background: transparent;
          border: 1px dashed var(--border-color);
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .add-split-btn:hover {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
        }

        .split-row-secondary {
          border-top: 1px dashed var(--border-color);
          padding-top: 0.5rem;
        }

        .split-secondary-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .split-remainder-label {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .split-remainder-amount {
          font-weight: 700;
          color: white;
          font-size: 0.95rem;
          flex: 1;
        }

        .remove-split-btn {
          background: transparent;
          border: none;
          color: var(--error);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
          opacity: 0.7;
          transition: opacity 0.15s;
        }

        .remove-split-btn:hover { opacity: 1; }

        .discount-selector {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-top: 1px dashed var(--border-color);
          padding-top: 0.6rem;
          flex-wrap: wrap;
        }

        .discount-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .discount-presets {
          display: flex;
          gap: 0.3rem;
          flex: 1;
        }

        .discount-preset-btn {
          flex: 1;
          padding: 0.25rem 0;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }

        .discount-preset-btn.active {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
          background: rgba(212, 175, 55, 0.12);
        }

        .discount-preset-btn:hover:not(.active) {
          border-color: rgba(212, 175, 55, 0.4);
          color: white;
        }

        .discount-custom-input {
          display: flex;
          align-items: center;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0 0.4rem;
          gap: 2px;
        }

        .discount-custom-input input {
          width: 38px;
          height: 28px;
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 0.85rem;
          text-align: center;
          padding: 0;
          -moz-appearance: textfield;
        }

        .discount-custom-input input::-webkit-outer-spin-button,
        .discount-custom-input input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .discount-pct-symbol {
          color: var(--primary-gold);
          font-weight: 700;
          font-size: 0.85rem;
        }

        /* ── Summary ── */
        .cart-summary {
          background: rgba(255, 255, 255, 0.03);
          padding: 0.85rem 1rem;
          border-radius: 10px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .summary-row.discount {
          color: var(--primary-gold);
          font-weight: 600;
          margin-top: 0.2rem;
        }

        .summary-row.credit-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #2ecc71;
          margin-top: 0.35rem;
          padding-top: 0.35rem;
          border-top: 1px dashed rgba(46, 204, 113, 0.3);
          font-size: 0.82rem;
        }

        .credit-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #2ecc71;
        }

        .credit-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .credit-available {
          font-weight: 700;
          font-size: 0.88rem;
        }

        .apply-credit-btn {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #2ecc71;
          background: transparent;
          color: #2ecc71;
          cursor: pointer;
          transition: all 0.15s;
        }

        .apply-credit-btn.applied {
          background: #2ecc71;
          color: #0a0a0a;
        }

        .summary-row.credit-used {
          color: #2ecc71;
          font-weight: 700;
          margin-top: 0.15rem;
        }

        .summary-splits {
          margin-top: 0.4rem;
          padding-top: 0.4rem;
          border-top: 1px dashed var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .split-detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.6);
        }

        .summary-row.total {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border-color);
          color: white;
          font-size: 1.4rem;
          font-weight: 800;
        }

        .checkout-actions {
          display: flex;
          gap: 0.75rem;
        }

        .quote-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          height: 55px;
          padding: 0 1.25rem;
          font-size: 0.95rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .checkout-btn {
          flex: 1;
          height: 55px;
          font-size: 1.1rem;
        }

        .success-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
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

        @media (max-width: 1366px) {
          .sales-container {
            height: calc(100vh - 116px);
            gap: 1.25rem;
          }
        }

        @media (max-width: 1200px) {
          .sales-container {
            grid-template-columns: 1fr;
            height: auto;
          }
          .results-container {
            max-height: 400px;
          }
        }

        @media (max-width: 768px) {
          .sales-container {
            gap: 1rem;
          }
          .search-input-wrapper input {
            font-size: 1rem;
            height: 50px;
          }
          .cart-header h2 {
            font-size: 1rem;
          }
          .results-container {
            max-height: 320px;
          }
        }
      `}</style>
    </div>
  );
};

export default Sales;
