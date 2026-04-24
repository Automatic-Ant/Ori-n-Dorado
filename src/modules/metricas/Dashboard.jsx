import {
  ShoppingBag,
  Clock,
  XCircle,
  RefreshCcw,
  Plus,
  AlertTriangle,
  Eye,
  Banknote,
  CreditCard,
  PlusCircle,
  MinusCircle,
  Download
} from 'lucide-react';
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useProductStore } from '../../store/productStore';
import { useSaleStore } from '../../store/saleStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatCurrency';
import Modal from '../../components/Modal';
import { useCajaStore } from '../../store/cajaStore';
import { saleService } from '../../services/saleService';

const Dashboard = () => {
  const sales = useSaleStore((state) => state.sales);
  const cancelSale = useSaleStore((state) => state.cancelSale);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);

  const handleOpenCancelModal = (sale) => {
    setSaleToCancel(sale);
    setIsCancelModalOpen(true);
  };

  const handleOpenDetails = (sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (saleToCancel) {
      // The DB trigger trg_restaurar_stock_al_cancelar will handle stock automatically
      await cancelSale(saleToCancel.id);
      setIsCancelModalOpen(false);
      setSaleToCancel(null);
    }
  };

  const cajaMovements = useCajaStore((state) => state.movements);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleExportExcel = () => {
    const [year, month] = exportMonth.split('-').map(Number);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    const monthlySales = sales.filter(
      (s) => s.date && s.date.startsWith(prefix)
    );

    // Sheet 1: Ventas
    const salesRows = monthlySales.map((s) => ({
      'ID':            s.id,
      'Fecha':         s.date ? new Date(s.date).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '',
      'Hora':          s.time || '',
      'Cliente':       s.customerName || s.customerDni || 'Cliente General',
      'Vendedor':      s.sellerName || '',
      'Método Pago':   s.paymentMethod || '',
      'Descuento':     s.discount || 0,
      'Total':         s.total || 0,
      'Estado':        s.status === 'cancelado' ? 'Cancelado' : 'Completada',
    }));

    // Sheet 2: Detalle de items
    const itemRows = [];
    monthlySales.forEach((s) => {
      (s.items || []).forEach((item) => {
        itemRows.push({
          'Venta ID':   s.id,
          'Fecha':      s.date ? new Date(s.date).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '',
          'Producto':   item.name,
          'Código':     item.code || '',
          'Cantidad':   item.quantity,
          'Precio Unit.': item.price,
          'Subtotal':   item.price * item.quantity,
          'Estado Venta': s.status === 'cancelado' ? 'Cancelado' : 'Completada',
        });
      });
    });

    // Sheet 3: Movimientos de caja
    const cajaRows = cajaMovements
      .filter((m) => m.date && m.date.startsWith(prefix))
      .map((m) => ({
        'Fecha':       m.date ? new Date(m.date).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '',
        'Hora':        m.time || '',
        'Tipo':        m.type === 'ingreso' ? 'Ingreso' : 'Egreso',
        'Monto':       m.amount,
        'Descripción': m.description || '',
        'Usuario':     m.sellerName || '',
      }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows),  'Ventas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows),   'Detalle Productos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cajaRows),   'Caja');

    XLSX.writeFile(wb, `backup_${prefix}.xlsx`);
  };

  const { totalEfectivo, totalDigital, todayCaja } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const todaySales = sales.filter(
      (s) => s.status !== 'cancelado' && s.date && s.date.startsWith(todayStr)
    );

    const todayCajaMovements = cajaMovements.filter((m) => m.date && m.date.startsWith(todayStr));
    const ingresos = todayCajaMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
    const egresos  = todayCajaMovements.filter((m) => m.type === 'egreso').reduce((sum, m) => sum + m.amount, 0);

    // Precise calculation using the new paymentDetail
    let efectivo = ingresos - egresos;
    let digital = 0;

    todaySales.forEach(s => {
      const details = s.paymentDetail || {};
      // Fallback for old sales without details
      if (Object.keys(details).length === 0) {
        if (s.paymentMethod?.toLowerCase().includes('efectivo')) {
          efectivo += (s.total || 0);
        } else {
          digital += (s.total || 0);
        }
      } else {
        efectivo += (details.efectivo || 0);
        digital += (details.qr || 0) + (details.debito || 0) + (details.tarjeta || 0) + (details.transferencia || 0);
      }
    });

    return {
      totalEfectivo: efectivo,
      totalDigital: digital,
      todayCaja: todayCajaMovements
    };
  }, [sales, cajaMovements]);

  return (
    <div className="dashboard">
      {isAdmin && (
        <div className="export-bar">
          <span className="export-label"><Download size={15} /> Exportar backup mensual:</span>
          <input
            type="month"
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="month-picker"
          />
          <button className="btn-export" onClick={handleExportExcel}>
            Descargar Excel
          </button>
        </div>
      )}

      <div className="daily-totals-row">
        <div className="daily-card card glass efectivo-card">
          <div className="daily-card-icon">
            <Banknote size={28} />
          </div>
          <div className="daily-card-info">
            <span className="daily-card-label">Efectivo — Hoy</span>
            <span className="daily-card-amount">{formatCurrency(totalEfectivo)}</span>
          </div>
        </div>

        <div className="daily-card card glass digital-card">
          <div className="daily-card-icon">
            <CreditCard size={28} />
          </div>
          <div className="daily-card-info">
            <span className="daily-card-label">QR / Débito / Tarjeta / Transf. — Hoy</span>
            <span className="daily-card-amount">{formatCurrency(totalDigital)}</span>
          </div>
        </div>
      </div>

      {todayCaja.length > 0 && (
        <div className="caja-section card glass">
          <div className="section-header">
            <div className="title-with-icon">
              <Banknote className="text-gold" size={22} />
              <h3>Movimientos de Caja — Hoy</h3>
            </div>
          </div>
          <table className="caja-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Usuario</th>
                <th>Hora</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {todayCaja.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className={`caja-type-badge ${m.type}`}>
                      {m.type === 'ingreso'
                        ? <><PlusCircle size={13} /> Ingreso</>
                        : <><MinusCircle size={13} /> Egreso</>}
                    </span>
                  </td>
                  <td className="caja-desc">{m.description || '—'}</td>
                  <td className="caja-seller">{m.sellerName || '—'}</td>
                  <td>
                    <div className="sale-time"><Clock size={13} />{m.date ? new Date(m.date).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : ''} {m.time}</div>
                  </td>
                  <td className={`text-right caja-amount ${m.type}`}>
                    {m.type === 'ingreso' ? '+' : '−'} {formatCurrency(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dashboard-grid single-column">
        <div className="recent-sales card glass full-width">
          <div className="section-header">
            <div className="title-with-icon">
              <ShoppingBag className="text-gold" size={24} />
              <h3>Ventas Recientes</h3>
            </div>
            <div className="header-actions">
              {/* Nueva venta quitada por pedido del usuario */}
            </div>
          </div>

          <div className="sales-container">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Fecha/Hora</th>
                  <th>Metodo</th>
                  <th>Descuento</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {[...sales].reverse().map((sale) => (
                  <tr key={sale.id} className={sale.status === 'cancelado' ? 'sale-cancelled' : ''}>
                    <td>
                      <span className="sale-id">{sale.id}</span>
                    </td>
                    <td>
                      <span className="sale-customer">{sale.customerName || sale.customerDni || 'Cliente General'}</span>
                    </td>
                    <td>
                      <span className="sale-seller">{sale.sellerName || '-'}</span>
                    </td>
                    <td>
                      <div className="sale-time">
                        <Clock size={14} />
                        <span>{saleService.formatSaleDate(sale.date)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="payment-method-tag">
                        {Object.keys(sale.paymentDetail || {}).length > 1 
                          ? 'Múltiple' 
                          : (sale.paymentMethod || '—')}
                      </span>
                    </td>
                    <td>
                      {sale.discount > 0 ? (
                        <span className="discount-tag">-{formatCurrency(sale.discount)}</span>
                      ) : (
                        <span className="no-discount">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${sale.status}`}>
                        {sale.status === 'cancelado' ? 'Cancelado' : 'Completada'}
                      </span>
                    </td>
                    <td className="sale-amount-cell">
                      <span className="sale-amount">{formatCurrency(sale.total)}</span>
                    </td>
                    <td className="text-right flex-actions">
                      <button 
                        className="btn-info-text action-btn"
                        onClick={() => handleOpenDetails(sale)}
                        title="Ver Detalles"
                      >
                        <Eye size={18} />
                        <span>Detalles</span>
                      </button>

                      {sale.status !== 'cancelado' && (
                        <button 
                          className="btn-danger-text action-btn" 
                          onClick={() => handleOpenCancelModal(sale)}
                          title="Cancelar Venta"
                        >
                          <XCircle size={18} />
                          <span>Cancelar</span>
                        </button>
                      )}
                      {sale.status === 'cancelado' && (
                        <span className="cancelled-info">
                          <RefreshCcw size={14} /> Stock devuelto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan="9" className="empty-msg">No hay ventas registradas recientemente.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DETALLES */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Detalle de Venta ${selectedSale?.id}`}
      >
        {selectedSale && (
          <div className="sale-details-content">
            <div className="details-header-info">
              <p><strong>Cliente:</strong> {selectedSale.customerName || selectedSale.customerDni || 'Cliente General'}</p>
              <p><strong>Vendedor:</strong> {selectedSale.sellerName || '-'}</p>
              <p><strong>Fecha/Hora:</strong> {saleService.formatSaleDate(selectedSale.date)}</p>
              <div className="payment-details-info">
                <strong>Método de Pago:</strong>
                {Object.keys(selectedSale.paymentDetail || {}).length > 0 ? (
                  <div className="payment-splits">
                    {Object.entries(selectedSale.paymentDetail).map(([method, amount]) => (
                      <span key={method} className="split-badge capitalize">
                        {method}: {formatCurrency(amount)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="capitalize"> {selectedSale.paymentMethod}</span>
                )}
              </div>
            </div>

            <div className="details-items-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-center">Cant.</th>
                    <th className="text-right">Unitario</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div className="item-info">
                          <span className="item-name">{item.name}</span>
                          <span className="item-code text-secondary">{item.code}</span>
                        </div>
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.price)}</td>
                      <td className="text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {selectedSale.discount > 0 && (
                    <>
                      <tr>
                        <td colSpan="3" className="text-right subtotal-label">Subtotal:</td>
                        <td className="text-right subtotal-value">{formatCurrency(selectedSale.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="text-right discount-label-tfoot">
                          Descuento ({selectedSale.discount_pct || selectedSale.discountPct || ''}%):
                        </td>
                        <td className="text-right discount-value">-{formatCurrency(selectedSale.discount)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="total-row">
                    <td colSpan="3" className="text-right">TOTAL PAGADO:</td>
                    <td className="text-right total-amount">{formatCurrency(selectedSale.total)}</td>
                  </tr>
                </tfoot>
              </table>
              {selectedSale.discount > 0 && (
                <div className="discount-note">
                  * Incluye descuento y redondeo al 100 más cercano.
                </div>
              )}
            </div>

            <div className="modal-actions full-width">
              <button className="btn-primary" onClick={() => setIsDetailModalOpen(false)}>
                Cerrar Detalle
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL CANCELAR */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Confirmar Cancelación de Venta"
      >
        <div className="cancel-confirmation-content">
          <div className="alert-icon-wrapper">
            <AlertTriangle size={48} className="text-error" />
          </div>
          <h3>¿Estás seguro de cancelar la venta {saleToCancel?.id}?</h3>
          <p>Esta acción es irreversible. Se realizarán los siguientes cambios:</p>
          <ul className="impact-list">
            <li>El estado de la venta cambiará a <strong>"Cancelado"</strong>.</li>
            <li>El stock de los productos vendidos se <strong>restaurará</strong> automáticamente.</li>
            <li>El monto total ya no se contabilizará en las métricas de venta.</li>
          </ul>
          
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setIsCancelModalOpen(false)}>
              No, mantener venta
            </button>
            <button className="btn-danger" onClick={handleConfirmCancel}>
              Sí, cancelar venta y devolver stock
            </button>
          </div>
        </div>
      </Modal>


      <style jsx>{`
        .dashboard {
          padding-bottom: 2rem;
        }

        .export-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          background: rgba(212, 175, 55, 0.05);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          flex-wrap: wrap;
        }

        .export-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--primary-gold);
          white-space: nowrap;
        }

        .month-picker {
          background: var(--surface-lighter);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          cursor: pointer;
        }

        .month-picker:focus {
          border-color: var(--primary-gold);
        }

        .btn-export {
          padding: 0.45rem 1.1rem;
          background: var(--primary-gold);
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-export:hover {
          background: #e8c547;
          transform: translateY(-1px);
        }

        .daily-totals-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .daily-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.5rem 2rem;
          border-radius: 16px;
        }

        .daily-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 14px;
          flex-shrink: 0;
        }

        .efectivo-card .daily-card-icon {
          background: rgba(46, 204, 113, 0.12);
          color: #2ecc71;
        }

        .digital-card .daily-card-icon {
          background: rgba(52, 152, 219, 0.12);
          color: #3498db;
        }

        .daily-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .daily-card-label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-secondary);
        }

        .daily-card-amount {
          font-size: 1.8rem;
          font-weight: 900;
          line-height: 1;
        }

        .efectivo-card .daily-card-amount {
          color: #2ecc71;
        }

        .digital-card .daily-card-amount {
          color: #3498db;
        }

        .caja-section {
          padding: 1.5rem 2rem;
        }

        .caja-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 8px;
        }

        .caja-table th {
          text-align: left;
          padding: 0.5rem 1rem;
          color: var(--text-secondary);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .caja-table td {
          padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.03);
          border-top: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }

        .caja-table td:first-child {
          border-left: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px 0 0 10px;
        }

        .caja-table td:last-child {
          border-right: 1px solid rgba(255,255,255,0.04);
          border-radius: 0 10px 10px 0;
        }

        .caja-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .caja-type-badge.ingreso {
          background: rgba(46, 204, 113, 0.1);
          color: #2ecc71;
        }

        .caja-type-badge.egreso {
          background: rgba(231, 76, 60, 0.1);
          color: #e74c3c;
        }

        .caja-desc {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .caja-seller {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .caja-amount {
          font-weight: 800;
          font-size: 1rem;
        }

        .caja-amount.ingreso { color: #2ecc71; }
        .caja-amount.egreso  { color: #e74c3c; }

        .dashboard-grid.single-column {
          display: flex;
          flex-direction: column;
        }

        .full-width {
          width: 100%;
        }

        .recent-sales {
          padding: 2rem;
          min-height: 400px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
        }

        .title-with-icon {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .title-with-icon h3 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .text-gold {
          color: var(--primary-gold);
        }

        .sales-container {
          overflow-x: auto;
        }

        .sales-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
        }

        .sales-table th {
          text-align: left;
          padding: 1rem;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .sales-table tbody tr {
          background: rgba(255, 255, 255, 0.03);
          transition: background 0.2s;
        }

        .sales-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .sales-table td {
          padding: 1.25rem 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .sales-table td:first-child {
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px 0 0 12px;
        }

        .sales-table td:last-child {
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0 12px 12px 0;
        }

        .sale-id {
          font-weight: 800;
          color: var(--primary-gold);
        }

        .sale-customer {
          font-weight: 500;
        }

        .sale-seller {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .sale-time {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-badge.completada {
          background: rgba(46, 204, 113, 0.1);
          color: #2ecc71;
        }

        .status-badge.cancelado {
          background: rgba(231, 76, 60, 0.1);
          color: #e74c3c;
        }

        .sale-amount {
          font-weight: 800;
          font-size: 1.1rem;
        }

        .discount-tag {
          font-size: 0.8rem;
          font-weight: 700;
          color: #2ecc71;
        }

        .no-discount {
          color: var(--text-secondary);
          opacity: 0.4;
        }

        .flex-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          align-items: center;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.85rem;
          font-weight: 600;
          height: 38px;
        }

        .btn-info-text {
          color: var(--primary-gold);
        }

        .btn-info-text:hover {
          background: rgba(212, 175, 55, 0.15);
          border-color: var(--primary-gold);
          transform: translateY(-2px);
        }

        .btn-danger-text {
          color: #e74c3c;
        }

        .btn-danger-text:hover {
          background: rgba(231, 76, 60, 0.15);
          border-color: #e74c3c;
          transform: translateY(-2px);
        }

        .payment-method-tag {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(212, 175, 55, 0.1);
          color: var(--primary-gold);
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .sale-details-content {
          padding-top: 1rem;
        }

        .details-header-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .details-header-info p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .details-header-info p strong {
          color: white;
          margin-right: 6px;
        }

        .details-items-container {
          margin-top: 1.5rem;
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 4px;
        }

        .details-table {
          width: 100%;
          border-collapse: collapse;
        }

        .details-table th {
          text-align: left;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .details-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-name {
          font-weight: 600;
          color: white;
        }

        .item-code {
          font-size: 0.75rem;
          font-family: monospace;
          color: var(--text-secondary);
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .capitalize { text-transform: capitalize; }

        .subtotal-label, .discount-label-tfoot {
          color: var(--text-secondary);
          font-size: 0.85rem;
          padding-top: 1.5rem;
          border-bottom: none;
        }

        .subtotal-value {
          font-size: 0.95rem;
          padding-top: 1.5rem;
          border-bottom: none;
        }

        .discount-value {
          color: #2ecc71;
          font-weight: 700;
          border-bottom: none;
        }

        .discount-label-tfoot {
          color: #2ecc71;
        }

        .total-row td {
          padding-top: 2rem;
          border-bottom: none;
        }

        .total-amount {
          font-size: 1.6rem;
          color: var(--primary-gold);
          font-weight: 900;
        }

        .discount-note {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          font-size: 0.8rem;
          color: #2ecc71;
          font-style: italic;
          text-align: right;
          background: rgba(46, 204, 113, 0.05);
          border-radius: 8px;
        }

        .cancelled-info {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-style: italic;
          background: rgba(255, 255, 255, 0.05);
          padding: 6px 12px;
          border-radius: 8px;
        }

        .sale-cancelled td {
          opacity: 0.5;
        }

        .sale-cancelled .sale-amount {
          text-decoration: line-through;
        }

        .cancel-confirmation-content {
          text-align: center;
          padding: 1rem;
        }

        .alert-icon-wrapper {
          margin-bottom: 1.5rem;
        }

        .text-error {
          color: #e74c3c;
        }

        .impact-list {
          text-align: left;
          margin: 1.5rem 0;
          padding-left: 1.5rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .impact-list li {
          margin-bottom: 0.6rem;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 2rem;
        }

        .modal-actions.full-width {
          display: block;
        }

        .btn-danger {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 0.8rem 1.5rem;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-danger:hover {
          background: #c0392b;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }

        .empty-msg {
          text-align: center;
          padding: 4rem;
          color: var(--text-secondary);
          font-style: italic;
        }

        @media (max-width: 1366px) {
          .daily-card {
            padding: 1rem 1.25rem;
            gap: 0.85rem;
          }
          .daily-card-icon {
            width: 44px;
            height: 44px;
            border-radius: 10px;
          }
          .daily-card-amount {
            font-size: 1.4rem;
          }
          .daily-card-label {
            font-size: 0.72rem;
          }
          .daily-totals-row {
            gap: 1rem;
            margin-bottom: 1rem;
          }
          .recent-sales {
            padding: 1.25rem;
            min-height: 0;
          }
          .caja-section {
            padding: 1rem 1.25rem;
          }
          .section-header {
            margin-bottom: 1.25rem;
          }
          .title-with-icon h3 {
            font-size: 1.1rem;
          }
          .sales-table th {
            padding: 0.5rem 0.6rem;
            font-size: 0.75rem;
          }
          .sales-table td {
            padding: 0.75rem 0.6rem;
            font-size: 0.85rem;
          }
          .sale-amount {
            font-size: 0.95rem;
          }
          .action-btn {
            padding: 5px 10px;
            font-size: 0.8rem;
            height: 32px;
          }
          .caja-table th {
            padding: 0.4rem 0.6rem;
            font-size: 0.72rem;
          }
          .caja-table td {
            padding: 0.6rem 0.6rem;
            font-size: 0.82rem;
          }
        }

        @media (max-width: 768px) {
          .daily-totals-row {
            grid-template-columns: 1fr;
          }
          .sales-table {
            min-width: 600px;
          }
          .details-header-info {
            grid-template-columns: 1fr;
          }
          .recent-sales {
            padding: 1rem;
          }
          .action-btn span {
            display: none;
          }
          .action-btn {
            padding: 6px;
            width: 32px;
            justify-content: center;
          }
          .export-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

    </div>
  );
};

export default Dashboard;
