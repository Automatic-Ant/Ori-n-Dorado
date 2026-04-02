import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../utils/formatCurrency';

async function getLogoBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function generateQuotePDF({ cart, total, discount, discountPct, finalTotal, customerDni }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const gold = [212, 175, 55];
  const dark = [20, 20, 20];
  const grey = [120, 120, 120];

  // ── Logo ──────────────────────────────────────────────────────
  try {
    const logoData = await getLogoBase64('/logo.png');
    doc.addImage(logoData, 'PNG', 14, 12, 22, 22);
  } catch (_) {
    // logo failed to load — continue without it
  }

  // ── Header text ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...gold);
  doc.text('ORIÓN DORADO MATERIALES ELÉCTRICOS', 40, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text('Av. Riavitz 184, Plottier  |  Tel: 299-4769198', 40, 27);

  // ── Title ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text('PRESUPUESTO', 196, 18, { align: 'right' });

  // ── Meta (date + customer) ────────────────────────────────────
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text(`Fecha: ${dateStr}`, 196, 25, { align: 'right' });

  if (customerDni) {
    doc.text(`Cliente: ${customerDni}`, 196, 31, { align: 'right' });
  }

  // ── Divider ───────────────────────────────────────────────────
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  // ── Items table ───────────────────────────────────────────────
  const tableBody = cart.map((item) => [
    item.name,
    item.quantity % 1 === 0 ? item.quantity : item.quantity.toString(),
    formatCurrency(item.price),
    formatCurrency(item.price * item.quantity),
  ]);

  const tableFoot = [];
  if (discount > 0) {
    tableFoot.push([
      { content: `Subtotal`, colSpan: 3, styles: { halign: 'right', fontStyle: 'normal', textColor: grey } },
      { content: formatCurrency(total), styles: { halign: 'right', fontStyle: 'normal', textColor: grey } },
    ]);
    tableFoot.push([
      { content: `Descuento efectivo (${discountPct}%)`, colSpan: 3, styles: { halign: 'right', fontStyle: 'normal', textColor: [46, 160, 90] } },
      { content: `-${formatCurrency(discount)}`, styles: { halign: 'right', fontStyle: 'normal', textColor: [46, 160, 90] } },
    ]);
  }
  tableFoot.push([
    { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } },
    { content: formatCurrency(finalTotal), styles: { halign: 'right', fontStyle: 'bold', fontSize: 11, textColor: gold } },
  ]);

  autoTable(doc, {
    startY: 44,
    head: [['Producto', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: {
      fillColor: gold,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: dark,
    },
    footStyles: {
      fillColor: [245, 245, 245],
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    styles: {
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
    },
    margin: { left: 14, right: 14 },
  });

  // ── Save ──────────────────────────────────────────────────────
  const fileName = `presupuesto_${dateStr.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}
