import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  TrendingUp, 
  ChevronDown, 
  MoreVertical,
  AlertCircle,
  Save,
  Trash2,
  Filter,
  Package,
  X,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useProductStore } from '../../store/productStore';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/formatCurrency';

const Stock = () => {
  const location = useLocation();
  const products = useProductStore((state) => state.products);
  const deleteProduct = useProductStore((state) => state.deleteProduct);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock] = useState('todos');
  
  const [globalBaseCode, setGlobalBaseCode] = useState(() => {
    return localStorage.getItem('orion_global_base_code') || '';
  });

  useEffect(() => {
    if (location.state?.filterLowStock) {
      setOnlyLowStock(true);
    }
  }, [location.state]);

  useEffect(() => {
    localStorage.setItem('orion_global_base_code', globalBaseCode);
  }, [globalBaseCode]);

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Cables',
    codigoPrecio: '',
    baseCode: '',
    stock: '',
    minStock: '',
    unit: 'unidad',
    marca: ''
  });

  const marcaOptions = useMemo(() => {
    const marcas = [...new Set(products.map(p => p.marca).filter(Boolean))].sort();
    return marcas;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const pName = p.name ? p.name.toString().toLowerCase() : '';
      const pCode = p.code ? p.code.toString().toLowerCase() : '';
      const cat = p.category ? p.category.toString().toLowerCase() : '';
      const pMarca = p.marca ? p.marca.toString().toLowerCase() : '';

      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || pName.includes(term) || pCode.includes(term) || cat.includes(term) || pMarca.includes(term);

      const matchesMarca = !filterMarca || (p.marca || '').toLowerCase() === filterMarca.toLowerCase();
      const matchesCategory = !filterCategory || p.category === filterCategory;

      const stockVal = Number(p.stock) || 0;
      const minStockVal = Number(p.minStock) || 0;
      const matchesStockFilter =
        filterStock === 'todos' ? true :
        filterStock === 'ok'    ? stockVal > minStockVal :
        filterStock === 'bajo'  ? (stockVal <= minStockVal && stockVal > 0) :
        filterStock === 'sin'   ? stockVal === 0 : true;

      // keep legacy onlyLowStock for sidebar redirect compatibility
      const matchesLowStock = !onlyLowStock || stockVal <= minStockVal;

      return matchesSearch && matchesMarca && matchesCategory && matchesStockFilter && matchesLowStock;
    });
  }, [products, searchTerm, onlyLowStock, filterMarca, filterCategory, filterStock]);

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        code: product.code || '',
        category: product.category || 'Cables',
        codigoPrecio: product.codigoPrecio || '',
        baseCode: product.baseCode || '',
        stock: product.stock || 0,
        minStock: product.minStock || 0,
        unit: product.unit || 'unidad',
        marca: product.marca || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        code: '',
        name: '',
        category: 'Cables',
        codigoPrecio: '',
        baseCode: globalBaseCode,
        stock: '',
        minStock: '',
        unit: 'unidad'
      });
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isCableMetros = formData.category === 'Cables' && formData.unit === 'metro';
    const finalCodigoPrecio = parseFloat(formData.codigoPrecio) || 0;
    const finalBaseCode = isCableMetros ? 1 : (parseFloat(formData.baseCode) || 0);

    const data = {
      ...formData,
      codigoPrecio: finalCodigoPrecio,
      baseCode: finalBaseCode,
      price: finalCodigoPrecio * finalBaseCode,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, data);
    } else {
      addProduct(data);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = (product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleExecuteDelete = () => {
    if (productToDelete) {
      console.log('UI: Deleting product:', productToDelete.id, productToDelete.code);
      deleteProduct(productToDelete.id);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  return (
    <div className="stock-page">
      <header className="page-header">
        <div className="header-left">
          <h2 className="page-title">Inventario</h2>
          <p className="page-subtitle">Gestión de productos y control de existencias.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={20} />
            Nuevo Producto
          </button>
        )}
      </header>

      <div className="stock-controls">
        <div className="search-bar card glass">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, categoría o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')} type="button">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filters-row">
          <div className="filter-select-wrap card glass">
            <Filter size={15} className="filter-icon" />
            <select value={filterMarca} onChange={(e) => setFilterMarca(e.target.value)}>
              <option value="">Todas las marcas</option>
              {marcaOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-select-wrap card glass">
            <Filter size={15} className="filter-icon" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Todas las categorías</option>
              <option value="Cables">Cables</option>
              <option value="Iluminación">Iluminación</option>
              <option value="Protecciones">Protecciones</option>
              <option value="Cajas">Cajas</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="filter-select-wrap card glass">
            <AlertCircle size={15} className="filter-icon" />
            <select value={filterStock} onChange={(e) => { setFilterStock(e.target.value); setOnlyLowStock(false); }}>
              <option value="todos">Todo el stock</option>
              <option value="ok">Stock OK</option>
              <option value="bajo">Stock bajo</option>
              <option value="sin">Sin stock</option>
            </select>
          </div>

          <div className="filters card glass" style={{ padding: '0 1rem' }}>
            <span className="filter-label">Cód. Base Global:</span>
            <input
              type="number"
              placeholder="Ej: 1300"
              value={globalBaseCode}
              onChange={(e) => setGlobalBaseCode(e.target.value)}
              className="global-base-input"
            />
          </div>

          {(filterMarca || filterCategory || filterStock !== 'todos' || onlyLowStock) && (
            <button
              className="clear-filters-btn card glass"
              onClick={() => { setFilterMarca(''); setFilterCategory(''); setFilterStock('todos'); setOnlyLowStock(false); }}
              type="button"
            >
              <X size={15} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="table-container card glass">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre del Producto</th>
              <th>Marca</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock Actual</th>
              <th>Unidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.tr 
                   key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <td><span className="code-badge">{product.code}</span></td>
                  <td>
                    <div className="prod-name-cell">
                      {product.name}
                      {Number(product.stock) <= Number(product.minStock) && (
                        <span className="low-stock-alert">
                          <AlertCircle size={12} /> Stock Bajo
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{product.marca || '-'}</td>
                  <td>{product.category}</td>
                  <td className="price-cell">{formatCurrency(product.price)}</td>
                  <td>
                    <span className={`stock-count ${Number(product.stock) <= Number(product.minStock) ? 'critical' : ''}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td>{product.unit}</td>
                  <td>
                    {isAdmin && (
                      <div className="action-btns">
                        <button
                          className="icon-btn edit"
                          onClick={() => handleOpenModal(product)}
                          type="button"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => confirmDelete(product)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="empty-table-msg">
            <Package size={48} />
            <p>No se encontraron productos con los filtros actuales.</p>
          </div>
        )}
      </div>

      {/* Product Edit/Create Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? 'Editar Producto' : 'Cargar Nuevo Producto'}
      >
        <form className="stock-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group flex-2">
              <label>Nombre del Producto</label>
              <input type="text" name="name" required value={formData.name} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Código</label>
              <input type="text" name="code" required value={formData.code} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Marca</label>
              <input type="text" name="marca" placeholder="Ej: Prysmian, Schneider..." value={formData.marca} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Categoría</label>
              <select name="category" value={formData.category} onChange={handleInputChange}>
                <option value="Cables">Cables</option>
                <option value="Iluminación">Iluminación</option>
                <option value="Protecciones">Protecciones</option>
                <option value="Cajas">Cajas</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <select name="unit" value={formData.unit} onChange={handleInputChange}>
                <option value="unidad">Unidad</option>
                <option value="metro">Metro</option>
                <option value="caja">Caja</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>
                {formData.category === 'Cables' && formData.unit === 'metro' ? 'Precio por Metro ($)' : 'Cód. Precio'}
              </label>
              <input type="number" step="any" name="codigoPrecio" required value={formData.codigoPrecio} onChange={handleInputChange} />
            </div>
            {!(formData.category === 'Cables' && formData.unit === 'metro') && (
              <div className="form-group">
                <label>Cód. Base</label>
                <input type="number" step="any" name="baseCode" required value={formData.baseCode} onChange={handleInputChange} />
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Stock Inicial</label>
              <input type="number" name="stock" required value={formData.stock} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Stock Mínimo</label>
              <input type="number" name="minStock" required value={formData.minStock} onChange={handleInputChange} />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            <Save size={20} /> {editingProduct ? 'Guardar Cambios' : 'Registrar Producto'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Eliminación"
      >
        <div className="delete-confirm-content">
          <AlertTriangle size={48} color="var(--error)" />
          <p>¿Estás seguro de que deseas eliminar <strong>{productToDelete?.name}</strong>?</p>
          <p className="delete-warning">Esta acción no se puede deshacer y el producto será borrado de la base de datos.</p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</button>
            <button className="btn-danger" onClick={handleExecuteDelete}>Eliminar Producto</button>
          </div>
        </div>
      </Modal>

      <style jsx>{`
        .stock-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .header-left {
          display: flex;
          flex-direction: column;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 0.5rem;
        }

        .stock-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 1.5rem;
          height: 50px;
        }

        .search-bar input {
          background: transparent;
          border: none;
          width: 100%;
          font-size: 1rem;
          color: white;
          outline: none;
        }

        .clear-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
          transition: color 0.2s;
        }

        .clear-btn:hover { color: white; }

        .filters-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .filter-select-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1rem;
          height: 42px;
          border-radius: 10px;
        }

        .filter-icon {
          color: var(--primary-gold);
          flex-shrink: 0;
        }

        .filter-select-wrap select {
          background: transparent;
          border: none;
          color: white;
          font-size: 0.9rem;
          outline: none;
          cursor: pointer;
          min-width: 140px;
        }

        .filter-select-wrap select option {
          background: #1a1a1a;
          color: white;
        }

        .clear-filters-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0 1rem;
          height: 42px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(231, 76, 60, 0.4);
          color: #e74c3c;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-filters-btn:hover {
          background: rgba(231, 76, 60, 0.1);
        }

        .filters {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 1rem;
          height: 42px;
          border-radius: 10px;
        }

        .global-base-input {
          background: transparent !important;
          border: none !important;
          color: var(--primary-gold) !important;
          font-weight: 600 !important;
          width: 80px !important;
          padding: 0 !important;
          outline: none;
        }

        .table-container {
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .stock-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .stock-table th {
          background: rgba(212, 175, 55, 0.05);
          padding: 1.25rem 1.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
        }

        .stock-table td {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #222;
          font-size: 0.9rem;
        }

        .code-badge {
          background: var(--surface-lighter);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          color: var(--primary-gold);
          font-weight: 700;
          font-family: monospace;
        }

        .prod-name-cell {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-weight: 600;
        }

        .low-stock-alert {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(231, 76, 60, 0.1);
          color: var(--error);
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          border: 1px solid rgba(231, 76, 60, 0.2);
        }

                .price-cell {
          color: #fff;
          font-weight: 700;
        }

        .stock-count {
          font-weight: 800;
        }

        .stock-count.critical {
          color: var(--error);
        }

        .action-btns {
          display: flex;
          gap: 0.75rem;
        }

        .icon-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: var(--primary-gold);
          border-color: var(--primary-gold);
          background: rgba(212, 175, 55, 0.1);
        }

        .empty-table-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 4rem;
          color: var(--text-secondary);
          opacity: 0.5;
        }

        tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .delete-confirm-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .delete-warning {
          font-size: 0.85rem;
          color: var(--text-secondary);
          opacity: 0.8;
          margin-top: -0.5rem;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          width: 100%;
          margin-top: 1rem;
        }

        .btn-secondary {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.8rem;
          border-radius: 10px;
          cursor: pointer;
        }

        .btn-danger {
          flex: 1.5;
          background: var(--error);
          border: none;
          color: white;
          padding: 0.8rem;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .stock-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-grid, .form-grid-2 {
          display: grid;
          gap: 1.5rem;
        }

        .form-grid { grid-template-columns: 2fr 1fr; }
        .form-grid-2 { grid-template-columns: 1fr 1fr; }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .form-group input, .form-group select {
          background: #1a1a1a;
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.85rem;
          border-radius: 10px;
          outline: none;
        }

        .form-group select option {
          background: #1a1a1a;
          color: white;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: var(--primary-gold);
        }
      `}</style>
    </div>
  );
};

export default Stock;
