import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface Cartaz {
  local: string;
  token: string;
  /** Base do site, pra montar o link que a câmera do celular vai abrir. */
  origem?: string;
  marcacoes: string[];
}

/**
 * Cartaz A4 pra imprimir e colar na parede. É o único lugar onde o token
 * aparece em claro — depois de impresso, o banco só tem o hash. Rotacionar o
 * QR gera um token novo e mata o cartaz antigo na hora.
 */
export const baixarCartazQr = async ({ local, token, origem, marcacoes }: Cartaz) => {
  const base = origem ?? window.location.origin;
  const url = `${base}/ponto/q/${token}`;

  // Correção de erro alta: o cartaz vive na parede da cozinha e vai pegar
  // respingo, poeira e dedo engordurado.
  const imagem = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 900,
  });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const centro = largura / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('BATER PONTO', centro, 32, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text(local, centro, 44, { align: 'center' });

  const lado = 110;
  doc.addImage(imagem, 'PNG', centro - lado / 2, 56, lado, lado);

  doc.setFontSize(14);
  doc.text('Aponte a câmera do seu celular para o código', centro, 182, { align: 'center' });

  doc.setFontSize(11);
  doc.text('Precisa estar no Wi-Fi da loja e com seu celular liberado.', centro, 192, {
    align: 'center',
  });

  if (marcacoes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Aqui você bate: ${marcacoes.join(' · ')}`, centro, 204, { align: 'center' });
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(url, centro, 276, { align: 'center' });
  doc.text(
    `impresso em ${new Date().toLocaleDateString('pt-BR')} — se trocarem o código, este cartaz para de funcionar`,
    centro,
    282,
    { align: 'center' }
  );

  doc.save(`qr-ponto-${local.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
};
