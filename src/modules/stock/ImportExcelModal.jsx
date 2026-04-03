import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, Check, AlertTriangle, FileSpreadsheet, ChevronRight } from 'lucide-react';

const PRODUCT_FIELDS = [
  { key: 'code',         label: 'Código',        required: true },
  { key: 'name',         label: 'Nombre',         required: true },
  { key: 'marca',        label: 'Marca',          required: false },
  { key: 'category',     label: 'Categoría',      required: false },
  { key: 'price',        label: 'Precio',         required: false },
  { key: 'codigoPrecio', label: 'Cód. Precio',    required: false },
  { key: 'baseCode',     label: 'Cód. Base',      required: false },
  { key: 'stock',        label: 'Stock inicial',  required: false },
  { key: 'minStock',     label: 'Stock mínimo',   required: false },
  { key: 'unit',         label: 'Unidad',         required: false },
];

const DEFAULT_CATEGORY = 'Otros';
const DEFAULT_UNIT = 'unidad';

const ImportExcelModal = ({ onClose, onImport }) => {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | map | preview
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (data.length < 2) return;

      const hdrs = data[0].map(h => String(h).trim());
      const dataRows = data.slice(1).filter(r => r.some(c => c !== ''));

      setHeaders(hdrs);
      setRows(dataRows);

      // Auto-map: match header names to field keys/labels
      const autoMap = {};
      PRODUCT_FIELDS.forEach(field => {
        const idx = hdrs.findIndex(h => {
          const hl = h.toLowerCase();
          return hl === field.key.toLowerCase() ||
                 hl === field.label.toLowerCase() ||
                 hl.includes(field.key.toLowerCase()) ||
                 hl.includes(field.label.toLowerCase());
        });
        if (idx !== -1) autoMap[field.key] = idx;
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsBinaryString(file);
  };

  const [importError, setImportError] = useState(null);

  const handleImport = async () => {
    if (mapping.code === undefined || mapping.name === undefined) return;

    setImporting(true);
    setImportError(null);
    const products = rows.map(row => {
      const get = (key) => {
        const idx = mapping[key];
        return idx !== undefined && idx !== '' ? String(row[idx] ?? '').trim() : '';
      };

      const codigoPrecio = parseFloat(get('codigoPrecio') || get('price')) || 0;
      const baseCode     = parseFloat(get('baseCode')) || 0;
      const price        = codigoPrecio && baseCode ? codigoPrecio * baseCode : parseFloat(get('price')) || 0;

      return {
        code:         get('code'),
        name:         get('name'),
        marca:        get('marca') || '',
        category:     get('category') || DEFAULT_CATEGORY,
        codigoPrecio,
        baseCode,
        price,
        stock:        parseFloat(get('stock')) || 0,
        minStock:     parseFloat(get('minStock')) || 0,
        unit:         get('unit') || DEFAULT_UNIT,
      };
    }).filter(p => p.code && p.name);

    try {
      const result = await onImport(products);
      setImportResult(result);
      setStep('preview');
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Ocurrió un error al importar. Revisá la consola para más detalles.');
    } finally {
      setImporting(false);
    }
  };

  const preview = rows.slice(0, 5);

  return (
    <div className="import-overlay">
      <div className="import-modal">
        {/* Header */}
        <div className="import-header">
          <div className="import-title">
            <FileSpreadsheet size={22} />
            <h2>Importar productos desde Excel</h2>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Steps indicator */}
        <div className="steps-bar">
          {['Subir archivo', 'Mapear columnas', 'Resultado'].map((s, i) => (
            <div key={i} className={`step ${step === ['upload','map','preview'][i] ? 'active' : (i < ['upload','map','preview'].indexOf(step) ? 'done' : '')}`}>
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{s}</span>
              {i < 2 && <ChevronRight size={14} className="step-arrow" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} />
            <p className="upload-title">Hacé click para seleccionar tu archivo</p>
            <p className="upload-sub">Formatos soportados: .xlsx, .xls, .csv</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* ── STEP 2: Map columns ── */}
        {step === 'map' && (
          <div className="map-step">
            <p className="map-hint">
              Tu archivo tiene <strong>{rows.length} productos</strong> y <strong>{headers.length} columnas</strong>.
              Indicá qué columna de tu Excel corresponde a cada campo:
            </p>

            <div className="map-grid">
              {PRODUCT_FIELDS.map(field => (
                <div key={field.key} className="map-row">
                  <span className="map-field-label">
                    {field.label}
                    {field.required && <span className="required-dot"> *</span>}
                  </span>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  >
                    <option value="">— No importar —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="map-preview">
              <p className="preview-title">Vista previa (primeras 5 filas):</p>
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {PRODUCT_FIELDS.filter(f => mapping[f.key] !== undefined).map(f => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {PRODUCT_FIELDS.filter(f => mapping[f.key] !== undefined).map(f => (
                          <td key={f.key}>{String(row[mapping[f.key]] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {((!mapping.code && mapping.code !== 0) || (!mapping.name && mapping.name !== 0)) && (
              <p className="map-error"><AlertTriangle size={14} /> Los campos Código y Nombre son obligatorios.</p>
            )}
            {importError && (
              <p className="map-error"><AlertTriangle size={14} /> {importError}</p>
            )}

            <div className="map-actions">
              <button className="btn-secondary" onClick={() => setStep('upload')}>← Volver</button>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={importing || mapping.code === undefined || mapping.name === undefined}
              >
                {importing
                  ? <><span className="spinner" /> Importando {rows.length} productos...</>
                  : `Importar ${rows.length} productos`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Result ── */}
        {step === 'preview' && importResult && (
          <div className="result-step">
            <div className="result-icon success">
              <Check size={48} />
            </div>
            <h3>¡Importación completada!</h3>
            <p className="result-detail">
              Se importaron <strong>{importResult.total}</strong> productos al stock.
              {importResult.skipped > 0 && ` Se omitieron ${importResult.skipped} filas sin código o nombre.`}
            </p>
            <button className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .import-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 1rem;
        }

        .import-modal {
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          width: 100%;
          max-width: 720px;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .import-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid var(--border-color);
        }

        .import-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--primary-gold);
        }

        .import-title h2 {
          font-size: 1.1rem;
          margin: 0;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s;
        }

        .close-btn:hover { color: white; }

        .steps-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--border-color);
        }

        .step {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .step.active { color: var(--primary-gold); }
        .step.done   { color: #2ecc71; }

        .step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid currentColor;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .step-label { font-weight: 500; }
        .step-arrow { color: var(--border-color); margin-left: 0.5rem; }

        /* Upload */
        .upload-zone {
          margin: 2rem;
          border: 2px dashed var(--border-color);
          border-radius: 16px;
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .upload-zone:hover {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
          background: rgba(212, 175, 55, 0.04);
        }

        .upload-title { font-size: 1.1rem; font-weight: 600; margin: 0; }
        .upload-sub   { font-size: 0.85rem; margin: 0; }

        /* Map */
        .map-step {
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .map-hint { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
        .map-hint strong { color: white; }

        .map-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.6rem 2rem;
        }

        .map-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .map-field-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: white;
          white-space: nowrap;
          min-width: 100px;
        }

        .required-dot { color: var(--primary-gold); }

        .map-row select {
          flex: 1;
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          outline: none;
        }

        .map-row select:focus { border-color: var(--primary-gold); }
        .map-row select option { background: #1a1a1a; }

        .map-preview { margin-top: 0.5rem; }
        .preview-title { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; }

        .preview-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          max-height: 180px;
          overflow-y: auto;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .preview-table th {
          background: rgba(212,175,55,0.08);
          padding: 0.5rem 0.75rem;
          text-align: left;
          color: var(--primary-gold);
          font-size: 0.75rem;
          white-space: nowrap;
          border-bottom: 1px solid var(--border-color);
        }

        .preview-table td {
          padding: 0.45rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: var(--text-secondary);
          white-space: nowrap;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .map-error {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #e74c3c;
          font-size: 0.85rem;
          margin: 0;
        }

        .map-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        /* Result */
        .result-step {
          padding: 2.5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
        }

        .result-icon.success {
          color: #2ecc71;
          background: rgba(46, 204, 113, 0.1);
          border-radius: 50%;
          padding: 1rem;
        }

        .result-step h3 { font-size: 1.3rem; margin: 0; }
        .result-detail  { color: var(--text-secondary); margin: 0; }
        .result-detail strong { color: white; }

        .btn-secondary {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-right: 6px;
          vertical-align: middle;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ImportExcelModal;
