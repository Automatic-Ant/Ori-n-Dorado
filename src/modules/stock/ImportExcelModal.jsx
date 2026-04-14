import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, Check, AlertTriangle, FileSpreadsheet, ChevronRight } from 'lucide-react';

const BASE_FIELDS = [
  { key: 'code',         label: 'Código',         required: true  },
  { key: 'name',         label: 'Nombre',          required: true  },
  { key: 'marca',        label: 'Marca',           required: false },
  { key: 'category',     label: 'Categoría',       required: false },
  { key: 'stock',        label: 'Stock inicial',   required: false },
  { key: 'minStock',     label: 'Stock mínimo',    required: false },
  { key: 'unit',         label: 'Unidad',          required: false },
];

const PRICE_FIELDS_CODIGO = [
  { key: 'codigoPrecio', label: 'Cód. Precio',     required: false },
  { key: 'baseCode',     label: 'Cód. Base',       required: false },
  { key: 'listPrice',    label: 'Precio de lista', required: false },
];

const PRICE_FIELDS_METRO = [
  { key: 'precioMetro',  label: 'Precio por metro ($/m)', required: false },
  { key: 'listPrice',    label: 'Precio de lista',         required: false },
];

const DEFAULT_CATEGORY = 'Otros';
const DEFAULT_UNIT = 'unidad';

const cleanNum = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  // Replace comma with dot and remove non-numeric chars except dot/minus
  const s = String(val).replace(',', '.').replace(/[^-0-9.]/g, '');
  return parseFloat(s) || 0;
};

const ImportExcelModal = ({ onClose, onImport }) => {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | map | preview
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [priceMode, setPriceMode] = useState('codigo'); // 'codigo' | 'metro'
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const allFields = [...BASE_FIELDS, ...(priceMode === 'metro' ? PRICE_FIELDS_METRO : PRICE_FIELDS_CODIGO)];

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
      [...BASE_FIELDS, ...PRICE_FIELDS_CODIGO, ...PRICE_FIELDS_METRO].forEach(field => {
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
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    if (mapping.code === undefined || mapping.name === undefined) return;

    setImporting(true);
    setImportError(null);
    setProgress(0);

    const products = rows.map(row => {
      const get = (key) => {
        const idx = mapping[key];
        return idx !== undefined && idx !== '' ? String(row[idx] ?? '').trim() : '';
      };

      let codigoPrecio, baseCode, price;

      if (priceMode === 'metro') {
        // Precio directo por metro: codigoPrecio = precio/m, baseCode = 1
        codigoPrecio = parseFloat(get('precioMetro')) || 0;
        baseCode     = 1;
        price        = codigoPrecio;
      } else {
        // Precio por código: price = codigoPrecio × baseCode
        codigoPrecio = cleanNum(get('codigoPrecio'));
        baseCode     = cleanNum(get('baseCode'));
        price        = (codigoPrecio && baseCode) ? (codigoPrecio * baseCode) : 0;
      }

      return {
        code:         get('code'),
        name:         get('name'),
        marca:        get('marca') || '',
        category:     get('category') || DEFAULT_CATEGORY,
        codigoPrecio,
        baseCode,
        price,
        listPrice:    cleanNum(get('listPrice')),
        stock:        cleanNum(get('stock')),
        minStock:     cleanNum(get('minStock')),
        unit:         priceMode === 'metro' ? 'metro' : (get('unit') || DEFAULT_UNIT),
      };
    }).filter(p => p.code && p.name);

    // Detectar códigos duplicados en el Excel
    const codeCount = {};
    for (const p of products) codeCount[p.code] = (codeCount[p.code] || 0) + 1;
    const duplicates = Object.entries(codeCount).filter(([, n]) => n > 1).map(([code]) => code);
    if (duplicates.length > 0) {
      const preview = duplicates.slice(0, 5).join(', ');
      const extra = duplicates.length > 5 ? ` y ${duplicates.length - 5} más` : '';
      setImportError(`Tu Excel tiene códigos repetidos: ${preview}${extra}. Se va a conservar solo la última fila de cada uno.`);
    }

    try {
      const result = await onImport(products, (pct) => setProgress(pct));
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

            {/* Price mode selector */}
            <div className="price-mode-selector">
              <span className="price-mode-label">Tipo de precio:</span>
              <div className="price-mode-options">
                <button
                  type="button"
                  className={`price-mode-btn ${priceMode === 'codigo' ? 'active' : ''}`}
                  onClick={() => setPriceMode('codigo')}
                >
                  Por código (Cód. Precio × Cód. Base)
                </button>
                <button
                  type="button"
                  className={`price-mode-btn ${priceMode === 'metro' ? 'active' : ''}`}
                  onClick={() => setPriceMode('metro')}
                >
                  Por metro ($/m directo)
                </button>
              </div>
            </div>

            <div className="map-grid">
              {allFields.map(field => (
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
                      {allFields.filter(f => mapping[f.key] !== undefined).map(f => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {allFields.filter(f => mapping[f.key] !== undefined).map(f => (
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
            {importError && !importing && (
              <p className="map-error"><AlertTriangle size={14} /> {importError}</p>
            )}

            {importing ? (
              <div className="progress-section">
                <div className="progress-header">
                  <span className="progress-label">Subiendo {rows.length} productos...</span>
                  <span className="progress-pct">{progress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="progress-sub">
                  {progress < 90
                    ? 'Enviando datos a la base de datos...'
                    : progress < 100
                    ? 'Verificando cambios...'
                    : '¡Listo!'}
                </p>
              </div>
            ) : (
              <div className="map-actions">
                <button className="btn-secondary" onClick={() => setStep('upload')}>← Volver</button>
                <button
                  className="btn-primary"
                  onClick={handleImport}
                  disabled={mapping.code === undefined || mapping.name === undefined}
                >
                  Importar {rows.length} productos
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Result ── */}
        {step === 'preview' && importResult && (
          <div className="result-step">
            {importResult.total > 0 ? (
              <>
                <div className="result-icon success">
                  <Check size={48} />
                </div>
                <h3>¡Importación completada!</h3>
                <div className="result-stats">
                  <div className="result-stat">
                    <span className="result-stat-value">{importResult.total}</span>
                    <span className="result-stat-label">productos importados</span>
                  </div>
                  {importResult.totalInStore && (
                    <div className="result-stat total">
                      <span className="result-stat-value">{importResult.totalInStore}</span>
                      <span className="result-stat-label">total en inventario</span>
                    </div>
                  )}
                </div>
                {importResult.skipped > 0 && (
                  <div className="result-warning">
                    <AlertTriangle size={16} />
                    {importResult.skipped} productos no se pudieron subir (error de red o datos inválidos).
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="result-icon error">
                  <AlertTriangle size={48} />
                </div>
                <h3>No se pudo importar</h3>
                <p className="result-detail">
                  Ningún producto fue guardado en la base de datos.
                </p>
                {importResult.error && (
                  <div className="result-error-detail">
                    <strong>Error:</strong> {importResult.error}
                  </div>
                )}
              </>
            )}
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

        .price-mode-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(212, 175, 55, 0.05);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          padding: 0.75rem 1rem;
        }

        .price-mode-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .price-mode-options {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .price-mode-btn {
          padding: 0.4rem 1rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .price-mode-btn.active {
          background: var(--primary-gold);
          border-color: var(--primary-gold);
          color: #000;
          font-weight: 700;
        }

        .price-mode-btn:not(.active):hover {
          border-color: var(--primary-gold);
          color: var(--primary-gold);
        }

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

        .result-icon.error {
          color: #e74c3c;
          background: rgba(231, 76, 60, 0.1);
          border-radius: 50%;
          padding: 1rem;
        }

        .result-warning {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(243, 156, 18, 0.1);
          border: 1px solid rgba(243, 156, 18, 0.3);
          color: #f39c12;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
        }

        .result-step h3 { font-size: 1.3rem; margin: 0; }
        .result-detail  { color: var(--text-secondary); margin: 0; }
        .result-detail strong { color: white; }

        .result-stats {
          display: flex;
          gap: 2rem;
          justify-content: center;
          margin: 0.5rem 0;
        }

        .result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
        }

        .result-stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: #2ecc71;
          line-height: 1;
        }

        .result-stat.total .result-stat-value {
          color: var(--primary-gold);
        }

        .result-stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .result-error-detail {
          background: rgba(231, 76, 60, 0.08);
          border: 1px solid rgba(231, 76, 60, 0.3);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-size: 0.8rem;
          color: #e74c3c;
          text-align: left;
          width: 100%;
          word-break: break-word;
        }

        /* Progress bar */
        .progress-section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding: 0.25rem 0;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progress-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: white;
        }

        .progress-pct {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--primary-gold);
        }

        .progress-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary-gold), #f0c040);
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        .progress-sub {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0;
        }

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

      `}</style>
    </div>
  );
};

export default ImportExcelModal;
