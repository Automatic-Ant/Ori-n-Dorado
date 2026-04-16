/**
 * SALE SERVICE
 * Manejo de lógica compleja de ventas: descuentos, pagos combinados y crédito de clientes.
 */

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito (Tarjeta)' },
  { id: 'saldo_favor', label: 'Saldo a Favor' }
];

/**
 * Calcula el desglose de una venta aplicando las reglas del negocio:
 * 1. Sumar ítems (Bruto)
 * 2. Restar Saldo a Favor del cliente (si se elige usar)
 * 3. Aplicar descuento al resto (puede ser general o solo a la parte en efectivo)
 */
export function calculateExpandedSale(params) {
  const {
    items = [],
    discountPct = 0,
    useCustomerCredit = 0,
    paymentSplits = [], // [{ method: 'efectivo', amount: 500 }, ...]
    discountOnlyCash = false
  } = params;

  // 1. Total Bruto de ítems
  const itemsTotal = items.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0);
  
  // 2. Aplicar saldo a favor primero (si el cliente tiene y se quiere usar)
  // El saldo a favor actúa como un "pago anticipado", no como un descuento.
  const subtotalAfterCredit = Math.max(0, itemsTotal - useCustomerCredit);
  
  // 3. Calcular Descuento
  let finalDiscountAmount = 0;
  if (discountPct > 0) {
    if (discountOnlyCash) {
       // Si el descuento es solo por efectivo, necesitamos saber cuánto se paga en efectivo en los splits
       const cashAmount = paymentSplits
         .filter(s => s.method === 'efectivo')
         .reduce((acc, s) => acc + Number(s.amount), 0);
       
       finalDiscountAmount = cashAmount * (discountPct / 100);
    } else {
       // Descuento general sobre el remanente
       finalDiscountAmount = subtotalAfterCredit * (discountPct / 100);
    }
  }

  const finalTotal = subtotalAfterCredit - finalDiscountAmount;

  return {
    itemsTotal,
    subtotalAfterCredit,
    discountAmount: finalDiscountAmount,
    total: finalTotal,
    customerCreditUsed: useCustomerCredit
  };
}

/**
 * Valida que los pagos combinados cubran el total de la venta.
 */
export function validatePayments(total, paymentSplits, customerCreditUsed) {
  const coveredBySplits = paymentSplits.reduce((acc, s) => acc + Number(s.amount), 0);
  const totalPaid = coveredBySplits + customerCreditUsed;
  
  // Margen de error para redondeo de centavos
  return Math.abs(totalPaid - total) < 0.01;
}

export const saleService = {
  calculateExpandedSale,
  validatePayments,
  PAYMENT_METHODS
};
