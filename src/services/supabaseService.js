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
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')
      .limit(2000);
    
    if (error) {
      console.error('Error fetching products from Supabase:', error);
      return null;
    }

    return data.map(item => ({
      id: item.id, // Supabase UUID
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
      listPrice: Number(item.list_price) || 0
    }));
  },

  async bulkAddProducts(products, onProgress) {
    const CHUNK = 50;       // Products per request
    const CONCURRENCY = 4;  // Parallel requests at a time
    const TIMEOUT_MS = 60000;

    // Deduplicate by code — keep last occurrence
    const seen = new Map();
    for (const p of products) seen.set(p.code, p);
    const deduped = [...seen.values()];

    // Build DB-shaped chunks
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

    const uploadChunk = async (chunk, index) => {
      try {
        const { error } = await Promise.race([
          supabase.from('products').upsert(chunk, { onConflict: 'code', ignoreDuplicates: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: el servidor tardó demasiado. Verificá tu conexión o que el proyecto de Supabase esté activo.')), TIMEOUT_MS)
          ),
        ]);

        if (error) {
          console.error(`[Import] Error en chunk ${index + 1}:`, error.message);
          if (!firstError) firstError = error.message;
          skipped += chunk.length;
        } else {
          inserted += chunk.length;
        }
      } catch (e) {
        console.error(`[Import] Excepción en chunk ${index + 1}:`, e.message);
        if (!firstError) firstError = e.message;
        skipped += chunk.length;
      }

      completed++;
      console.log(`[Import] Chunk ${index + 1}/${totalChunks} — insertados: ${inserted}, omitidos: ${skipped}`);
      onProgress?.(Math.round((completed / totalChunks) * 90));
    };

    // Process in parallel waves of CONCURRENCY
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const wave = chunks.slice(i, i + CONCURRENCY);
      await Promise.all(wave.map((chunk, j) => uploadChunk(chunk, i + j)));
    }

    return { inserted, skipped, firstError };
  },

  async addProduct(product) {
    const { error } = await supabase
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
        list_price: product.listPrice || 0
      }]);

    if (error) {
      console.error('Error adding product to Supabase:', error);
      throw error;
    }
  },

  async updateProduct(id, productData, originalCode) {
    const payload = {
      code:          productData.code,
      name:          productData.name,
      category:      productData.category,
      stock:         productData.stock,
      codigo_precio: productData.codigoPrecio,
      price:         productData.price,
      base_code:     productData.baseCode,
      min_stock:     productData.minStock,
      unit:          productData.unit,
      marca:         productData.marca || '',
      list_price:    productData.listPrice || 0,
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
  },

  async updateProductStock(id, newStock) {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id);
    
    if (error) console.error('Error updating stock in Supabase:', error);
  },

  async deleteProduct(id) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting product from Supabase:', error);
      throw error;
    }
  },

  // CUSTOMERS
  async getAllCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching customers from Supabase:', error);
      return null;
    }
    
    return data.map(c => ({
      ...c,
      creditBalance: Number(c.credit_balance)
    }));
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
    const { error } = await supabase
        .from('customers')
        .update({
            dni: customerData.dni || null,
            name: customerData.name,
            email: customerData.email || null,
            phone: customerData.phone || null,
            address: customerData.address || null,
            credit_balance: customerData.creditBalance
        })
        .eq('id', id);

    if (error) console.error('Error updating customer in Supabase:', error.message, error.details);
  },

  async deleteCustomer(id) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) console.error('Error deleting customer from Supabase:', error);
  },

  // SALES
  async getAllSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching sales from Supabase:', error);
      return null;
    }

    return data.map(sale => ({
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
        subtotal: Number(item.subtotal)
      }))
    }));
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
    const saleItemsList = sale.items.map(item => ({
      sale_id: saleId,
      product_id: item.id,
      product_code: item.code,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsList);

    if (itemsError) console.error('Error syncing sale items to Supabase:', itemsError);


    // 3. Update stock of products
    for (const item of sale.items) {
        const { error: stockError } = await supabase.rpc('decrement_stock', {
            product_id: item.id,
            qty: item.quantity
        });
        
        // If RPC doesn't exist yet, we'll manually update for now
        if (stockError) {
            const { data: currentProduct } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .single();
            
            if (currentProduct) {
                await supabase
                    .from('products')
                    .update({ stock: currentProduct.stock - item.quantity })
                    .eq('id', item.id);
            }
        }
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
    const { data, error } = await supabase
      .from('credit_notes')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching credit notes from Supabase:', error);
      return null;
    }
    return data;
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
    const { data, error } = await supabase
      .from('caja_movements')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching caja movements:', error);
      return null;
    }

    return data.map(m => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      description: m.description || '',
      sellerName: m.seller_name || '',
      date: m.date,
      time: new Date(m.date).toLocaleTimeString('es-AR'),
    }));
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
