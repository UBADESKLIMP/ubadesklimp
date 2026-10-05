import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  usePontoEspelho, hhmm, saldoHhmm, diaDaSemana, diaDoMes, mesPorExtenso,
  PROBLEMA_LABEL, mesPassado,
  type DiaDoEspelho, type PessoaDoEspelho,
} from '@/hooks/usePontoEspelho';

interface Props {
  empresaId: string | null;
  /** Abre a correção do dia furado sem o gestor ter que procurar a batida. */
  onArrumar: (funcionarioId: string, data: string, problema: string) => void;
}

/**
 * Espelho de ponto do mês — o documento que vai para a contabilidade.
 *
 * O relatório do sistema antigo é uma parede de 26 linhas iguais: para achar o
 * dia furado é preciso ler todas. Aqui a grade inteira é monoespaçada, então as
 * colunas alinham e a célula que falta vira um buraco visível. Dia certo recua
 * para cinza; só o dia furado fica branco e leva carimbo. O que sobra em tinta
 * é exatamente o que precisa de ação.
 */
const EspelhoDePonto = ({ empresaId, onArrumar }: Props) => {
  const [mes, setMes] = useState(mesPassado());
  const [pessoa, setPessoa] = useState<string>('todos');
  const { espelho, carregando, erro } = usePontoEspelho(
    empresaId, mes, pessoa === 'todos' ? null : pessoa
  );

  // A lista do seletor não pode encolher quando o filtro já está aplicado.
  const [nomes, setNomes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    if (espelho && pessoa === 'todos') {
      setNomes(espelho.pessoas.map((p) => ({ id: p.funcionario_id, nome: p.nome })));
    }
  }, [espelho, pessoa]);

  const pendencias = useMemo(() => {
    if (!espelho) return [];
    return espelho.pessoas
      .map((p) => ({
        id: p.funcionario_id,
        nome: p.nome,
        qtd: p.totais.furos,
      }))
      .filter((x) => x.qtd > 0);
  }, [espelho]);

  const totalPendente = pendencias.reduce((s, p) => s + p.qtd, 0);
  const totalAvisos = espelho?.pessoas.reduce((s, p) => s + p.totais.avisos, 0) ?? 0;
  const diasForaDaEscala = espelho?.pessoas.reduce((s, p) => s + p.totais.dias_fora_da_escala, 0) ?? 0;

  return (
    <div>
      <style>{`
        @media print {
          body { background: #fff; }
          body > *:not(#espelho-impresso-raiz) { display: none !important; }
          #espelho-impresso-raiz { display: block !important; }
          .folha { break-after: page; }
          .folha:last-child { break-after: auto; }
          @page { size: A4 portrait; margin: 14mm 12mm; }
        }
        #espelho-impresso-raiz { display: none; }
      `}</style>

      {/* ---------------------------------------------------------- comandos */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="space-y-1.5">
          <label className="text-xs text-blue-300/70 block">Mês</label>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-[10.5rem] text-white [color-scheme:dark]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-blue-300/70 block">Quem</label>
          <Select value={pessoa} onValueChange={setPessoa}>
            <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 w-[13rem] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo mundo</SelectItem>
              {nomes.map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          className="h-11 border-blue-500/20 text-blue-200 hover:bg-blue-500/10 hover:text-white"
          onClick={() => window.print()}
          disabled={!espelho || espelho.pessoas.length === 0}
        >
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {carregando && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
      {erro && <p className="text-sm text-[#ff8a7a]">{erro}</p>}

      {espelho && espelho.pessoas.length === 0 && !carregando && (
        <p className="text-sm text-blue-300/60 py-6">
          Ninguém bateu ponto em {mesPorExtenso(espelho.mes)}.
        </p>
      )}

      {/* ------------------------------------------------- o que falta arrumar */}
      {espelho && espelho.pessoas.length > 0 && (
        <>
        <div
          className={cn(
            'rounded-xl border px-5 py-4 mb-6',
            totalPendente > 0
              ? 'border-[#C0392B]/40 bg-[#C0392B]/10'
              : 'border-[#2F9E44]/30 bg-[#2F9E44]/10'
          )}
        >
          {totalPendente > 0 ? (
            <>
              <p className="text-white">
                <span className="font-mono text-2xl tabular-nums mr-2">{totalPendente}</span>
                {totalPendente === 1 ? 'dia para arrumar' : 'dias para arrumar'} antes de fechar{' '}
                {mesPorExtenso(espelho.mes)}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {pendencias.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPessoa(p.id)}
                    className="rounded-md border border-[#C0392B]/40 bg-[#C0392B]/15 px-2.5 py-1 text-sm text-white hover:bg-[#C0392B]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a7a]"
                  >
                    {p.nome}
                    <span className="ml-1.5 font-mono tabular-nums text-[#ff8a7a]">{p.qtd}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-white">
              Nenhum dia furado em {mesPorExtenso(espelho.mes)}. Pode mandar pra contabilidade.
            </p>
          )}

          {totalAvisos > 0 && (
            <p className="text-sm text-blue-300/60 mt-3">
              Além disso, {totalAvisos} dias passaram de 6 horas sem ninguém bater o almoço. Não
              travam o fechamento, mas o intervalo fica sem registro.
            </p>
          )}
        </div>

        {diasForaDaEscala > 0 && (
          <div className="rounded-xl border border-[#f0b429]/30 bg-[#f0b429]/10 px-5 py-3 mb-6 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-[#f0b429] shrink-0 mt-0.5" />
            <p className="text-sm text-blue-100/80">
              A escala cadastrada vai de segunda a sexta, mas houve {diasForaDaEscala} dias
              trabalhados fora dela — os sábados. Como o sistema não os espera, as horas desses
              dias entram inteiras no saldo. Ajuste a escala antes de usar esse saldo como banco
              de horas.
            </p>
          </div>
        )}
        </>
      )}

      {/* --------------------------------------------------------- na tela */}
      {espelho?.pessoas.map((p) => (
        <CartaoDaPessoa key={p.funcionario_id} pessoa={p} onArrumar={onArrumar} />
      ))}

      {/* ---------------------------------------------------- para o papel */}
      {espelho &&
        createPortal(
          <div id="espelho-impresso-raiz">
            {espelho.pessoas.map((p, i) => (
              <FolhaImpressa
                key={p.funcionario_id}
                pessoa={p}
                empresa={espelho.empresa?.razao_social ?? ''}
                mes={espelho.mes}
                pagina={i + 1}
                de={espelho.pessoas.length}
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

/* ------------------------------------------------------------------ tela */

const Carimbo = ({ texto, grau }: { texto: string; grau: 'furo' | 'aviso' }) => (
  <span
    className={cn(
      'inline-block -rotate-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
      grau === 'furo'
        ? 'bg-[#C0392B] text-white'
        : 'border border-[#f0b429]/40 text-[#f0b429]'
    )}
  >
    {texto}
  </span>
);

export const CartaoDaPessoa = ({
  pessoa,
  onArrumar,
}: {
  pessoa: PessoaDoEspelho;
  onArrumar: Props['onArrumar'];
}) => (
  <section className="mb-8">
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-blue-500/20 pb-2 mb-1">
      <h3 className="text-white">
        {pessoa.nome}
        {pessoa.cargo && <span className="text-blue-300/60 font-normal"> — {pessoa.cargo}</span>}
        {pessoa.matricula && (
          <span className="text-blue-300/40 font-mono text-sm ml-2">#{pessoa.matricula}</span>
        )}
      </h3>
      <p className="text-xs text-blue-300/50 font-mono">
        jornada {pessoa.jornada ?? '—'} · {hhmm(pessoa.jornada_min)} por dia
      </p>
    </header>

    <table className="w-full text-sm font-mono tabular-nums">
      <thead>
        <tr className="text-[11px] text-blue-300/40">
          <th className="text-left font-normal py-1.5 w-[4.5rem]">Dia</th>
          <th className="text-right font-normal">Entrada</th>
          <th className="text-right font-normal">Almoço</th>
          <th className="text-right font-normal">Volta</th>
          <th className="text-right font-normal">Saída</th>
          <th className="text-right font-normal pl-4">Horas</th>
          <th className="text-right font-normal">Saldo</th>
          <th className="w-0" />
        </tr>
      </thead>
      <tbody>
        {pessoa.dias.map((d) => (
          <LinhaDoDia key={d.data} dia={d} onArrumar={() => onArrumar(pessoa.funcionario_id, d.data, d.problema ?? '')} />
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-blue-500/20 text-white">
          <td colSpan={5} className="py-2.5 text-xs font-sans text-blue-300/60">
            {pessoa.totais.dias_trabalhados} dias trabalhados, previsto{' '}
            {hhmm(pessoa.totais.previsto_min)}
            {pessoa.totais.faltas > 0 &&
              `, ${pessoa.totais.faltas} ${pessoa.totais.faltas === 1 ? 'falta' : 'faltas'}`}
            {pessoa.totais.atrasos > 0 &&
              `, ${pessoa.totais.atrasos} ${pessoa.totais.atrasos === 1 ? 'atraso' : 'atrasos'}`}
            {pessoa.totais.dias_fora_da_escala > 0 &&
              `, ${hhmm(pessoa.totais.min_fora_da_escala)} em sábados`}
          </td>
          <td className="text-right py-2.5 pl-4">{hhmm(pessoa.totais.trabalhado_min)}</td>
          <td
            className={cn(
              'text-right py-2.5',
              pessoa.totais.saldo_min < 0 ? 'text-[#ff8a7a]' : 'text-[#4ade80]'
            )}
          >
            {saldoHhmm(pessoa.totais.saldo_min)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  </section>
);

const LinhaDoDia = ({ dia, onArrumar }: { dia: DiaDoEspelho; onArrumar: () => void }) => {
  const furo = dia.grau === 'furo';
  const aviso = dia.grau === 'aviso';
  const atrasado = (dia.atraso_min ?? 0) > 0;
  const vazio = !dia.entrada && !dia.previsto;

  // Dia certo não precisa de atenção: recua. Quem fica em branco é o problema.
  const tom = furo ? 'text-white' : vazio ? 'text-blue-300/20' : 'text-blue-300/55';

  return (
    <tr
      className={cn(
        'border-b border-blue-500/5',
        furo && 'bg-[#C0392B]/10',
        (aviso || atrasado) && !furo && 'bg-[#f0b429]/[0.04]'
      )}
    >
      <td className={cn('py-1.5', tom)}>
        <span className="text-blue-300/35 mr-1.5">{diaDaSemana(dia.data)}</span>
        {diaDoMes(dia.data)}
      </td>
      <td className={cn('text-right', atrasado ? 'text-[#f0b429]' : tom)}>
        {dia.entrada ?? (dia.previsto ? '——' : '')}
      </td>
      <td className={cn('text-right', tom)}>{dia.saida_almoco ?? ''}</td>
      <td className={cn('text-right', tom)}>
        {dia.retorno_almoco ?? (dia.saida_almoco ? '——' : '')}
      </td>
      <td className={cn('text-right', tom)}>{dia.saida ?? (dia.entrada ? '——' : '')}</td>
      <td className={cn('text-right pl-4', tom)}>
        {dia.total_min === null ? '' : hhmm(dia.total_min)}
      </td>
      <td
        className={cn(
          'text-right',
          dia.saldo_min === null || dia.fora_da_escala
            ? tom
            : dia.saldo_min < 0
              ? 'text-[#ff8a7a]/80'
              : 'text-[#4ade80]/80'
        )}
      >
        {dia.saldo_min === null ? '' : saldoHhmm(dia.saldo_min)}
      </td>
      <td className="pl-3 text-right whitespace-nowrap">
        {dia.problema && (
          <button
            onClick={onArrumar}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a7a]"
            title="Arrumar este dia"
          >
            <Carimbo texto={PROBLEMA_LABEL[dia.problema]} grau={furo ? 'furo' : 'aviso'} />
          </button>
        )}
        {!dia.problema && atrasado && (
          <span className="text-[11px] text-[#f0b429] font-sans">{dia.atraso_min} min</span>
        )}
      </td>
    </tr>
  );
};

/* ----------------------------------------------------------------- papel */

/**
 * A folha que o contador recebe. Tinta preta em papel branco, as colunas na
 * ordem que ele já conhece e a assinatura no pé — é um documento, não uma tela.
 */
export const FolhaImpressa = ({
  pessoa, empresa, mes, pagina, de,
}: {
  pessoa: PessoaDoEspelho;
  empresa: string;
  mes: string;
  pagina: number;
  de: number;
}) => (
  <div className="folha text-black" style={{ fontSize: '9.5pt', lineHeight: 1.35 }}>
    <div className="flex justify-between items-baseline border-b border-black pb-1 mb-2">
      <strong>{empresa}</strong>
      <span>Espelho de ponto — {mesPorExtenso(mes)}</span>
    </div>

    <div className="mb-2">
      <strong style={{ fontSize: '11pt' }}>
        {pessoa.matricula ? `${pessoa.matricula} ` : ''}{pessoa.nome.toUpperCase()}
      </strong>
      <div>CPF: {pessoa.cpf ?? ''} &nbsp; PIS/PASEP: {pessoa.pis ?? ''}</div>
      {pessoa.endereco && <div>{pessoa.endereco}</div>}
      <div>{pessoa.cargo ?? ''} &nbsp;&nbsp; Jornada: {pessoa.jornada ?? '—'}</div>
    </div>

    <table className="w-full" style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #000' }}>
          <th align="left">Data</th>
          <th align="right">Entrada</th>
          <th align="right">Saída Almoço</th>
          <th align="right">Entr. Almoço</th>
          <th align="right">Saída</th>
          <th align="right">Extra Entrada</th>
          <th align="right">Extra Saída</th>
          <th align="right">Total Horas</th>
          <th align="right">Saldo</th>
          <th align="left" style={{ paddingLeft: '6px' }}>Ocorrência</th>
        </tr>
      </thead>
      <tbody>
        {pessoa.dias
          .filter((d) => d.entrada || d.previsto)
          .map((d) => (
            <tr key={d.data}>
              <td>{diaDoMes(d.data)}/{d.data.slice(5, 7)}/{d.data.slice(2, 4)} {diaDaSemana(d.data)}</td>
              <td align="right">{d.entrada ?? ''}</td>
              <td align="right">{d.saida_almoco ?? ''}</td>
              <td align="right">{d.retorno_almoco ?? ''}</td>
              <td align="right">{d.saida ?? ''}</td>
              <td align="right">{d.extra_entrada ?? ''}</td>
              <td align="right">{d.extra_saida ?? ''}</td>
              <td align="right">{d.total_min === null ? '' : hhmm(d.total_min)}</td>
              <td align="right">{d.saldo_min === null ? '' : saldoHhmm(d.saldo_min)}</td>
              <td style={{ paddingLeft: '6px' }}>
                {d.problema ? PROBLEMA_LABEL[d.problema] : d.atraso_min ? `Atraso ${d.atraso_min} min` : ''}
              </td>
            </tr>
          ))}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '1px solid #000' }}>
          <td colSpan={7} align="right"><strong>Totais do mês</strong></td>
          <td align="right"><strong>{hhmm(pessoa.totais.trabalhado_min)}</strong></td>
          <td align="right"><strong>{saldoHhmm(pessoa.totais.saldo_min)}</strong></td>
          <td />
        </tr>
      </tfoot>
    </table>

    <div style={{ marginTop: '6mm' }}>
      Dias trabalhados: {pessoa.totais.dias_trabalhados} &nbsp;&nbsp;
      Faltas: {pessoa.totais.faltas} &nbsp;&nbsp;
      Atrasos: {pessoa.totais.atrasos} &nbsp;&nbsp;
      Jornada prevista no mês: {hhmm(pessoa.totais.previsto_min)}
      {pessoa.totais.dias_fora_da_escala > 0 && (
        <div style={{ marginTop: '2mm' }}>
          Inclui {hhmm(pessoa.totais.min_fora_da_escala)} em{' '}
          {pessoa.totais.dias_fora_da_escala} dias fora da escala contratada, somados
          integralmente ao saldo.
        </div>
      )}
    </div>

    <div className="flex justify-between" style={{ marginTop: '16mm' }}>
      <div style={{ borderTop: '1px solid #000', width: '68mm', textAlign: 'center', paddingTop: '2px' }}>
        {pessoa.nome}
      </div>
      <div style={{ borderTop: '1px solid #000', width: '68mm', textAlign: 'center', paddingTop: '2px' }}>
        {empresa}
      </div>
    </div>

    <div style={{ textAlign: 'right', marginTop: '4mm', fontSize: '8pt' }}>
      Página {pagina} de {de}
    </div>
  </div>
);

export default EspelhoDePonto;
