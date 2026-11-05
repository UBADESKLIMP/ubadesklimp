import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Clock, Loader2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Teclado from './Teclado';
import {
  TIPO_LABEL,
  type BatidaDoDia,
  type PedidoDeAjuste,
  type PedidoDeContestacao,
  type ResultadoContestacao,
  type ResultadoMeuPonto,
} from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
}

interface Props {
  meuPonto: (pin: string) => Promise<ResultadoMeuPonto>;
  contestar: (pin: string, pedido: PedidoDeContestacao) => Promise<ResultadoContestacao>;
  onFim: (a: AvisoAtual) => void;
  onVoltar: () => void;
}

type Passo = 'pin' | 'ponto' | 'tipo' | 'esqueci' | 'duplicada' | 'errado' | 'outro' | 'resumo';
type Tipo = PedidoDeAjuste['tipo'];

/** Sem toque por este tempo, a tela se fecha sozinha: o PIN não fica à vista. */
const SEGUNDOS_PARADO = 90;

const BATIDAS_QUE_SE_ESQUECE: { valor: string; rotulo: string }[] = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida_almoco', rotulo: 'Saída para o almoço' },
  { valor: 'retorno_almoco', rotulo: 'Volta do almoço' },
  { valor: 'saida', rotulo: 'Saída' },
];

const CAMPO = 'h-14 rounded-2xl border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/50';

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const rotuloDoDia = (iso: string, hoje: string, dias: string[]) => {
  const pos = dias.indexOf(iso);
  const nome = pos === 0 ? 'Hoje' : pos === 1 ? 'Ontem' : pos === 2 ? 'Anteontem' : '';
  return nome ? `${nome} · ${ddmm(iso)}` : ddmm(iso);
};

const Botao = ({
  ativo = false,
  desligado = false,
  onClick,
  children,
  grande = false,
}: {
  ativo?: boolean;
  desligado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  grande?: boolean;
}) => (
  <button
    type="button"
    disabled={desligado}
    onClick={onClick}
    className={cn(
      'rounded-2xl border px-4 text-left text-base font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
      grande ? 'min-h-16 text-lg' : 'min-h-12',
      ativo ? 'border-white bg-white text-[#0b1020]' : 'border-white/25 bg-white/10 text-white hover:bg-white/15'
    )}
  >
    {children}
  </button>
);

const SELO_DO_PEDIDO: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: 'Esperando o gestor', cor: 'text-amber-300' },
  aprovada: { texto: 'Aprovado', cor: 'text-emerald-300' },
  aguardando_ciencia: { texto: 'Aprovado', cor: 'text-emerald-300' },
  concluida: { texto: 'Aprovado', cor: 'text-emerald-300' },
  rejeitada: { texto: 'Recusado', cor: 'text-red-300' },
};

/**
 * "Meu ponto": o funcionário vê as batidas dos últimos 3 dias e, se algo está
 * errado (esqueceu de bater, bateu duas vezes, horário errado), pede o ajuste ao
 * gestor ali mesmo, sem abrir o site. Nada muda no ponto sozinho: o pedido entra
 * na fila de aprovação do gestor, e a resposta aparece aqui na próxima vez.
 */
const MeuPontoQuiosque = ({ meuPonto, contestar, onFim, onVoltar }: Props) => {
  const [passo, setPasso] = useState<Passo>('pin');
  const [pin, setPin] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ResultadoMeuPonto | null>(null);
  const [diaVisto, setDiaVisto] = useState('');

  // formulário do pedido
  const [tipo, setTipo] = useState<Tipo>('esquecimento');
  const [dia, setDia] = useState('');
  const [batida, setBatida] = useState('');
  const [horario, setHorario] = useState('');
  const [escolhida, setEscolhida] = useState<(BatidaDoDia & { dia: string }) | null>(null);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Parado por muito tempo: fecha.
  useEffect(() => {
    let t = setTimeout(onVoltar, SEGUNDOS_PARADO * 1000);
    const reiniciar = () => {
      clearTimeout(t);
      t = setTimeout(onVoltar, SEGUNDOS_PARADO * 1000);
    };
    window.addEventListener('pointerdown', reiniciar);
    window.addEventListener('keydown', reiniciar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', reiniciar);
      window.removeEventListener('keydown', reiniciar);
    };
  }, [onVoltar]);

  const dias = useMemo(() => (dados?.dias ?? []).map((d) => d.dia), [dados]);
  const hoje = dados?.hoje ?? '';
  const batidasDoDia = (iso: string) => dados?.dias?.find((d) => d.dia === iso)?.marcacoes ?? [];

  const consultar = async () => {
    if (pin.length !== 4) return;
    setConsultando(true);
    setErro(null);
    const r = await meuPonto(pin);
    setConsultando(false);
    if (!r.ok) {
      setPin('');
      setErro(r.mensagem ?? 'Não conseguimos consultar agora.');
      return;
    }
    setDados(r);
    setDiaVisto(r.dias?.[0]?.dia ?? '');
    setPasso('ponto');
  };

  const comecar = (novoTipo: Tipo) => {
    setTipo(novoTipo);
    setDia(dias[0] ?? '');
    setBatida('');
    setHorario('');
    setEscolhida(null);
    setNota('');
    setErro(null);
    setPasso(novoTipo === 'esquecimento' ? 'esqueci' : novoTipo === 'marcacao_duplicada' ? 'duplicada' : novoTipo === 'marcacao_incorreta' ? 'errado' : 'outro');
  };

  const horarioValido = /^\d{1,2}:\d{2}$/.test(horario);
  const podeAvancar =
    tipo === 'esquecimento'
      ? dia !== '' && batida !== '' && horarioValido
      : tipo === 'marcacao_duplicada'
        ? escolhida !== null
        : tipo === 'marcacao_incorreta'
          ? escolhida !== null && horarioValido
          : dia !== '' && nota.trim().length >= 3;

  const rotuloBatida = (valor: string) => BATIDAS_QUE_SE_ESQUECE.find((b) => b.valor === valor)?.rotulo.toLowerCase() ?? valor;

  const resumo = (() => {
    if (tipo === 'esquecimento') return `Esqueci de bater a ${rotuloBatida(batida)} de ${ddmm(dia)}. O horário certo é ${horario}.`;
    if (tipo === 'marcacao_duplicada' && escolhida)
      return `Bati duas vezes. A repetida é a ${TIPO_LABEL[escolhida.tipo].toLowerCase()} das ${escolhida.hora} de ${ddmm(escolhida.dia)}.`;
    if (tipo === 'marcacao_incorreta' && escolhida)
      return `A ${TIPO_LABEL[escolhida.tipo].toLowerCase()} das ${escolhida.hora} de ${ddmm(escolhida.dia)} está errada. O horário certo é ${horario}.`;
    return `${ddmm(dia)}: ${nota.trim()}`;
  })();

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    const pedido: PedidoDeContestacao = {
      data: escolhida?.dia ?? dia,
      tipo,
      marcacaoId: escolhida?.id,
      batida: tipo === 'esquecimento' ? batida : undefined,
      horario: tipo === 'esquecimento' || tipo === 'marcacao_incorreta' ? horario : undefined,
      motivo: nota.trim() || undefined,
    };
    const r = await contestar(pin, pedido);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não deu para enviar. Tente de novo.');
      return;
    }
    setPin('');
    onFim({ ok: true, nome: dados?.nome, destaque: 'Enviado', detalhe: 'ao gestor', mensagem: r.mensagem });
  };

  const voltarUmPasso = () => {
    setErro(null);
    setPasso(passo === 'resumo' ? (tipo === 'esquecimento' ? 'esqueci' : tipo === 'marcacao_duplicada' ? 'duplicada' : tipo === 'marcacao_incorreta' ? 'errado' : 'outro') : passo === 'tipo' ? 'ponto' : 'tipo');
  };

  const Cabecalho = ({ titulo, sub }: { titulo: string; sub?: string }) => (
    <div className="text-center">
      <p className="text-xl font-heading">{titulo}</p>
      {sub && <p className="mt-1 text-sm text-white/70">{sub}</p>}
    </div>
  );

  const BarraDeAcoes = ({ continuar, rotulo = 'Continuar' }: { continuar?: () => void; rotulo?: string }) => (
    <div className="mt-2 flex w-full gap-3">
      <button
        type="button"
        onClick={voltarUmPasso}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-base font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      {continuar && (
        <button
          type="button"
          disabled={!podeAvancar || enviando}
          onClick={continuar}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-base font-semibold text-[#0b1020] transition active:scale-[0.99] disabled:bg-white/10 disabled:text-white/35"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {rotulo}
        </button>
      )}
    </div>
  );

  // ------------------------------------------------------------------ PIN
  if (passo === 'pin') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <p className="text-xl font-heading">Meu ponto</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/75">
            Digite seu PIN para ver o que você já bateu. Se algo estiver errado, dá para pedir o ajuste aqui mesmo.
          </p>
        </div>
        <Teclado valor={pin} onChange={setPin} onConfirmar={consultar} confirmando={consultando} erro={erro} plano />
        <p className="min-h-5 text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>
      </main>
    );
  }

  const wrapper = 'flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 pb-6 pt-1 text-white';
  const coluna = 'w-full max-w-xl space-y-4';

  // ----------------------------------------------------- Meu ponto (3 dias)
  if (passo === 'ponto') {
    const batidas = batidasDoDia(diaVisto);
    const pedidos = dados?.pedidos ?? [];
    return (
      <main className={wrapper}>
        <div className={coluna}>
          <div className="text-center">
            <p className="text-sm text-white/70">Meu ponto</p>
            <p className="text-2xl font-semibold">{dados?.nome}</p>
          </div>

          <div className="flex gap-2">
            {dias.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiaVisto(d)}
                className={cn(
                  'flex-1 rounded-xl border px-2 py-2.5 text-sm font-medium transition',
                  d === diaVisto ? 'border-white bg-white text-[#0b1020]' : 'border-white/25 bg-white/10 text-white'
                )}
              >
                {rotuloDoDia(d, hoje, dias)}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {batidas.length === 0 ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-5 text-center">
                <p className="text-lg font-semibold">Nenhuma batida nesse dia</p>
                <p className="mt-1 text-sm text-white/70">Se você trabalhou e esqueceu de bater, toque em "Tem algo errado?".</p>
              </div>
            ) : (
              batidas.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{TIPO_LABEL[b.tipo] ?? b.tipo}</p>
                    {b.origem === 'abertura_coletiva' && <p className="text-xs text-white/65">marcada na abertura da loja</p>}
                  </div>
                  <span className="font-mono text-2xl font-semibold tabular-nums">{b.hora}</span>
                </div>
              ))
            )}
          </div>

          {pedidos.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-white/85">Seus pedidos de ajuste</p>
              {pedidos.map((p) => {
                const selo = SELO_DO_PEDIDO[p.status] ?? { texto: p.status, cor: 'text-white/70' };
                return (
                  <div key={p.id} className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs tabular-nums text-white/60">{ddmm(p.data)}</span>
                      <span className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide', selo.cor)}>
                        {p.status === 'rejeitada' ? <XCircle className="h-3.5 w-3.5" /> : p.status === 'pendente' ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {selo.texto}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/85">{p.motivo.replace(/^Pelo quiosque: /, '')}</p>
                    {p.status === 'rejeitada' && p.motivo_rejeicao && (
                      <p className="mt-1 text-sm text-red-200">Motivo: {p.motivo_rejeicao}</p>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <button
            type="button"
            onClick={() => setPasso('tipo')}
            className="flex h-16 w-full items-center justify-center rounded-2xl bg-white text-lg font-semibold text-[#0b1020] transition active:scale-[0.99]"
          >
            Tem algo errado?
          </button>
          <button type="button" onClick={onVoltar} className="w-full py-2 text-center text-sm text-white/70 hover:text-white">
            Sair
          </button>
        </div>
      </main>
    );
  }

  // -------------------------------------------------- O que aconteceu?
  if (passo === 'tipo') {
    return (
      <main className={wrapper}>
        <div className={coluna}>
          <Cabecalho titulo="O que aconteceu?" sub="Escolha o que mais se parece. O gestor vai analisar." />
          <div className="grid gap-3">
            <Botao grande onClick={() => comecar('esquecimento')}>Esqueci de bater o ponto</Botao>
            <Botao grande onClick={() => comecar('marcacao_duplicada')}>Bati duas vezes</Botao>
            <Botao grande onClick={() => comecar('marcacao_incorreta')}>Bati, mas o horário ficou errado</Botao>
            <Botao grande onClick={() => comecar('falha_sistema')}>O ponto não funcionou / outro motivo</Botao>
          </div>
          <BarraDeAcoes />
        </div>
      </main>
    );
  }

  // ----------------------------------------------- Detalhes de cada caso
  if (passo === 'esqueci' || passo === 'outro') {
    const jaTem = new Set(batidasDoDia(dia).map((b) => b.tipo as string));
    return (
      <main className={wrapper}>
        <div className={coluna}>
          <Cabecalho titulo={passo === 'esqueci' ? 'Qual batida você esqueceu?' : 'Conte o que aconteceu'} />

          <section className="space-y-2">
            <p className="text-sm font-semibold text-white/85">Em que dia?</p>
            <div className="flex flex-wrap gap-2">
              {dias.map((d) => (
                <Botao key={d} ativo={dia === d} onClick={() => setDia(d)}>
                  {rotuloDoDia(d, hoje, dias)}
                </Botao>
              ))}
            </div>
          </section>

          {passo === 'esqueci' ? (
            <>
              <section className="space-y-2">
                <p className="text-sm font-semibold text-white/85">Qual batida?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BATIDAS_QUE_SE_ESQUECE.map((b) => (
                    <Botao key={b.valor} ativo={batida === b.valor} desligado={jaTem.has(b.valor)} onClick={() => setBatida(b.valor)}>
                      {jaTem.has(b.valor) ? `${b.rotulo} (já registrada)` : b.rotulo}
                    </Botao>
                  ))}
                </div>
              </section>
              <section className="space-y-2">
                <p className="text-sm font-semibold text-white/85">Que horas foi?</p>
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/25 bg-white/10 px-5 text-2xl font-semibold text-white [color-scheme:dark]"
                />
              </section>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observação (opcional)" maxLength={150} className={CAMPO} />
            </>
          ) : (
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Escreva em poucas palavras"
              maxLength={200}
              className={CAMPO}
              autoFocus
            />
          )}
          {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}
          <BarraDeAcoes continuar={() => setPasso('resumo')} />
        </div>
      </main>
    );
  }

  if (passo === 'duplicada' || passo === 'errado') {
    return (
      <main className={wrapper}>
        <div className={coluna}>
          <Cabecalho
            titulo={passo === 'duplicada' ? 'Qual batida está repetida?' : 'Qual batida está com o horário errado?'}
            sub="Toque na batida."
          />
          {(dados?.dias ?? []).map((d) => (
            <section key={d.dia} className="space-y-2">
              <p className="text-sm font-semibold text-white/85">{rotuloDoDia(d.dia, hoje, dias)}</p>
              {d.marcacoes.length === 0 ? (
                <p className="text-sm text-white/55">Nenhuma batida.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {d.marcacoes.map((b) => (
                    <Botao key={b.id} ativo={escolhida?.id === b.id} onClick={() => setEscolhida({ ...b, dia: d.dia })}>
                      {`${TIPO_LABEL[b.tipo] ?? b.tipo} · ${b.hora}`}
                    </Botao>
                  ))}
                </div>
              )}
            </section>
          ))}
          {passo === 'errado' && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-white/85">Qual é o horário certo?</p>
              <input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="h-14 w-full rounded-2xl border border-white/25 bg-white/10 px-5 text-2xl font-semibold text-white [color-scheme:dark]"
              />
            </section>
          )}
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observação (opcional)" maxLength={150} className={CAMPO} />
          {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}
          <BarraDeAcoes continuar={() => setPasso('resumo')} />
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- Resumo
  return (
    <main className={wrapper}>
      <div className={coluna}>
        <Cabecalho titulo="Confira antes de enviar" />
        <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-5">
          <p className="text-lg leading-snug">{resumo}</p>
          {nota.trim() && tipo !== 'falha_sistema' && <p className="mt-2 text-sm text-white/70">Obs.: {nota.trim()}</p>}
        </div>
        <p className="text-center text-sm text-white/65">
          O pedido vai para o gestor. Seu ponto só muda se ele aprovar, e a resposta aparece aqui no Meu ponto.
        </p>
        {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}
        <BarraDeAcoes continuar={enviar} rotulo="Enviar ao gestor" />
      </div>
    </main>
  );
};

export default MeuPontoQuiosque;
