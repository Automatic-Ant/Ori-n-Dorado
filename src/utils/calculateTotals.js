/**
 * Calculates the total of a list of items based on their price and quantity.
 * @param {Array} items Array of items with { price, quantity }
 * @returns {number} The total sum
 */
export const calculateCartTotal = (items) => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
};

/**
 * Validates if the requested quantity is available in stock.
 * @param {number} requested Quantity requested
 * @param {number} available Quantity available in stock
 * @returns {boolean} True if available
 */
export const isStockAvailable = (requested, available) => {
  return requested <= available;
};
