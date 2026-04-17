import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, X, FileText, ZoomIn, Loader } from 'lucide-react';
import { useFacturaStore } from '../../store/facturaStore';

function normalizar(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatFecha(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

export default function Facturas() {
  const { facturas, isLoadingFacturas, addFactura, deleteFactura } = useFacturaStore();

  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewer, setShowViewer] = useState(null); // imagen url
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, imagenUrl }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ proveedor: '', fecha: '', descripcion: '', imageFile: null });
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return facturas;
    const q = normalizar(busqueda);
    return facturas.filter(f => normalizar(f.proveedor).includes(q) || normalizar(f.descripcion).includes(q));
  }, [facturas, busqueda]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setForm(f => ({ ...f, imageFile: file }));
    setPreview(URL.createObjectURL(file));
  }

  function resetModal() {
    setForm({ proveedor: '', fecha: '', descripcion: '', imageFile: null });
    setPreview(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    setShowModal(false);
  }

  async function handleGuardar() {
    if (!form.proveedor.trim()) return setError('El nombre del proveedor es obligatorio.');
    if (!form.fecha) return setError('La fecha es obligatoria.');
    if (!form.imageFile) return setError('Seleccioná una imagen de la factura.');

    setSaving(true);
    setError('');
    try {
      await addFactura(form);
      resetModal();
    } catch {
      setError('Error al guardar. Verificá tu conexión e intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (!confirmDelete) return;
    try {
      await deleteFactura(confirmDelete.id, confirmDelete.imagenUrl);
    } catch {
      alert('Error al eliminar la factura.');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="facturas-page">
      <div className="facturas-header">
        <div>
          <h2 className="facturas-title">Facturas de Proveedores</h2>
          <p className="facturas-subtitle">{facturas.length} factura{facturas.length !== 1 ? 's' : ''} guardada{facturas.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-nueva" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nueva Factura
        </button>
      </div>

      <div className="search-bar">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Buscar por proveedor o descripción..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="search-input"
        />
        {busqueda && (
          <button className="clear-search" onClick={() => setBusqueda('')}><X size={14} /></button>
        )}
      </div>

      {isLoadingFacturas ? (
        <div className="loading-state">
          <Loader size={32} className="spinner" />
          <p>Cargando facturas...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} className="empty-icon" />
          <p>{busqueda ? 'No se encontraron facturas con esa búsqueda.' : 'Todavía no hay facturas guardadas.'}</p>
          {!busqueda && <button className="btn-nueva" onClick={() => setShowModal(true)}><Plus size={16} /> Subir primera factura</button>}
        </div>
      ) : (
        <div className="facturas-grid">
          <AnimatePresence>
            {filtradas.map(factura => (
              <motion.div
                key={factura.id}
                className="factura-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <div className="card-img-wrap" onClick={() => setShowViewer(factura.imagen_url)}>
                  <img src={factura.imagen_url} alt={factura.proveedor} className="card-img" />
                  <div className="card-img-overlay"><ZoomIn size={20} /></div>
                </div>
                <div className="card-body">
                  <p className="card-proveedor">{factura.proveedor}</p>
                  <p className="card-fecha">{formatFecha(factura.fecha)}</p>
                  {factura.descripcion && <p className="card-desc">{factura.descripcion}</p>}
                </div>
                <button
                  className="card-delete"
                  title="Eliminar"
                  onClick={() => setConfirmDelete({ id: factura.id, imagenUrl: factura.imagen_url })}
                >
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal: Nueva Factura */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetModal}>
            <motion.div className="modal" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Nueva Factura de Proveedor</h3>
                <button className="modal-close" onClick={resetModal}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">Proveedor *</label>
                <input
                  className="field-input"
                  placeholder="Ej: Osram, Philips, Distribuidora Eléctrica..."
                  value={form.proveedor}
                  onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                />

                <label className="field-label">Fecha *</label>
                <input
                  className="field-input"
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                />

                <label className="field-label">Descripción (opcional)</label>
                <input
                  className="field-input"
                  placeholder="Ej: Compra de cables, pago factura N°123..."
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                />

                <label className="field-label">Imagen de la factura *</label>
                <div className="file-zone" onClick={() => fileRef.current?.click()}>
                  {preview ? (
                    <img src={preview} alt="preview" className="preview-img" />
                  ) : (
                    <>
                      <FileText size={28} />
                      <span>Tocá para seleccionar una foto o imagen</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden-input" onChange={handleFile} />

                {error && <p className="error-msg">{error}</p>}
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={resetModal} disabled={saving}>Cancelar</button>
                <button className="btn-save" onClick={handleGuardar} disabled={saving}>
                  {saving ? <><Loader size={15} className="spinner-sm" /> Guardando...</> : 'Guardar Factura'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Visor de imagen */}
      <AnimatePresence>
        {showViewer && (
          <motion.div className="viewer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowViewer(null)}>
            <motion.div className="viewer-container" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <button className="viewer-close" onClick={() => setShowViewer(null)}><X size={22} /></button>
              <img src={showViewer} alt="factura" className="viewer-img" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmar eliminación */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
            <motion.div className="modal modal-sm" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Eliminar Factura</h3>
                <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)' }}>¿Seguro que querés eliminar esta factura? Esta acción no se puede deshacer.</p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn-delete" onClick={handleEliminar}>Eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .facturas-page {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }
        .facturas-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.75rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .facturas-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--primary-gold);
          margin: 0 0 0.25rem;
        }
        .facturas-subtitle {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }
        .btn-nueva {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--primary-gold);
          color: #0a0a0a;
          border: none;
          padding: 0.7rem 1.25rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-nueva:hover { opacity: 0.85; transform: translateY(-1px); }

        .search-bar {
          position: relative;
          margin-bottom: 1.75rem;
        }
        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }
        .search-input {
          width: 100%;
          padding: 0.8rem 2.75rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: white;
          font-size: 0.95rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .search-input:focus { border-color: var(--primary-gold); }
        .search-input::placeholder { color: var(--text-secondary); }
        .clear-search {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .clear-search:hover { color: white; }

        .loading-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 5rem 2rem;
          color: var(--text-secondary);
        }
        .empty-icon { opacity: 0.3; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .facturas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1.25rem;
        }

        .factura-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
          transition: border-color 0.2s, transform 0.2s;
        }
        .factura-card:hover { border-color: rgba(212,175,55,0.4); transform: translateY(-2px); }

        .card-img-wrap {
          position: relative;
          width: 100%;
          height: 160px;
          cursor: zoom-in;
          overflow: hidden;
          background: rgba(0,0,0,0.3);
        }
        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        .card-img-wrap:hover .card-img { transform: scale(1.04); }
        .card-img-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .card-img-wrap:hover .card-img-overlay { opacity: 1; }

        .card-body {
          padding: 0.85rem 1rem;
          padding-right: 2.5rem;
        }
        .card-proveedor {
          font-weight: 700;
          color: white;
          margin: 0 0 0.2rem;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-fecha {
          font-size: 0.8rem;
          color: var(--primary-gold);
          margin: 0 0 0.3rem;
        }
        .card-desc {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-delete {
          position: absolute;
          top: 0.6rem;
          right: 0.6rem;
          background: rgba(231,76,60,0.15);
          border: 1px solid rgba(231,76,60,0.3);
          color: #e74c3c;
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0;
        }
        .factura-card:hover .card-delete { opacity: 1; }
        .card-delete:hover { background: rgba(231,76,60,0.3); }

        /* Modals */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-sm { max-width: 380px; }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--primary-gold); }
        .modal-close { background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; }
        .modal-close:hover { color: white; }
        .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        .field-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.1rem; }
        .field-input {
          width: 100%;
          padding: 0.7rem 0.9rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: white;
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .field-input:focus { border-color: var(--primary-gold); }
        .field-input::placeholder { color: var(--text-secondary); }
        .field-input[type="date"] { color-scheme: dark; }

        .file-zone {
          border: 2px dashed var(--border-color);
          border-radius: 10px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          transition: border-color 0.2s;
          min-height: 120px;
          justify-content: center;
        }
        .file-zone:hover { border-color: var(--primary-gold); color: white; }
        .preview-img { max-height: 180px; max-width: 100%; border-radius: 8px; object-fit: contain; }
        .hidden-input { display: none; }
        .error-msg { color: #e74c3c; font-size: 0.85rem; margin: 0; }

        .btn-cancel {
          padding: 0.65rem 1.2rem;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .btn-cancel:hover { border-color: white; color: white; }
        .btn-save {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.65rem 1.4rem;
          background: var(--primary-gold);
          color: #0a0a0a;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-delete {
          padding: 0.65rem 1.2rem;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-delete:hover { opacity: 0.85; }
        .spinner-sm { animation: spin 1s linear infinite; }

        /* Visor imagen fullscreen */
        .viewer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1.5rem;
        }
        .viewer-container {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }
        .viewer-img {
          max-width: 100%;
          max-height: 85vh;
          border-radius: 10px;
          object-fit: contain;
        }
        .viewer-close {
          position: absolute;
          top: -2.5rem;
          right: 0;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          border-radius: 8px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        .viewer-close:hover { background: rgba(255,255,255,0.2); }

        @media (max-width: 768px) {
          .facturas-page { padding: 1rem; }
          .facturas-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.85rem; }
          .card-img-wrap { height: 130px; }
          .card-delete { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
