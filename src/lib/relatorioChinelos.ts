/**
 * Relatório de pedidos de chinelo para imprimir e entregar a quem encomenda.
 * Duas visões na mesma folha: o que encomendar (número x cor x quantidade, já
 * somado) e quem pediu cada um (nome e telefone, para avisar quando chegar).
 * Sem dependências do navegador, para poder testar fora do site.
 */

export interface PedidoDeChineloLinha {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  numero: string;
  cor: string;
  observacao: string | null;
  created_at: string;
}

export interface LinhaDeEncomenda {
  numero: string;
  cor: string;
  quantidade: number;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "37/38" antes de "39/40"; número que não é de loja (ex.: "Outro") vai para o fim. */
const pesoDoNumero = (n: string) => {
  const m = n.match(/\d+/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
};

/** Junta pedidos iguais (mesmo número e cor, sem ligar para maiúscula ou acento). */
export const somarParaEncomenda = (pedidos: PedidoDeChineloLinha[]): LinhaDeEncomenda[] => {
  const mapa = new Map<string, LinhaDeEncomenda>();
  pedidos.forEach((p) => {
    const chave = `${semAcento(p.numero)}|${semAcento(p.cor)}`;
    const atual = mapa.get(chave);
    if (atual) atual.quantidade += 1;
    else mapa.set(chave, { numero: p.numero.trim(), cor: p.cor.trim(), quantidade: 1 });
  });
  return [...mapa.values()].sort(
    (a, b) => pesoDoNumero(a.numero) - pesoDoNumero(b.numero) || a.cor.localeCompare(b.cor, 'pt-BR')
  );
};

export const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d);
};

/** A página inteira, pronta para abrir numa janela nova e imprimir. */
export const htmlDoRelatorio = (titulo: string, pedidos: PedidoDeChineloLinha[], hojeTexto: string): string => {
  const encomenda = somarParaEncomenda(pedidos);
  const total = pedidos.length;
  const ordenados = [...pedidos].sort(
    (a, b) => pesoDoNumero(a.numero) - pesoDoNumero(b.numero) || a.cor.localeCompare(b.cor, 'pt-BR') || a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
  );

  const linhasEncomenda = encomenda
    .map(
      (l) =>
        `<tr><td>${escaparHtml(l.numero)}</td><td>${escaparHtml(l.cor)}</td><td class="n">${l.quantidade}</td></tr>`
    )
    .join('');

  const linhasPedidos = ordenados
    .map(
      (p, i) =>
        `<tr><td class="n">${i + 1}</td><td>${escaparHtml(p.cliente_nome)}</td><td>${escaparHtml(p.cliente_telefone)}</td><td>${escaparHtml(p.numero)}</td><td>${escaparHtml(p.cor)}</td><td>${escaparHtml(p.observacao ?? '')}</td><td>${dataCurta(p.created_at)}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escaparHtml(titulo)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #141B1E; font-size: 12px; margin: 0; padding: 24px; max-width: 900px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 22px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #141B1E; }
  .sub { color: #55605F; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #DCDFD8; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #55605F; }
  td.n, th.n { text-align: right; width: 56px; font-variant-numeric: tabular-nums; }
  .total { margin-top: 8px; font-weight: 700; text-align: right; }
  .vazio { color: #55605F; padding: 18px 0; }
  .obs { margin-top: 26px; }
  .obs div { border-bottom: 1px solid #8A9290; height: 24px; }
  .imprimir { position: fixed; top: 12px; right: 12px; padding: 10px 16px; font-size: 14px; background: #1573D6; color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
  @media print { .imprimir { display: none; } body { padding: 0; max-width: none; } }
</style>
</head>
<body>
<button class="imprimir" onclick="window.print()">Imprimir</button>
<h1>${escaparHtml(titulo)}</h1>
<p class="sub">Ubadesklimp · ${escaparHtml(hojeTexto)} · ${total} ${total === 1 ? 'par' : 'pares'}</p>

<h2>O que encomendar</h2>
${
  total === 0
    ? '<p class="vazio">Nenhum pedido nesta lista.</p>'
    : `<table><thead><tr><th>Número</th><th>Cor</th><th class="n">Pares</th></tr></thead><tbody>${linhasEncomenda}</tbody></table><p class="total">Total: ${total} ${total === 1 ? 'par' : 'pares'}</p>`
}

<h2>Quem pediu</h2>
${
  total === 0
    ? '<p class="vazio">Nenhum pedido nesta lista.</p>'
    : `<table><thead><tr><th class="n">#</th><th>Cliente</th><th>Telefone</th><th>Número</th><th>Cor</th><th>Obs.</th><th>Anotado</th></tr></thead><tbody>${linhasPedidos}</tbody></table>`
}

<div class="obs"><strong>Observações</strong><div></div><div></div><div></div></div>
</body>
</html>`;
};
