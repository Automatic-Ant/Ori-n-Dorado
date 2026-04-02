/**
 * Utility to communicate with Google Sheets via a Google Apps Script Web App.
 */

const API_CONFIG = {
  // Replace this with your Google Apps Script URL after deployment
  endpoint: 'https://script.google.com/macros/s/AKfycbyeDbrqwpgwW54ynvbLKYj2Ax42Ahy4YqeEXymlKaoDupz-FsMl9envhIaKnrPwbGy2/exec',
  sheets: {
    stock: 'Stock',
    sales: 'Ventas',
    customers: 'Clientes',
    credits: 'Nota de Credito'
  }
};

export const sheetsAPI = {
  async getAllProducts() {
    if (!API_CONFIG.endpoint) return null;
    try {
      const response = await fetch(`${API_CONFIG.endpoint}?sheet=${API_CONFIG.sheets.stock}`);
      if (!response.ok) return null;
      const data = await response.json();

      if (!Array.isArray(data)) {
        console.warn('Google Sheets API did not return an array. Check your sheet names and configuration.', data);
        return null;
      }

      return data.map((row, index) => {
        const name = (row['Nombre del producto'] || row['Nombre del Producto'] || row.Nombre || '').toString().trim();
        const code = (row.Codigo || '').toString().trim();

        return {
          // Use a strictly unique ID for React keys, but keep 'code' for business logic
          id: code ? `${code}-${index}` : `item-${index}-${Math.random().toString(36).substr(2, 5)}`,
          code: code,
          name: name,
          category: (row.Categoria || 'Otros').toString().trim(),
          stock: Number(row['Stock Actual'] || 0),
          codigoPrecio: Number(row['Codigo Precio'] || 0),
          price: Number(row.Precio || 0),
          baseCode: Number(row['Codigo Base'] || 1),
          minStock: Number(row['Stock Minimo'] || 0),
          unit: (row.Unidad || 'unidad').toString().toLowerCase().trim()
        };
      }).filter(product => {
        return product.name.trim() !== '' && product.code.trim() !== '';
      });
    } catch (error) {
      console.error('Fetch Error:', error);
      return null;
    }
  },

  async addProduct(product) {
    if (!API_CONFIG.endpoint) return;
    try {
      await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'append',
          sheet: API_CONFIG.sheets.stock,
          data: {
            'Codigo': product.code,
            'Nombre del producto': product.name,
            'Categoria': product.category,
            'Stock Actual': product.stock,
            'Codigo Precio': product.codigoPrecio,
            'Codigo Base': product.baseCode,
            'Stock Minimo': product.minStock,
            'Vendedor': '',
            'Precio': "=INDIRECT(\"E\"&ROW()) * INDIRECT(\"F\"&ROW())"
          }
        })
      });
    } catch (e) {
      console.error('Add Product Error:', e);
    }
  },

  async syncSale(sale) {
    if (!API_CONFIG.endpoint) return;

    try {
      // Create an array mapping each sold item to a row in the "Ventas" sheet
      const saleDate = new Date(sale.date || Date.now());
      const isEfectivo = sale.paymentMethod === 'efectivo';

      const saleRows = sale.items.map(item => {
        const itemSubtotal = item.price * item.quantity;
        let itemTotal = itemSubtotal;

        if (isEfectivo) {
          const discountedSubtotal = itemSubtotal * 0.90;
          const rounded = Math.round(discountedSubtotal);
          const mod = rounded % 100;
          itemTotal = mod <= 50 ? rounded - mod : rounded + (100 - mod);
        }

        return {
          'Fecha': saleDate.toLocaleDateString('es-AR'),
          'Hora': saleDate.toLocaleTimeString('es-AR'),
          'Codigo': item.code || item.id,
          'Productos': item.name,
          'Cantidad': item.quantity,
          'Metodo de Pago': sale.paymentMethod,
          'Cliente DNI (Opcional)': sale.customerDni || '',
          'Vendedor': '',
          'Precio': itemTotal
        };
      });

      const payload = {
        action: 'batchSyncSale',
        saleData: {
          sheet: API_CONFIG.sheets.sales,
          data: saleRows
        },
        stockUpdates: {
          sheet: API_CONFIG.sheets.stock,
          updates: sale.items.map(item => ({
            id: item.code || item.id,
            newStock: Math.max(0, item.stock - item.quantity)
          }))
        }
      };

      await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error('Sync Sale Error:', e);
    }
  },

  async deleteProduct(id, code) {
    if (!API_CONFIG.endpoint) return;
    const targetId = code || id;
    console.log('API: Attempting to delete product. ID/RowHint:', id, 'Code:', code);
    try {
      // 1. Try standard delete by ID/Code
      const res1 = await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          sheet: API_CONFIG.sheets.stock,
          id: targetId,
          idColumn: 'Codigo'
        })
      });
      console.log('API: Delete by ID status:', res1.status);

      // 2. Try delete by Row number (extracted from our unique ID suffix '-index')
      const rowMatch = id.toString().match(/-(\d+)$/);
      if (rowMatch) {
        const rowNumber = parseInt(rowMatch[1], 10) + 2; // +2 because 0-based index + headers
        console.log('API: Attempting row-based delete on row:', rowNumber);
        const resRow = await fetch(API_CONFIG.endpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'delete',
            sheet: API_CONFIG.sheets.stock,
            row: rowNumber
          })
        });
        console.log('API: Delete by Row status:', resRow.status);
      }

      // 3. Clear row via update (Robust Fallback)
      const res2 = await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          sheet: API_CONFIG.sheets.stock,
          id: targetId,
          idColumn: 'Codigo',
          data: {
            'Nombre del producto': '', 
            'Codigo': '',
            'Categoria': 'ELIMINADO',
            'Stock Actual': 0,
            'Codigo Precio': 0,
            'Codigo Base': 0,
            'Stock Minimo': 0
          }
        })
      });
      console.log('API: Clear attempt status:', res2.status);
      console.log('API: Deletion sequence completed for:', targetId);
    } catch (e) {
      console.error('Delete Product Error:', e);
    }
  },

  async updateProduct(id, productData, code) {
    if (!API_CONFIG.endpoint) return;
    const targetId = code || id;
    console.log('API: Updating product:', id, 'Code:', code);
    try {
      // 1. Try updating by ID/Code
      await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          sheet: API_CONFIG.sheets.stock,
          id: targetId,
          idColumn: 'Codigo',
          data: {
            'Nombre del producto': productData.name,
            'Categoria': productData.category,
            'Stock Actual': productData.stock,
            'Codigo Precio': productData.codigoPrecio,
            'Codigo Base': productData.baseCode,
            'Stock Minimo': productData.minStock,
          }
        })
      });

      // 2. Fallback: Try updating by Row number
      const rowMatch = id.toString().match(/-(\d+)$/);
      if (rowMatch) {
        const rowNumber = parseInt(rowMatch[1], 10) + 2;
        await fetch(API_CONFIG.endpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'update',
            sheet: API_CONFIG.sheets.stock,
            row: rowNumber,
            data: {
              'Nombre del producto': productData.name,
              'Categoria': productData.category,
              'Stock Actual': productData.stock,
              'Codigo Precio': productData.codigoPrecio,
              'Codigo Base': productData.baseCode,
              'Stock Minimo': productData.minStock,
            }
          })
        });
      }
    } catch (e) {
      console.error('Update Product Error:', e);
    }
  },

  async updateProductStock(id, newStock) {
    if (!API_CONFIG.endpoint) return;
    try {
      await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateStock',
          sheet: API_CONFIG.sheets.stock,
          id: id,
          idColumn: 'Codigo', // Consistency
          newStock: newStock
        })
      });
    } catch (e) {
      console.error('Update Stock Error:', e);
    }
  },

  async deleteCustomer(id) {
    if (!API_CONFIG.endpoint) return;
    try {
      await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          sheet: API_CONFIG.sheets.customers,
          id: id,
          idColumn: 'id' // Assuming customers use 'id'
        })
      });
    } catch (e) {
      console.error('Delete Customer Error:', e);
    }
  }
};
