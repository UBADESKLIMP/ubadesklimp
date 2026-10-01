import jsPDF from 'jspdf';

export interface DadosAdvertencia {
  medida: {
    id: string;
    tipo: 'orientacao_verbal' | 'orientacao_verbal_coletiva' | 'advertencia_escrita' | 'suspensao';
    dias_suspensao: number | null;
    data_aplicacao: string;
    fundamento: string;
    status: string;
    assinado_path: string | null;
  };
  colaborador: { nome: string; termo_assinado_em: string | null };
  empresa: { razao_social: string; cnpj: string } | null;
  atrasos: {
    data: string;
    marcacao: 'entrada' | 'retorno_almoco';
    hora_chegada: string;
    horario_referencia: string | null;
    minutos_atraso: number | null;
  }[];
  historico: { data_aplicacao: string; tipo: string; fundamento: string }[];
  ciencias: {
    alvo_tipo: string;
    acao: string;
    signed_at: string;
    payload_hash: string;
    ip: string | null;
    testemunha_1: string | null;
    testemunha_2: string | null;
  }[];
}

const TITULO: Record<DadosAdvertencia['medida']['tipo'], string> = {
  orientacao_verbal: 'REGISTRO DE ADVERTÊNCIA VERBAL',
  orientacao_verbal_coletiva: 'REGISTRO DE ORIENTAÇÃO COLETIVA',
  advertencia_escrita: 'ADVERTÊNCIA ESCRITA',
  suspensao: 'SUSPENSÃO DISCIPLINAR',
};

const data = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const hora = (valor: string | null) => (valor ? valor.slice(0, 5) : '--:--');

const formatarCnpj = (cnpj: string) => {
  const digitos = cnpj.replace(/\D/g, '');
  if (digitos.length !== 14) return cnpj;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
};

const MARCACAO_LABEL = {
  entrada: 'entrada',
  retorno_almoco: 'retorno do almoço',
} as const;

export const downloadAdvertenciaPdf = (dados: DadosAdvertencia): void => {
  const doc = new jsPDF();
  const marginX = 18;
  const larguraUtil = 174;
  let y = 20;

  const quebrarPagina = (alturaNecessaria = 10) => {
    if (y + alturaNecessaria > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const paragrafo = (texto: string, tamanho = 10, espacoDepois = 6) => {
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, larguraUtil) as string[];
    quebrarPagina(linhas.length * 5);
    doc.text(linhas, marginX, y);
    y += linhas.length * 5 + espacoDepois - 5;
  };

  const subtitulo = (texto: string) => {
    quebrarPagina(14);
    y += 2;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(texto, marginX, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  };

  // Identificação do empregador — tem que ser a empresa do colaborador, não
  // "a empresa do sistema" (são 2 CNPJs distintos usando o mesmo admin).
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(dados.empresa?.razao_social ?? 'Empresa não identificada', marginX, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.setFontSize(9);
  doc.text(
    dados.empresa ? `CNPJ ${formatarCnpj(dados.empresa.cnpj)}` : 'CNPJ não informado',
    marginX,
    y
  );
  y += 8;

  doc.setLineWidth(0.4);
  doc.line(marginX, y, marginX + larguraUtil, y);
  y += 9;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(TITULO[dados.medida.tipo], marginX, y);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(10);
  doc.text(`Colaborador(a): ${dados.colaborador.nome}`, marginX, y);
  y += 5;
  doc.text(`Data: ${data(dados.medida.data_aplicacao)}`, marginX, y);
  y += 5;
  if (dados.medida.tipo === 'suspensao' && dados.medida.dias_suspensao) {
    doc.text(`Dias de suspensão: ${dados.medida.dias_suspensao}`, marginX, y);
    y += 5;
  }
  y += 4;

  subtitulo('Fatos');
  if (dados.atrasos.length === 0) {
    paragrafo('Nenhum registro de atraso vinculado a esta medida.');
  } else {
    doc.setFontSize(9);
    quebrarPagina(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', marginX, y);
    doc.text('Marcação', marginX + 28, y);
    doc.text('Previsto', marginX + 78, y);
    doc.text('Registrado', marginX + 108, y);
    doc.text('Atraso', marginX + 145, y);
    doc.setFont('helvetica', 'normal');
    y += 2;
    doc.setLineWidth(0.1);
    doc.line(marginX, y, marginX + larguraUtil, y);
    y += 5;

    for (const atraso of dados.atrasos) {
      quebrarPagina(7);
      doc.text(data(atraso.data), marginX, y);
      doc.text(MARCACAO_LABEL[atraso.marcacao], marginX + 28, y);
      doc.text(hora(atraso.horario_referencia), marginX + 78, y);
      doc.text(hora(atraso.hora_chegada), marginX + 108, y);
      doc.text(`${atraso.minutos_atraso ?? 0} min`, marginX + 145, y);
      y += 6;
    }

    const total = dados.atrasos.reduce((soma, a) => soma + (a.minutos_atraso ?? 0), 0);
    y += 1;
    doc.line(marginX, y, marginX + larguraUtil, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${total} min em ${dados.atrasos.length} ocorrência(s)`, marginX, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
  }

  subtitulo('Fundamento');
  paragrafo(dados.medida.fundamento);

  if (dados.historico.length > 0) {
    subtitulo('Histórico de medidas anteriores');
    doc.setFontSize(9);
    for (const item of dados.historico) {
      quebrarPagina(7);
      doc.text(`${data(item.data_aplicacao)} — ${item.tipo.replace(/_/g, ' ')}`, marginX, y);
      y += 5;
    }
    y += 4;
  }

  if (dados.ciencias.length > 0) {
    subtitulo('Evidências de ciência eletrônica');
    paragrafo(
      'As confirmações abaixo foram registradas pelo colaborador no sistema interno, com login ' +
        'pessoal, nos termos do art. 10, §2º, da MP 2.200-2/2001 e da Lei 14.063/2020. O hash ' +
        'identifica o conteúdo exato do registro no momento da confirmação.',
      8,
      5
    );

    doc.setFontSize(7.5);
    for (const ciencia of dados.ciencias) {
      quebrarPagina(12);
      const acao = ciencia.acao === 'ciente' ? 'Ciência' : 'Recusa';
      doc.text(
        `${acao} (${ciencia.alvo_tipo}) em ${dataHora(ciencia.signed_at)}${ciencia.ip ? ` — IP ${ciencia.ip}` : ''}`,
        marginX,
        y
      );
      y += 4;
      doc.setFont('courier', 'normal');
      doc.text(`SHA-256 ${ciencia.payload_hash}`, marginX, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      if (ciencia.testemunha_1 || ciencia.testemunha_2) {
        doc.text(
          `Testemunhas: ${ciencia.testemunha_1 ?? '—'} / ${ciencia.testemunha_2 ?? '—'}`,
          marginX,
          y
        );
        y += 4;
      }
      y += 2;
    }
    y += 4;
  }

  // Assinatura à mão: o MVP é imprimir, assinar e subir o scan.
  quebrarPagina(48);
  y += 6;
  doc.setFontSize(9);
  paragrafo(
    'Declaro ter recebido a presente comunicação, ciente de que a reiteração da conduta pode ' +
      'ensejar a aplicação de medidas disciplinares mais severas.',
    9,
    12
  );

  quebrarPagina(40);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + 80, y);
  doc.line(marginX + 94, y, marginX + larguraUtil, y);
  y += 4;
  doc.setFontSize(8);
  doc.text('Colaborador(a)', marginX, y);
  doc.text('Pela empresa', marginX + 94, y);
  y += 12;

  doc.setFontSize(8);
  doc.text(
    'Em caso de recusa de assinatura, preencher as testemunhas abaixo:',
    marginX,
    y
  );
  y += 10;
  doc.line(marginX, y, marginX + 80, y);
  doc.line(marginX + 94, y, marginX + larguraUtil, y);
  y += 4;
  doc.text('Testemunha 1', marginX, y);
  doc.text('Testemunha 2', marginX + 94, y);

  const nomeArquivo = `${dados.medida.tipo}-${dados.colaborador.nome}-${dados.medida.data_aplicacao}`
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .toLowerCase();
  doc.save(`${nomeArquivo}.pdf`);
};
