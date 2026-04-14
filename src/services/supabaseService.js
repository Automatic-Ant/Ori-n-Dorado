import { supabase } from '../lib/supabase';

// Normaliza variaciones de categoría a un nombre canónico
const CATEGORY_CANONICAL = {
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

export function canonicalCategory(cat) {
  if (!cat) return 'Otros';
  const key = String(cat).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return CATEGORY_CANONICAL[key] || cat;
}

export function mapProduct(item) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    category: canonicalCategory(item.category),
    stock: Number(item.stock),
    codigoPrecio: Number(item.codigo_precio),
    price: Number(item.price),
    baseCode: Number(item.base_code),
    minStock: Number(item.min_stock),
    unit: item.unit,
    marca: item.marca || '',
    listPrice: Number(item.list_price) || 0,
    parentProductId: item.parent_product_id || null,
    unitsPerPackage: Number(item.units_per_package) || 1,
    updatedAt: item.updated_at,
  };
}

export function mapCustomer(c) {
  return {
    id: c.id,
    dni: c.dni,
    name: c.name,
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    category: c.category || 'Bronce',
    creditBalance: Number(c.credit_balance || 0),
  };
}

export function mapSale(sale) {
  return {
    id: sale.external_id || sale.id,
    supabaseId: sale.id,
    date: sale.date,
    time: new Date(sale.date).toLocaleTimeString('es-AR'),
    total: Number(sale.total),
    paymentMethod: sale.payment_method,
    customerDni: sale.customer_dni || '',
    customerName: sale.customer_name || '',
    status: sale.status,
    sellerName: sale.seller_name || '',
    items: (sale.sale_items || []).map(item => ({
      id: item.product_id,
      code: item.product_code,
      name: item.product_name,
      quantity: Number(item.quantity),
      price: Number(item.price),
      subtotal: Number(item.subtotal),
      parentProductId: item.parent_product_id || null,
      unitsPerPackage: Number(item.units_per_package) || 1,
      updatedAt: item.updated_at,
    })),
  };
}

export function mapCajaMovement(m) {
  return {
    id: m.id,
    type: m.type,
    amount: Number(m.amount),
    description: m.description || '',
    date: m.date,
    time: m.time,
    sellerName: m.seller_name || '',
  };
}

export const supabaseService = {
  // PRODUCTS
  async getAllProducts() {
    let allRows = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching products from Supabase:', error);
        throw new Error(`Error Supabase (${error.code}): ${error.message}`);
      }

      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows.map(mapProduct);
  },

  async bulkAddProducts(products, onProgress) {
    const CHUNK = 500;       
    const CONCURRENCY = 3;   
    const TIMEOUT_MS = 60000;
    const RETRY_DELAY_MS = 2000;
    const seen = new Map();
    for (const p of products) {
      if (p.code) seen.set(String(p.code).trim(), p);
    }
    const deduped = [...seen.values()];
    const chunks = [];
    for (let i = 0; i < deduped.length; i += CHUNK) {
      chunks.push(deduped.slice(i, i + CHUNK).map(p => ({
        code:          String(p.code).trim(),
        name:          String(p.name).trim(),
        category:      canonicalCategory(p.category),
        stock:         Number(p.stock) || 0,
        codigo_precio: Number(p.codigoPrecio) || 0,
        price:         Number(p.price) || 0,
        base_code:     Number(p.baseCode) || 0,
        min_stock:     Number(p.minStock) || 0,
        unit:          p.unit  || 'unidad',
        marca:         String(p.marca || ''),
        list_price:    Number(p.listPrice) || 0,
      })));
    }
    const totalChunks = chunks.length;
    let completed = 0;
    let inserted = 0;
    let skipped = 0;
    let firstError = null;
    const allInsertedRows = [];
    const uploadChunk = async (chunk, index) => {
      let attempts = 0;
      let lastErr = null;
      while (attempts < 2) {
        attempts++;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const { data, error } = await supabase
            .from('products')
            .upsert(chunk, { onConflict: 'code' })
            .select();
          clearTimeout(timeout);
          if (error) throw error;
          if (data) allInsertedRows.push(...data);
          inserted += chunk.length;
          lastErr = null;
          break;
        } catch (err) {
          clearTimeout(timeout);
          lastErr = err;
          if (attempts < 2) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }
      if (lastErr) {
        skipped += chunk.length;
        if (!firstError) firstError = lastErr;
        console.error(`[Import] Chunk ${index + 1} falló definitivamente:`, lastErr);
      }
      completed++;
      onProgress?.(Math.round(1 + (completed / totalChunks) * 98));
    };
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const wave = chunks.slice(i, i + CONCURRENCY);
      await Promise.all(wave.map((chunk, j) => uploadChunk(chunk, i + j)));
    }
    return {
      inserted,
      skipped,
      firstError,
      rows: allInsertedRows.map(mapProduct)
    };
  },

  async addProduct(product) {
    const payload = {
        code:          String(product.code || '').trim(),
        name:          String(product.name || '').trim(),
        category:      canonicalCategory(product.category),
        stock:         Number(product.stock) || 0,
        codigo_precio: Number(product.codigoPrecio) || 0,
        price:         Number(product.price) || 0,
        base_code:     Number(product.baseCode) || 0,
        min_stock:     Number(product.minStock) || 0,
        unit:          product.unit || 'unidad',
        marca:         String(product.marca || ''),
        list_price:    Number(product.listPrice) || 0,
        parent_product_id: product.parentProductId || null,
        units_per_package: Number(product.unitsPerPackage) || 1
    };
    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error adding product to Supabase:', error);
      throw error;
    }
    return data ? mapProduct(data[0]) : null;
  },

  async updateProduct(id, productData) {
    const toUpdate = {};
    if (productData.name !== undefined)     toUpdate.name = String(productData.name || '').trim();
    if (productData.category !== undefined) toUpdate.category = canonicalCategory(productData.category);
    if (productData.stock !== undefined)    toUpdate.stock = Number(productData.stock);
    if (productData.price !== undefined)    toUpdate.price = Number(productData.price);
    if (productData.codigoPrecio !== undefined) toUpdate.codigo_precio = Number(productData.codigoPrecio);
    if (productData.baseCode !== undefined) toUpdate.base_code = Number(productData.baseCode);
    if (productData.minStock !== undefined) toUpdate.min_stock = Number(productData.minStock);
    if (productData.unit !== undefined)     toUpdate.unit = productData.unit;
    if (productData.marca !== undefined)    toUpdate.marca = String(productData.marca || '');
    if (productData.listPrice !== undefined) toUpdate.list_price = Number(productData.listPrice);
    if (productData.parentProductId !== undefined) toUpdate.parent_product_id = productData.parentProductId;
    if (productData.unitsPerPackage !== undefined) toUpdate.units_per_package = Number(productData.unitsPerPackage);

    const { data, error } = await supabase
      .from('products')
      .update(toUpdate)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating product in Supabase:', error);
      throw error;
    }
    return data && data.length > 0 ? mapProduct(data[0]) : null;
  },

  async updateProductStock(id, newStock) {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id);
    if (error) console.error('Error updating stock in Supabase:', error);
  },

  async deleteProduct(id, code) {
    try {
      // 1. Primero borramos cualquier "presentación" (pack/caja) que dependa de este producto
      // para evitar errores de integridad si es un producto padre.
      await supabase.from('products').delete().eq('parent_product_id', id);

      // 2. Intentar borrar por ID (UUID)
      const { data: byId, error: errorId } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select('id');

      if (errorId) {
        if (errorId.code === '23503') {
          throw new Error('Este producto tiene ventas registradas y no puede eliminarse por seguridad contable. Sugerencia: Dejalo con stock 0.');
        }
        console.warn('[Supabase] Error al borrar por ID, probando alternativo:', errorId.message);
      }

      if (byId && byId.length > 0) return true;

      // 3. Fallback: Borrar por código
      if (code) {
        const { data: byCode, error: errorCode } = await supabase
          .from('products')
          .delete()
          .eq('code', code)
          .select('id');

        if (errorCode) throw errorCode;
        if (byCode && byCode.length > 0) return true;
      }

      return true;
    } catch (err) {
      console.error('[Supabase Delete] Error crítico:', err);
      throw err;
    }
  },


  async getAllCustomers() {
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) {
      console.error('Error fetching customers from Supabase:', error);
      return null;
    }
    return data ? data.map(mapCustomer) : null;
  },

  async addCustomer(customer) {
    const { data, error } = await supabase
      .from('customers')
      .insert([{
        dni: customer.dni || null,
        name: customer.name,
        email: customer.email || null,
        phone: customer.phone || null,
        address: customer.address || null,
        category: customer.category || 'Bronce',
        credit_balance: customer.creditBalance || 0
      }])
      .select();
    if (error) {
      console.error('Error adding customer to Supabase:', error);
      throw error;
    }
    return data ? mapCustomer(data[0]) : null;
  },

  async updateCustomer(id, customerData) {
    const toUpdate = {};
    if (customerData.dni !== undefined) toUpdate.dni = customerData.dni || null;
    if (customerData.name !== undefined) toUpdate.name = customerData.name;
    if (customerData.email !== undefined) toUpdate.email = customerData.email || null;
    if (customerData.phone !== undefined) toUpdate.phone = customerData.phone || null;
    if (customerData.address !== undefined) toUpdate.address = customerData.address || null;
    if (customerData.creditBalance !== undefined) toUpdate.credit_balance = customerData.creditBalance;

    const { error } = await supabase.from('customers').update(toUpdate).eq('id', id);
    if (error) console.error('Error updating customer in Supabase:', error.message);
  },

  async deleteCustomer(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },

  async getAllSales() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('date', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching sales from Supabase:', error);
        return allRows.length > 0 ? allRows.map(mapSale) : null;
      }
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows.map(mapSale);
  },

  async syncSale(sale) {
    const totalAmount = sale.total;
    const { data: saleRecord, error: saleError } = await supabase
      .from('sales')
      .insert([{
        external_id: sale.id,
        date: sale.date,
        total: totalAmount,
        payment_method: sale.paymentMethod,
        customer_dni: sale.customerDni || '',
        customer_name: sale.customerName || '',
        seller_name: sale.sellerName || '',
        status: 'completada'
      }])
      .select();

    if (saleError) {
      console.error('Error syncing sale to Supabase:', saleError);
      return;
    }
    const saleId = saleRecord[0].id;
    const saleItemsList = sale.items.map(item => ({
      sale_id: saleId,
      product_id: item.id,
      product_code: item.code,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      parent_product_id: item.parent_product_id || null,
      units_per_package: item.unitsPerPackage || 1,
    }));
    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsList);
    if (itemsError) console.error('Error syncing sale items to Supabase:', itemsError);
    for (const item of sale.items) {
        const targetId = item.parentProductId || item.id;
        const qty = item.quantity * (item.unitsPerPackage || 1);
        await supabase.rpc('decrement_stock', { product_id: targetId, qty: qty });
    }
  },

  async updateSaleStatus(saleId, status) {
    const { error } = await supabase.from('sales').update({ status }).eq('external_id', saleId);
    if (error) await supabase.from('sales').update({ status }).eq('id', saleId);
  },

  async incrementStock(productId, quantity) {
    await supabase.rpc('increment_stock', { product_id: productId, qty: quantity });
  },

  async getAllCreditNotes() {
    const { data, error } = await supabase.from('credit_notes').select('*').order('date', { ascending: false });
    return data || [];
  },

  async addCreditNote(note) {
    await supabase.from('credit_notes').insert([{
      customer_name: note.customer_name,
      amount: note.amount,
      reason: note.reason,
      date: note.date
    }]);
  },

  async getAllCajaMovements() {
    const { data, error } = await supabase.from('caja_movements').select('*').order('date', { ascending: false });
    return data ? data.map(mapCajaMovement) : null;
  },

  async addCajaMovement(m) {
    await supabase.from('caja_movements').insert([{
      id: m.id,
      type: m.type,
      amount: m.amount,
      description: m.description,
      date: m.date,
      time: m.time,
      seller_name: m.sellerName
    }]);
  },

  async deleteCajaMovement(id) {
    await supabase.from('caja_movements').delete().eq('id', id);
  },

  async getSaleById(id) {
    const { data, error } = await supabase.from('sales').select('*, sale_items(*)').eq('id', id).single();
    return data ? mapSale(data) : null;
  },

  async getCustomerById(id) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    return data ? mapCustomer(data) : null;
  },
};
