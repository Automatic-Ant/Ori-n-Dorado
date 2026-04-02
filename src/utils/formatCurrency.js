export const formatCurrency = (value) => {
  const parsedValue = Number(value);
  if (isNaN(parsedValue)) {
    return '$ 0,00';
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(parsedValue);
};
