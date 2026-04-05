import { useState } from 'react';
import { PlusCircle, MinusCircle, Clock, Trash2 } from 'lucide-react';
import { useCajaStore } from '../../store/cajaStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatCurrency';

const Caja = () => {
  const movements = useCajaStore((state) => state.movements);
  const addMovement = useCajaStore((state) => state.addMovement);
  const removeMovement = useCajaStore((state) => state.removeMovement);
  const user = useAuthStore((state) => state.user);

  const [type, setType] = useState('ingreso');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMovements = movements.filter(
    (m) => m.date && m.date.startsWith(todayStr)
  );

  const totalIngresos = todayMovements
    .filter((m) => m.type === 'ingreso')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalEgresos = todayMovements
    .filter((m) => m.type === 'egreso')
    .reduce((sum, m) => sum + m.amount, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!parsed || parsed <= 0) return;
    addMovement({
      type,
      amount: parsed,
      description,
      sellerName: user?.name || '',
    });
    setAmount('');
    setDescription('');
  };

  return (
    <div className="caja-container">

      {/* ── Resumen del día ── */}
      <div className="caja-summary-row">
        <div className="caja-summary-card ingreso-card card glass">
          <PlusCircle size={28} />
          <div>
            <span className="summary-label">Ingresos de caja — Hoy</span>
            <span className="summary-amount">{formatCurrency(totalIngresos)}</span>
          </div>
        </div>
        <div className="caja-summary-card egreso-card card glass">
          <MinusCircle size={28} />
          <div>
            <span className="summary-label">Egresos de caja — Hoy</span>
            <span className="summary-amount">{formatCurrency(totalEgresos)}</span>
          </div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="caja-form-card card glass">
        <h3 className="form-title">Registrar movimiento</h3>

        <form onSubmit={handleSubmit} className="caja-form">
          {/* Tipo */}
          <div className="type-toggle">
            <button
              type="button"
              className={`type-btn ingreso-btn ${type === 'ingreso' ? 'active' : ''}`}
              onClick={() => setType('ingreso')}
            >
              <PlusCircle size={18} />
              Agregar dinero
            </button>
            <button
              type="button"
              className={`type-btn egreso-btn ${type === 'egreso' ? 'active' : ''}`}
              onClick={() => setType('egreso')}
            >
              <MinusCircle size={18} />
              Sacar dinero
            </button>
          </div>

          {/* Monto */}
          <div className="field-group">
            <label>Monto</label>
            <div className="amount-input-wrapper">
              <span className="currency-sign">$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                required
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="field-group">
            <label>Descripción <span className="optional">(opcional)</span></label>
            <input
              type="text"
              placeholder="Ej: Pago proveedor, apertura de caja..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="desc-input"
            />
          </div>

          <button type="submit" className={`btn-primary submit-btn ${type}`}>
            {type === 'ingreso' ? <PlusCircle size={18} /> : <MinusCircle size={18} />}
            {type === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
          </button>
        </form>
      </div>

      {/* ── Historial del día ── */}
      <div className="caja-history card glass">
        <h3 className="history-title">Movimientos de hoy</h3>

        {todayMovements.length === 0 ? (
          <p className="empty-msg">No hay movimientos registrados hoy.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Usuario</th>
                <th>Hora</th>
                <th className="text-right">Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {todayMovements.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className={`type-badge ${m.type}`}>
                      {m.type === 'ingreso' ? '+ Ingreso' : '− Egreso'}
                    </span>
                  </td>
                  <td className="desc-cell">{m.description || '—'}</td>
                  <td className="seller-cell">{m.sellerName || '—'}</td>
                  <td>
                    <div className="time-cell">
                      <Clock size={13} />
                      {m.time}
                    </div>
                  </td>
                  <td className={`amount-cell text-right ${m.type}`}>
                    {m.type === 'ingreso' ? '+' : '−'} {formatCurrency(m.amount)}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-remove"
                      onClick={() => removeMovement(m.id)}
                      title="Eliminar movimiento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .caja-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 2rem;
        }

        /* ── Summary ── */
        .caja-summary-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .caja-summary-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.5rem 2rem;
          border-radius: 16px;
        }

        .ingreso-card {
          color: #2ecc71;
        }

        .egreso-card {
          color: #e74c3c;
        }

        .caja-summary-card > div {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .summary-label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-secondary);
        }

        .summary-amount {
          font-size: 1.8rem;
          font-weight: 900;
          line-height: 1;
        }

        /* ── Form ── */
        .caja-form-card {
          padding: 2rem;
          border-radius: 16px;
          max-width: 560px;
        }

        .form-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 1.5rem 0;
        }

        .caja-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .type-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .type-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ingreso-btn.active {
          background: rgba(46, 204, 113, 0.12);
          border-color: #2ecc71;
          color: #2ecc71;
        }

        .egreso-btn.active {
          background: rgba(231, 76, 60, 0.12);
          border-color: #e74c3c;
          color: #e74c3c;
        }

        .type-btn:hover:not(.active) {
          background: rgba(255,255,255,0.06);
          color: white;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .field-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .optional {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
        }

        .amount-input-wrapper {
          display: flex;
          align-items: center;
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 0 1rem;
          gap: 0.5rem;
          height: 52px;
          transition: border-color 0.2s;
        }

        .amount-input-wrapper:focus-within {
          border-color: var(--primary-gold);
        }

        .currency-sign {
          color: var(--primary-gold);
          font-weight: 700;
          font-size: 1.1rem;
        }

        .amount-input-wrapper input {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.3rem;
          font-weight: 700;
          width: 100%;
          padding: 0;
        }

        .desc-input {
          height: 48px;
          padding: 0 1rem;
          border-radius: 10px;
        }

        .submit-btn {
          height: 52px;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .submit-btn.egreso {
          background: #e74c3c;
        }

        .submit-btn.egreso:hover {
          background: #c0392b;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }

        /* ── History ── */
        .caja-history {
          padding: 2rem;
          border-radius: 16px;
        }

        .history-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 1.5rem 0;
        }

        .history-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 8px;
        }

        .history-table th {
          text-align: left;
          padding: 0.5rem 1rem;
          color: var(--text-secondary);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .history-table td {
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-top: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }

        .history-table td:first-child {
          border-left: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px 0 0 10px;
        }

        .history-table td:last-child {
          border-right: 1px solid rgba(255,255,255,0.04);
          border-radius: 0 10px 10px 0;
        }

        .type-badge {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .type-badge.ingreso {
          background: rgba(46, 204, 113, 0.1);
          color: #2ecc71;
        }

        .type-badge.egreso {
          background: rgba(231, 76, 60, 0.1);
          color: #e74c3c;
        }

        .desc-cell {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .seller-cell {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .time-cell {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .amount-cell {
          font-weight: 800;
          font-size: 1rem;
        }

        .amount-cell.ingreso { color: #2ecc71; }
        .amount-cell.egreso  { color: #e74c3c; }

        .text-right { text-align: right; }

        .btn-remove {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
        }

        .btn-remove:hover { color: #e74c3c; }

        .empty-msg {
          color: var(--text-secondary);
          font-style: italic;
          text-align: center;
          padding: 2rem;
        }

        @media (max-width: 1366px) {
          .caja-summary-row {
            gap: 1rem;
          }
          .summary-card {
            padding: 1rem 1.25rem;
          }
          .summary-amount {
            font-size: 1.5rem;
          }
          .caja-form-card {
            padding: 1.25rem;
          }
        }

        @media (max-width: 768px) {
          .caja-summary-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Caja;
