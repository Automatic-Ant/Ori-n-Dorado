/**
 * PRODUCT SERVICE
 * Centralización de reglas de negocio para productos y stock.
 */

// Categorías canónicas para consistencia
export const CATEGORIES = ['Cables', 'Iluminación', 'Protecciones', 'Cajas', 'Otros'];

export const CATEGORY_MAPPING = {
  'cable':        'Cables',
  'cables':       'Cables',
  'iluminacion':  'Iluminación',
  'iluminación':  'Iluminación',
  'caja':         'Cajas',
  'cajas':        'Cajas',
  'proteccion':   'Protecciones',
  'protección':   'Protecciones',
  'protecciones': 'Protecciones',
  'otros':        'Otros',
  'otro':         'Otros',
};

/**
 * Normaliza una categoría a su nombre estándar.
 */
export function getCanonicalCategory(cat) {
  if (!cat) return 'Otros';
  const key = String(cat).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return CATEGORY_MAPPING[key] || cat;
}

/**
 * Calcula el precio final de un producto basado en sus componentes.
 * Regla: Precio = Código de Precio * Código Base
 */
export function calculateProductPrice(codigoPrecio, baseCode, isCableMetro = false) {
  const cp = parseFloat(codigoPrecio) || 0;
  // Si es cable por metro, el baseCode se ignora (se asume 1)
  const bc = isCableMetro ? 1 : (parseFloat(baseCode) || 0);
  return cp * bc;
}

/**
 * Valida un objeto de producto antes de ser enviado a la base de datos.
 */
export function validateProductData(data) {
  const errors = [];
  
  if (!data.code || String(data.code).trim() === '') {
    errors.push('El código es obligatorio.');
  }
  
  if (!data.name || String(data.name).trim() === '') {
    errors.push('El nombre es obligatorio.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Prepara los datos para ser guardados en Supabase (mappings).
 */
export function prepareProductForDB(product) {
  const isCableMetro = product.category === 'Cables' && product.unit === 'metro';
  const codigoPrecio = Math.max(0, parseFloat(product.codigoPrecio) || 0);
  const baseCode = isCableMetro ? 1 : Math.max(0, parseFloat(product.baseCode) || 0);
  const stock = Math.max(0, Number(product.stock) || 0);
  const minStock = Math.max(0, Number(product.minStock) || 0);
  const listPrice = Math.max(0, parseFloat(product.listPrice) || 0);

  return {
    code: String(product.code || '').trim(),
    name: String(product.name || '').trim(),
    category: getCanonicalCategory(product.category),
    marca: String(product.marca || '').trim(),
    stock,
    min_stock: minStock,
    codigo_precio: codigoPrecio,
    base_code: baseCode,
    price: codigoPrecio * baseCode,
    unit: product.unit || 'unidad',
    list_price: listPrice,
    parent_product_id: product.parentProductId || null,
    units_per_package: Number(product.unitsPerPackage) || 1,
    updated_at: new Date().toISOString()
  };
}

export const productService = {
  getCanonicalCategory,
  calculateProductPrice,
  validateProductData,
  prepareProductForDB,
  CATEGORIES
};
