import { useMemo, useState } from 'react';
import { Check, ChevronDown, LogOut, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import DeslizarParaEntregar from './DeslizarParaEntregar';
import { FUNDO_TELA } from '@/components/ponto/Teclado';
import {
  MOTIVO_LABEL,
  type EntregaMotivo,
  type ItemEntrega,
  type MinhaRota as MinhaRotaDados,
  type ParadaDoEntregador,
  type ResultadoRegistro,
} from '@/hooks/useEntregas';

const MOTIVOS: EntregaMotivo[] = [
  'fechado',
  'ninguem_atendeu',
  'endereco_errado',
  'cliente_recusou',
  'nao_coube',
  'outro',
];

const textoDoItem = (item: ItemEntrega) =>
  [item.quantidade, item.unidade, item.descricao].filter(Boolean).join(' ').trim();

const quantidadeDoItem = (item: ItemEntrega): number | null => {
  const n = parseFloat(String(item.quantidade ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const BOTAO_LINK =
  'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#DCDFD8] bg-white ' +
  'px-3 text-sm font-medium text-[#141B1E] active:scale-[0.98]';

type Aba = 'rota' | 'carga';

interface ProdutoDaCarga {
  chave: string;
  nome: string;
  unidade: string;
  total: number | null;
  porCliente: { cliente: string; quantidade: number | null }[];
}

/** Soma o que vai no carro: um produto por linha, com a divisão por cliente. */
const juntarCarga = (paradas: ParadaDoEntregador[]): ProdutoDaCarga[] => {
  const mapa = new Map<string, ProdutoDaCarga>();
  paradas.forEach((p) => {
    (Array.isArray(p.itens) ? p.itens : []).forEach((item) => {
      const nome = (item.descricao ?? '').trim() || 'Item sem nome';
      const unidade = (item.unidade ?? '').trim();
      const chave = `${nome.toLowerCase()}|${unidade.toLowerCase()}`;
      const q = quantidadeDoItem(item);
      const atual = mapa.get(chave) ?? { chave, nome, unidade, total: 0, porCliente: [] };
      atual.total = atual.total === null || q === null ? null : atual.total + q;
      atual.porCliente.push({ cliente: p.cliente_nome, quantidade: q });
      mapa.set(chave, atual);
    });
  });
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
};

const lerCarregados = (chave: string): Set<string> => {
  try {
    const bruto = window.localStorage.getItem(chave);
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : []);
  } catch {
    return new Set();
  }
};

/**
 * A tela da rua. As paradas ficam todas à mão: a primeira da fila já vem
 * aberta, mas qualquer outra abre com um toque (o cliente do almoço fechou e o
 * entregador segue pro próximo). Quem foi resolvido desce pro fim da lista pra
 * a cabeça ficar sempre no que ainda falta.
 */
const MinhaRota = ({
  rota,
  onRegistrar,
  onSair,
}: {
  rota: MinhaRotaDados;
  onRegistrar: (
    entregaId: string,
    tipo: 'entregue' | 'nao_entregue',
    extra?: { motivo?: EntregaMotivo; motivoTexto?: string; quemRecebeu?: string }
  ) => Promise<ResultadoRegistro>;
  onSair: () => void;
}) => {
  const [aba, setAba] = useState<Aba>('rota');
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [quemRecebeu, setQuemRecebeu] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [voltouDe, setVoltouDe] = useState<ParadaDoEntregador | null>(null);
  const [motivo, setMotivo] = useState<EntregaMotivo | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');

  const chaveCarga = `carga-do-dia:${new Date().toISOString().slice(0, 10)}`;
  const [carregados, setCarregados] = useState<Set<string>>(() => lerCarregados(chaveCarga));
  const [abertosDaCarga, setAbertosDaCarga] = useState<Set<string>>(new Set());

  const paradas = rota.paradas ?? [];
  const posicao = useMemo(() => new Map(paradas.map((p, i) => [p.entrega_id, i + 1])), [paradas]);
  const pendentes = paradas.filter((p) => p.situacao === 'em_rota');
  const resolvidas = paradas.filter((p) => p.situacao !== 'em_rota');
  const entregues = paradas.filter((p) => p.situacao === 'entregue').length;
  const voltaram = resolvidas.length - entregues;
  const primeira = pendentes[0]?.entrega_id;
  const carga = useMemo(() => juntarCarga(paradas), [paradas]);

  const estaAberta = (id: string) => abertas[id] ?? id === primeira;
  const alternar = (id: string) => setAbertas((a) => ({ ...a, [id]: !estaAberta(id) }));

  const entregar = async (parada: ParadaDoEntregador) => {
    setEnviando(parada.entrega_id);
    setErro(null);
    const r = await onRegistrar(parada.entrega_id, 'entregue', {
      quemRecebeu: quemRecebeu[parada.entrega_id]?.trim() || undefined,
    });
    setEnviando(null);
    if (!r.ok) setErro(r.mensagem ?? 'Não deu para registrar.');
  };

  const fecharMotivo = () => {
    setVoltouDe(null);
    setMotivo(null);
    setMotivoTexto('');
  };

  const naoEntregar = async () => {
    if (!voltouDe || !motivo) return;
    setEnviando(voltouDe.entrega_id);
    setErro(null);
    const r = await onRegistrar(voltouDe.entrega_id, 'nao_entregue', {
      motivo,
      motivoTexto: motivoTexto.trim() || undefined,
    });
    setEnviando(null);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não deu para registrar.');
      return;
    }
    fecharMotivo();
  };

  const marcarCarregado = (chave: string) => {
    setCarregados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      try {
        window.localStorage.setItem(chaveCarga, JSON.stringify([...novo]));
      } catch {
        // sem armazenamento: o marcado vale só nesta abertura
      }
      return novo;
    });
  };

  const alternarProduto = (chave: string) =>
    setAbertosDaCarga((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const percentual = (n: number) => (paradas.length === 0 ? '0%' : `${(n / paradas.length) * 100}%`);

  // -------------------------------------------------------------- cartão
  // Função (e não componente) de propósito: um componente declarado aqui dentro
  // seria recriado a cada toque e o campo "quem recebeu" perderia o foco.
  const cartao = (parada: ParadaDoEntregador) => {
    const aberta = estaAberta(parada.entrega_id);
    const endereco = parada.entregar_em || parada.endereco || 'Sem endereço no cadastro';
    const itens = Array.isArray(parada.itens) ? parada.itens : [];
    const ocupada = enviando === parada.entrega_id;
    const principal = parada.entrega_id === primeira;

    return (
      <div
        className={`overflow-hidden rounded-2xl border bg-white transition ${
          aberta ? 'border-primary/40 shadow-md' : 'border-[#DCDFD8]'
        }`}
      >
        <button
          type="button"
          onClick={() => alternar(parada.entrega_id)}
          className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left"
          aria-expanded={aberta}
        >
          <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-primary">
            {String(posicao.get(parada.entrega_id) ?? 0).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            {principal && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Próxima entrega</p>
            )}
            <p className="truncate text-base font-semibold text-[#141B1E]">{parada.cliente_nome}</p>
            <p className="truncate text-sm text-[#55605F]">{parada.bairro ?? 'Sem bairro'}</p>
          </div>
          {!aberta && (
            <span className="shrink-0 -rotate-1 rounded-[3px] border-2 border-[#6B7280]/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
              na fila
            </span>
          )}
          <ChevronDown className={`h-5 w-5 shrink-0 text-[#8A9290] transition ${aberta ? 'rotate-180' : ''}`} />
        </button>

        {aberta && (
          <div className="space-y-4 border-t border-[#DCDFD8] px-4 pb-4 pt-3">
            <p className="font-mono text-xs tabular-nums text-[#8A9290]">{parada.documento}</p>

            <p className="flex items-start gap-2 text-[#141B1E]">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#55605F]" />
              <span>{endereco}</span>
            </p>

            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  `${endereco}, ${parada.bairro ?? ''}, Ubatuba SP`
                )}`}
                target="_blank"
                rel="noreferrer"
                className={BOTAO_LINK}
              >
                <Navigation className="h-4 w-4" /> Mapa
              </a>
              {parada.cliente_telefone && (
                <>
                  <a href={`tel:${parada.cliente_telefone}`} className={BOTAO_LINK}>
                    <Phone className="h-4 w-4" /> Ligar
                  </a>
                  <a
                    href={buildWhatsAppLink(parada.cliente_telefone)}
                    target="_blank"
                    rel="noreferrer"
                    className={BOTAO_LINK}
                  >
                    <MessageCircle className="h-4 w-4" /> Zap
                  </a>
                </>
              )}
            </div>

            {itens.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-[#F5F6F3] px-3 py-2.5">
                {itens.map((item, i) => (
                  <li key={i} className="text-sm text-[#141B1E]">
                    {textoDoItem(item)}
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="text-xs font-medium text-[#55605F]" htmlFor={`recebeu-${parada.entrega_id}`}>
                Quem recebeu (opcional)
              </label>
              <input
                id={`recebeu-${parada.entrega_id}`}
                value={quemRecebeu[parada.entrega_id] ?? ''}
                onChange={(e) => setQuemRecebeu((q) => ({ ...q, [parada.entrega_id]: e.target.value }))}
                placeholder="Nome de quem pegou"
                className="mt-1 h-12 w-full rounded-xl border border-[#DCDFD8] bg-white px-3 text-base text-[#141B1E] placeholder:text-[#8A9290]"
              />
            </div>

            <DeslizarParaEntregar
              texto="Arraste para entregar"
              carregando={ocupada}
              onConcluir={() => entregar(parada)}
            />

            <button
              type="button"
              onClick={() => setVoltouDe(parada)}
              disabled={ocupada}
              className="w-full py-1 text-sm font-semibold text-[#B5362A] disabled:opacity-50"
            >
              Não consegui entregar
            </button>
          </div>
        )}
      </div>
    );
  };

  // ------------------------------------------------------------ a tela
  return (
    <div className="min-h-screen bg-[#F5F6F3] pb-10">
      <header
        className="sticky top-0 z-10 rounded-b-3xl px-4 pb-4 pt-4 text-white shadow-lg"
        style={{ background: FUNDO_TELA }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/75">Rota de {rota.nome ?? 'hoje'}</p>
            <p className="text-xl font-semibold text-white">
              <span className="font-mono tabular-nums">{entregues}</span> de{' '}
              <span className="font-mono tabular-nums">{paradas.length}</span> entregues
              {voltaram > 0 && (
                <span className="ml-2 text-sm font-normal text-[#FFB4AA]">
                  <span className="font-mono tabular-nums">{voltaram}</span> voltaram
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onSair}
            aria-label="Sair"
            className="rounded-xl border border-white/25 bg-white/10 p-3 text-white active:scale-[0.97]"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/20" aria-hidden>
          <span className="h-full bg-[#4ADE80] transition-all" style={{ width: percentual(entregues) }} />
          <span className="h-full bg-[#FF6B5B] transition-all" style={{ width: percentual(voltaram) }} />
        </div>

        <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/20 bg-white/10 p-1">
          {(['rota', 'carga'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              aria-pressed={aba === a}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                aba === a ? 'bg-white text-[hsl(var(--primary))]' : 'text-white/80'
              }`}
            >
              {a === 'rota' ? 'Rota' : 'Carga do dia'}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-2.5 px-4 pt-4">
        {erro && <p className="text-sm font-medium text-[#B5362A]">{erro}</p>}

        {paradas.length === 0 && (
          <div className="rounded-2xl border border-[#DCDFD8] bg-white p-6 text-center">
            <p className="font-medium text-[#141B1E]">{rota.mensagem ?? 'Nenhuma rota montada para hoje.'}</p>
            <p className="mt-1 text-sm text-[#8A9290]">Quando a loja montar a rota, ela aparece aqui.</p>
          </div>
        )}

        {aba === 'rota' && paradas.length > 0 && (
          <>
            {pendentes.length === 0 && (
              <div className="rounded-2xl border border-[#DCDFD8] bg-white p-6 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#2F9E44] text-white">
                  <Check className="h-6 w-6" />
                </span>
                <p className="mt-3 text-lg font-semibold text-[#141B1E]">Rota concluída</p>
                <p className="text-sm text-[#55605F]">Todas as paradas foram resolvidas. Bom trabalho!</p>
              </div>
            )}

            {pendentes.map((p) => (
              <div key={p.entrega_id}>{cartao(p)}</div>
            ))}

            {resolvidas.length > 0 && (
              <>
                <p className="px-1 pt-3 text-xs font-bold uppercase tracking-wider text-[#8A9290]">Já resolvidas</p>
                {resolvidas.map((p) => (
                  <div
                    key={p.entrega_id}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#DCDFD8] bg-[#ECEEE9] px-4 py-2.5"
                  >
                    <span className="font-mono text-base font-semibold tabular-nums text-[#8A9290]">
                      {String(posicao.get(p.entrega_id) ?? 0).padStart(2, '0')}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[#8A9290] line-through">{p.cliente_nome}</p>
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-wider ${
                        p.situacao === 'entregue' ? 'text-[#2F9E44]' : 'text-[#B5362A]'
                      }`}
                    >
                      {p.situacao === 'entregue' ? 'entregue' : 'voltou'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {aba === 'carga' && paradas.length > 0 && (
          <>
            <p className="px-1 text-sm text-[#55605F]">
              Tudo o que vai no carro, somado.{' '}
              <span className="font-mono tabular-nums">{carregados.size}</span> de{' '}
              <span className="font-mono tabular-nums">{carga.length}</span> carregados. Toque no quadrado para
              marcar; toque no nome para ver a divisão por cliente.
            </p>
            {carga.length === 0 && (
              <p className="rounded-2xl border border-[#DCDFD8] bg-white p-5 text-center text-sm text-[#55605F]">
                As entregas desta rota não trazem itens cadastrados.
              </p>
            )}
            {carga.map((produto) => {
              const marcado = carregados.has(produto.chave);
              const aberto = abertosDaCarga.has(produto.chave);
              return (
                <div key={produto.chave} className="overflow-hidden rounded-2xl border border-[#DCDFD8] bg-white">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => marcarCarregado(produto.chave)}
                      aria-label={marcado ? 'Desmarcar como carregado' : 'Marcar como carregado'}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 ${
                        marcado ? 'border-[#2F9E44] bg-[#2F9E44] text-white' : 'border-[#8A9290] text-transparent'
                      }`}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarProduto(produto.chave)}
                      aria-expanded={aberto}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate font-medium ${
                          marcado ? 'text-[#8A9290] line-through' : 'text-[#141B1E]'
                        }`}
                      >
                        {produto.nome}
                      </span>
                      <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-[#141B1E]">
                        {produto.total === null ? '—' : produto.total}
                        {produto.unidade && (
                          <span className="ml-1 text-xs font-normal text-[#8A9290]">{produto.unidade}</span>
                        )}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-[#8A9290] transition ${aberto ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {aberto && (
                    <ul className="space-y-1 border-t border-[#DCDFD8] px-4 py-2.5 text-sm text-[#55605F]">
                      {produto.porCliente.map((c, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">{c.cliente}</span>
                          <span className="font-mono font-semibold tabular-nums text-[#141B1E]">
                            {c.quantidade ?? '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Dizer o que o sistema grava, em texto, na tela dele. Controle que a
            pessoa não conhece não muda comportamento — só serve pra pegá-la
            depois, e isso não é o que este módulo existe pra fazer. */}
        <p className="mt-6 rounded-xl bg-[#ECEEE9] px-4 py-3 text-xs leading-relaxed text-[#55605F]">
          A localização é gravada só no momento que você marca a entrega. O sistema não acompanha seu
          trajeto, nem sabe por onde você passou ou onde almoçou.
        </p>
      </div>

      {/* --------------------------------------- por que não deu (folha de baixo) */}
      {voltouDe && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/50" onClick={fecharMotivo}>
          <div
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-semibold text-[#141B1E]">Por que não deu para entregar?</p>
            <p className="text-sm text-[#55605F]">{voltouDe.cliente_nome}</p>
            <div className="mt-3 grid gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`min-h-14 rounded-2xl border px-4 text-left text-base transition active:scale-[0.99] ${
                    motivo === m
                      ? 'border-[#B5362A] bg-[#B5362A]/10 font-semibold text-[#B5362A]'
                      : 'border-[#DCDFD8] bg-white text-[#141B1E]'
                  }`}
                >
                  {MOTIVO_LABEL[m]}
                </button>
              ))}
            </div>

            {motivo === 'outro' && (
              <input
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                placeholder="Escreva o que aconteceu"
                className="mt-3 h-14 w-full rounded-2xl border border-[#DCDFD8] bg-white px-4 text-lg text-[#141B1E] placeholder:text-[#8A9290]"
              />
            )}

            <button
              type="button"
              onClick={naoEntregar}
              disabled={
                enviando !== null || !motivo || (motivo === 'outro' && motivoTexto.trim() === '')
              }
              className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-[#B5362A] text-lg font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            >
              {enviando !== null ? 'Registrando...' : !motivo ? 'Escolha o motivo' : 'Confirmar que não deu'}
            </button>
            <button type="button" onClick={fecharMotivo} className="mt-2 w-full py-3 text-sm font-semibold text-[#55605F]">
              Cancelar
            </button>
            <p className="mt-1 text-center text-xs text-[#8A9290]">
              Esta entrega volta pra fila e aparece no topo da rota de amanhã, com o motivo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinhaRota;
