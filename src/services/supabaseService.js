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

function canonicalCategory(cat) {
  if (!cat) return 'Otros';
  const key = String(cat).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return CATEGORY_CANONICAL[key] || cat;
}

export const supabaseService = {
  // PRODUCTS
  async getAllProducts() {
    // Paginate to bypass Supabase's server-side max_rows cap (default 1000).
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching products from Supabase:', error);
        return allRows.length > 0 ? allRows.map(mapProduct) : null;
      }

      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break; // last page
      from += PAGE_SIZE;
    }

    return allRows.map(mapProduct);

    function mapProduct(item) {
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
      };
    }
  },

  async bulkAddProducts(products, onProgress) {
    const CHUNK = 500;       
    const CONCURRENCY = 3;   
    const TIMEOUT_MS = 60000;
    const RETRY_DELAY_MS = 2000;

    // Deduplicate by code — keep last occurrence
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
        parent_product_id: p.parentProductId || null,
        units_per_package: Number(p.unitsPerPackage) || 1,
      })));
    }

    const totalChunks = chunks.length;
    let completed = 0;
    let inserted = 0;
    let skipped = 0;
    let firstError = null;
    let allInsertedRows = [];

    onProgress?.(totalChunks > 0 ? 1 : 0);

    const upsertWithTimeout = (chunk) =>
      Promise.race([
        supabase.from('products').upsert(chunk, { onConflict: 'code' }).select(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
        ),
      ]);

    const uploadChunk = async (chunk, index) => {
      let lastErr = null;
      let data = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await upsertWithTimeout(chunk);
          if (res.error) {
            lastErr = res.error.message;
          } else {
            data = res.data;
            inserted += chunk.length;
            lastErr = null;
            if (data) allInsertedRows = allInsertedRows.concat(data);
            break;
          }
        } catch (e) {
          lastErr = e.message;
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      if (lastErr) {
        skipped += chunk.length;
        if (!firstError) firstError = lastErr;
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
      rows: allInsertedRows.map(item => ({
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
        units_per_package: Number(item.units_per_package) || 1,
      }))
    };
  },

  async addProduct(product) {
    const { data, error } = await supabase
      .from('products')
      .insert([{
        code: product.code,
        name: product.name,
        category: product.category,
        stock: product.stock,
        codigo_precio: product.codigoPrecio,
        price: product.price,
        base_code: product.baseCode,
        min_stock: product.minStock,
        unit: product.unit,
        marca: product.marca || '',
        list_price: product.listPrice || 0,
        parent_product_id: product.parentProductId || null,
        units_per_package: product.unitsPerPackage || 1,
      }])
      .select();

    if (error) {
      console.error('Error adding product to Supabase:', error);
      throw error;
    }
    return data && data[0] ? data[0] : null;
  },

  async updateProduct(id, productData, originalCode) {
    const payload = {
      code:              productData.code,
      name:              productData.name,
      category:          productData.category,
      stock:             productData.stock,
      codigo_precio:     productData.codigoPrecio,
      price:             productData.price,
      base_code:         productData.baseCode,
      min_stock:         productData.minStock,
      unit:              productData.unit,
      marca:             productData.marca || '',
      list_price:        productData.listPrice || 0,
      parent_product_id: productData.parentProductId || null,
      units_per_package: productData.unitsPerPackage || 1,
    };

    console.log('[Supabase] updateProduct → id:', id, '| code:', productData.code);

    // 1. Intentar por UUID
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('id');

    console.log('[Supabase] update by id result → data:', data, '| error:', error);

    if (error) {
      console.error('Error updating product by id:', error);
      throw error;
    }

    if (data && data.length > 0) {
      console.log('[Supabase] update by id exitoso ✓');
      return;
    }

    // 2. UUID no coincidió — fallback por código original
    const codeToSearch = originalCode || productData.code;
    console.warn(`[Supabase] UUID "${id}" no encontrado. Intentando por código "${codeToSearch}"...`);

    const { data: data2, error: error2 } = await supabase
      .from('products')
      .update(payload)
      .eq('code', codeToSearch)
      .select('id');

    if (error2) {
      console.error('Error updating product by code:', error2);
      throw error2;
    }

    if (!data2 || data2.length === 0) {
      throw new Error(`No se encontró el producto con ID "${id}" ni código "${codeToSearch}" en la base de datos.`);
    }
    return data2[0];
  },

  async updateProductStock(id, newStock) {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id);
    
    if (error) console.error('Error updating stock in Supabase:', error);
  },

  async deleteProduct(id, code) {
    // 1. Try by UUID
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Error deleting product by id:', error);
      throw error;
    }

    if (data && data.length > 0) return; // deleted successfully

    // 2. UUID didn't match (temp ID from bulk import) — fallback by code
    if (!code) throw new Error(`No se encontró el producto con ID "${id}" en la base de datos.`);

    console.warn(`[Supabase] deleteProduct: UUID "${id}" no encontrado, intentando por código "${code}"...`);
    const { data: data2, error: error2 } = await supabase
      .from('products')
      .delete()
      .eq('code', code)
      .select('id');

    if (error2) {
      console.error('Error deleting product by code:', error2);
      throw error2;
    }

    if (!data2 || data2.length === 0) {
      throw new Error(`No se encontró el producto con código "${code}" en la base de datos.`);
    }
  },

  // CUSTOMERS
  async getAllCustomers() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching customers from Supabase:', error);
        return allRows.length > 0 ? allRows.map(c => ({ ...c, creditBalance: Number(c.credit_balance) })) : null;
      }
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows.map(c => ({ ...c, creditBalance: Number(c.credit_balance) }));
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
        credit_balance: customer.creditBalance || 0
      }])
      .select();

    if (error) {
      console.error('Error adding customer to Supabase:', error.message, error.details, error.hint);
      return null;
    }
    return data ? data[0] : null;
  },

  async updateCustomer(id, customerData) {
    const toUpdate = {};
    if (customerData.dni !== undefined) toUpdate.dni = customerData.dni || null;
    if (customerData.name !== undefined) toUpdate.name = customerData.name;
    if (customerData.email !== undefined) toUpdate.email = customerData.email || null;
    if (customerData.phone !== undefined) toUpdate.phone = customerData.phone || null;
    if (customerData.address !== undefined) toUpdate.address = customerData.address || null;
    if (customerData.creditBalance !== undefined) toUpdate.credit_balance = customerData.creditBalance;

    const { error } = await supabase
        .from('customers')
        .update(toUpdate)
        .eq('id', id);

    if (error) console.error('Error updating customer in Supabase:', error.message, error.details);
  },

  async deleteCustomer(id) {
    // Note: If sales/credit_notes don't have customer_id column, these might fail
    // but we use denormalized name/dni mostly.
    try {
      await supabase.from('sales').update({ customer_id: null }).eq('customer_id', id);
    } catch (_) {}
    try {
      await supabase.from('credit_notes').update({ customer_id: null }).eq('customer_id', id);
    } catch (_) {}

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer from Supabase:', error);
      throw error;
    }
  },

  // SALES
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

    function mapSale(sale) {
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
        })),
      };
    }
  },

  async syncSale(sale) {
    // Use the pre-calculated total (already accounts for credit, splits, and rounding)
    const totalAmount = sale.total;

    // 1. Insert Sale record
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

    // 2. Insert Sale Items (original prices — total reflects actual charged amount)
    // Snapshot parent_product_id and units_per_package so cancellations can restore stock correctly
    const saleItemsList = sale.items.map(item => ({
      sale_id: saleId,
      product_id: item.id,
      product_code: item.code,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      parent_product_id: item.parentProductId || null,
      units_per_package: item.unitsPerPackage || 1,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsList);

    if (itemsError) console.error('Error syncing sale items to Supabase:', itemsError);


    // 3. Update stock of products
    // For package products (parentProductId set), decrement parent's stock by qty * unitsPerPackage
    for (const item of sale.items) {
        const targetId = item.parentProductId || item.id;
        const qty = item.quantity * (item.unitsPerPackage || 1);

        const { error: stockError } = await supabase.rpc('decrement_stock', {
            product_id: targetId,
            qty,
        });

        if (stockError) {
            const { data: currentProduct } = await supabase
                .from('products')
                .select('stock')
                .eq('id', targetId)
                .single();

            if (currentProduct) {
                await supabase
                    .from('products')
                    .update({ stock: currentProduct.stock - qty })
                    .eq('id', targetId);
            }
        }
    }
  },

  async updateSaleStatus(saleId, status) {
    // external_id is the #123 format used in the UI
    const { error } = await supabase
      .from('sales')
      .update({ status })
      .eq('external_id', saleId);

    if (error) {
      // Fallback by internal id if saleId is a UUID
      await supabase.from('sales').update({ status }).eq('id', saleId);
    }
  },

  async incrementStock(productId, quantity) {
    const { error } = await supabase.rpc('increment_stock', {
        product_id: productId,
        qty: quantity
    });
    
    if (error) {
        console.error('Error incrementing stock via RPC:', error);
        // Fallback
        const { data: currentProduct } = await supabase
            .from('products')
            .select('stock')
            .eq('id', productId)
            .single();
        
        if (currentProduct) {
            await supabase
                .from('products')
                .update({ stock: currentProduct.stock + quantity })
                .eq('id', productId);
        }
    }
  },

  // CREDIT NOTES
  async getAllCreditNotes() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .order('date', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching credit notes from Supabase:', error);
        return allRows.length > 0 ? allRows : null;
      }
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows;
  },

  async addCreditNote(note) {
    const { error } = await supabase
      .from('credit_notes')
      .insert([{
        customer_name: note.customer_name,
        amount: note.amount,
        reason: note.reason,
        date: note.date
      }]);

    if (error) console.error('Error adding credit note to Supabase:', error);
  },

  // CAJA MOVEMENTS
  async getAllCajaMovements() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('caja_movements')
        .select('*')
        .order('date', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching caja movements:', error);
        return allRows.length > 0 ? allRows.map(mapMovement) : null;
      }
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows.map(mapMovement);

    function mapMovement(m) {
      return {
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        description: m.description || '',
        sellerName: m.seller_name || '',
        date: m.date,
        time: new Date(m.date).toLocaleTimeString('es-AR'),
      };
    }
  },

  async addCajaMovement(movement) {
    const { error } = await supabase
      .from('caja_movements')
      .insert([{
        id: movement.id,
        type: movement.type,
        amount: movement.amount,
        description: movement.description || '',
        seller_name: movement.sellerName || '',
        date: movement.date,
      }]);

    if (error) console.error('Error adding caja movement:', error);
  },

  async fixCategoryCase(from, to) {
    const { error } = await supabase
      .from('products')
      .update({ category: to })
      .eq('category', from);
    if (error) console.error(`Error fixing category "${from}" → "${to}":`, error);
  },

  async deleteCajaMovement(id) {
    const { error } = await supabase
      .from('caja_movements')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting caja movement:', error);
  },
};
