import jsPDF from 'jspdf';

export interface PurchaseOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

const itemTotal = (item: PurchaseOrderItem) => item.quantity * item.unitPrice;
const orderTotal = (items: PurchaseOrderItem[]) => items.reduce((sum, item) => sum + itemTotal(item), 0);

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export const buildPurchaseOrderMessage = (items: PurchaseOrderItem[]): string => {
  const lines = items.map(
    (item) => `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice)} (${formatCurrency(itemTotal(item))})`
  );
  return `Olá! Gostaríamos de fazer o seguinte pedido:\n\n${lines.join('\n')}\n\nTotal: ${formatCurrency(orderTotal(items))}`;
};

export const downloadPurchaseOrderPdf = (supplierName: string, items: PurchaseOrderItem[]): void => {
  const doc = new jsPDF();
  const marginX = 15;
  let y = 20;

  doc.setFontSize(16);
  doc.text('Pedido de compra', marginX, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`Fornecedor: ${supplierName}`, marginX, y);
  y += 6;
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, marginX, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Item', marginX, y);
  doc.text('Qtd', 120, y);
  doc.text('Preço unit.', 140, y);
  doc.text('Subtotal', 175, y);
  y += 2;
  doc.line(marginX, y, 195, y);
  y += 6;

  for (const item of items) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(item.name, marginX, y, { maxWidth: 100 });
    doc.text(String(item.quantity), 120, y);
    doc.text(formatCurrency(item.unitPrice), 140, y);
    doc.text(formatCurrency(itemTotal(item)), 175, y);
    y += 8;
  }

  y += 4;
  doc.line(marginX, y, 195, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`Total: ${formatCurrency(orderTotal(items))}`, marginX, y);

  const safeName = supplierName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  doc.save(`pedido-${safeName}.pdf`);
};
