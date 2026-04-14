import { useState, useMemo } from 'react';
import { calculateCartTotal } from '../../utils/calculateTotals';

export const useCart = () => {
  const [cart, setCart] = useState([]);
  const [customerDni, setCustomerDni] = useState('');

  const addToCart = (product, setError) => {
    const existing = cart.find(item => item.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    if (product.stock <= currentQtyInCart) {
      setError(`Stock insuficiente para ${product.name}`);
      setTimeout(() => setError(null), 3000);
      return false;
    }

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    return true;
  };

  const updateQuantity = (id, delta, product, setError) => {
    const itemInCart = cart.find(item => item.id === id);

    if (delta > 0 && itemInCart.quantity >= product.stock) {
      setError('No hay más stock disponible');
      setTimeout(() => setError(null), 2000);
      return;
    }

    setCart(cart.map(item => {
      if (item.id === id) {
        const u = (product.unit || '').toLowerCase();
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

  const setQuantityDirect = (id, newQty, product, setError) => {
    if (newQty === '') return;

    const u = (product.unit || '').toLowerCase();
    const isMeter = u.includes('metro') || u.includes('mt');

    const parsed = (isMeter || newQty.toString().includes('.')) ? parseFloat(newQty) : parseInt(newQty, 10);

    if (isNaN(parsed) || parsed < 0) return;

    if (parsed > product.stock) {
      setError(`Stock insuficiente. Máximo disponible: ${product.stock}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity: parsed } : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerDni('');
  };

  const total = useMemo(() => calculateCartTotal(cart), [cart]);

  return {
    cart,
    addToCart,
    updateQuantity,
    setQuantityDirect,
    removeFromCart,
    clearCart,
    customerDni,
    setCustomerDni,
    total
  };
};
