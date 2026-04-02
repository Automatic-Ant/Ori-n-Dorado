/**
 * Helper to generate current timestamp ISO string.
 * @returns {string} The ISO string for current date/time
 */
export const getCurrentISO = () => new Date().toISOString();

/**
 * Format date for display in Hispanic format (dd/mm/yyyy).
 * @param {string} isoString The ISO string
 * @returns {string} Formatted string
 */
export const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
