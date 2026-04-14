/**
 * Normalizes text: lowercase, removes accents (NFD normalization).
 */
export const normalizeText = (str) =>
  String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Checks if a product matches a search term using multi-word logic.
 * Every word in the search term must be present in at least one of the searchable fields.
 * 
 * @param {Object} product The product object
 * @param {string} searchTerm The raw search string
 * @returns {boolean} True if the product matches all keywords
 */
export const matchProduct = (product, searchTerm) => {
  const term = normalizeText(searchTerm).trim();
  if (!term) return true;

  const words = term.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  // Build a single searchable string for the product
  const fields = [
    product.name,
    product.code,
    product.category,
    product.marca,
    product.codigoPrecio // Added this just in case they want to search by price code
  ];
  
  const haystack = normalizeText(fields.filter(Boolean).join(' '));
  
  // Compact version (no spaces) to match things like "2x2" with "2 x 2"
  const haystackCompact = haystack.replace(/\s/g, '');

  return words.every(word => {
    const w = normalizeText(word);
    return haystack.includes(w) || haystackCompact.includes(w);
  });
};
