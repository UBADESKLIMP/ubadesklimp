import { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageCircle,
  Check,
  X,
  Navigation,
  LogOut,
} from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
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

const resumoDosItens = (itens: ItemEntrega[]) => {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  return itens
    .map((item) =>
      [item.quantidade, item.unidade, item.descricao].filter(Boolean).join(' ').trim()
    )
    .filter(Boolean);
};

const BOTAO_GRANDE =
  'h-16 rounded-2xl text-lg font-semibold transition active:scale-[0.98] ' +
  'flex items-center justify-center gap-2 disabled:opacity-50';

/**
 * A tela da rua. Dois toques pra marcar, e nada mais: se marcar cada parada
 * for chato, ele deixa pra marcar tudo na volta na loja — e aí o registro
 * perde o sentido, que era justamente nascer onde o fato aconteceu.
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
  const [aberta, setAberta] = useState<ParadaDoEntregador | null>(null);
  const [passo, setPasso] = useState<'parada' | 'entreguei' | 'nao-entreguei'>('parada');
  const [quemRecebeu, setQuemRecebeu] = useState('');
  const [motivo, setMotivo] = useState<EntregaMotivo | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const paradas = rota.paradas ?? [];
  const pendentes = paradas.filter((p) => p.situacao === 'em_rota');
  const feitas = paradas.length - pendentes.length;

  const fechar = () => {
    setAberta(null);
    setPasso('parada');
    setQuemRecebeu('');
    setMotivo(null);
    setMotivoTexto('');
    setErro(null);
  };

  const registrar = async (tipo: 'entregue' | 'nao_entregue') => {
    if (!aberta) return;
    setEnviando(true);
    setErro(null);
    const r = await onRegistrar(aberta.entrega_id, tipo, {
      motivo: tipo === 'nao_entregue' ? (motivo ?? undefined) : undefined,
      motivoTexto: motivoTexto.trim() || undefined,
      quemRecebeu: quemRecebeu.trim() || undefined,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não deu para registrar.');
      return;
    }
    fechar();
  };

  // ------------------------------------------------------------------ lista
  if (!aberta) {
    return (
      <div className="min-h-screen bg-[#F5F6F3] pb-10">
        <header className="sticky top-0 z-10 border-b border-[#DCDFD8] bg-[#F5F6F3]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#55605F]">Rota de {rota.nome ?? 'hoje'}</p>
              <p className="text-xl font-semibold text-[#141B1E]">
                <span className="font-mono tabular-nums">{pendentes.length}</span>{' '}
                {pendentes.length === 1 ? 'parada' : 'paradas'} pra fazer
                {feitas > 0 && (
                  <span className="ml-2 text-sm font-normal text-[#8A9290]">
                    <span className="font-mono tabular-nums">{feitas}</span> já resolvidas
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onSair}
              aria-label="Sair"
              className="rounded-xl border border-[#DCDFD8] bg-white p-3 text-[#55605F] active:scale-[0.97]"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-2.5 px-4 pt-4">
          {paradas.length === 0 && (
            <div className="rounded-2xl border border-[#DCDFD8] bg-white p-6 text-center">
              <p className="font-medium text-[#141B1E]">
                {rota.mensagem ?? 'Nenhuma rota montada para hoje.'}
              </p>
              <p className="mt-1 text-sm text-[#8A9290]">
                Quando a loja montar a rota, ela aparece aqui.
              </p>
            </div>
          )}

          {paradas.map((parada, i) => {
            const resolvida = parada.situacao !== 'em_rota';
            return (
              <button
                key={parada.entrega_id}
                onClick={() => !resolvida && setAberta(parada)}
                disabled={resolvida}
                className={`flex min-h-[4.75rem] w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  resolvida
                    ? 'border-[#DCDFD8] bg-[#ECEEE9] text-[#8A9290]'
                    : 'border-[#DCDFD8] bg-white active:scale-[0.99]'
                }`}
              >
                <span
                  className={`shrink-0 font-mono text-lg font-semibold tabular-nums ${
                    resolvida ? 'text-[#8A9290]' : 'text-primary'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-semibold ${
                      resolvida ? 'line-through' : 'text-[#141B1E]'
                    }`}
                  >
                    {parada.cliente_nome}
                  </p>
                  <p className="truncate text-sm text-[#55605F]">
                    {parada.bairro ?? 'Sem bairro'} ·{' '}
                    {parada.entregar_em || parada.endereco || 'Sem endereço'}
                  </p>
                </div>
                {resolvida ? (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[#2F9E44]">
                    {parada.situacao === 'entregue' ? 'entregue' : 'voltou'}
                  </span>
                ) : (
                  <ArrowLeft className="h-5 w-5 shrink-0 rotate-180 text-[#8A9290]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Dizer o que o sistema grava, em texto, na tela dele. Controle que a
            pessoa não conhece não muda comportamento — só serve pra pegá-la
            depois, e isso não é o que este módulo existe pra fazer. */}
        <p className="mx-4 mt-6 rounded-xl bg-[#ECEEE9] px-4 py-3 text-xs leading-relaxed text-[#55605F]">
          A localização é gravada só no momento que você toca no botão. O sistema não acompanha seu
          trajeto, nem sabe por onde você passou ou onde almoçou.
        </p>
      </div>
    );
  }

  const itens = resumoDosItens(aberta.itens);
  const endereco = aberta.entregar_em || aberta.endereco || 'Sem endereço no cadastro';

  // --------------------------------------------------------------- a parada
  return (
    <div className="min-h-screen bg-[#F5F6F3] pb-10">
      <header className="sticky top-0 z-10 border-b border-[#DCDFD8] bg-[#F5F6F3]/95 px-4 py-3 backdrop-blur">
        <button
          onClick={passo === 'parada' ? fechar : () => setPasso('parada')}
          className="inline-flex items-center gap-2 text-sm text-[#55605F] active:scale-[0.98]"
        >
          <ArrowLeft className="h-5 w-5" />
          {passo === 'parada' ? 'Todas as paradas' : 'Voltar'}
        </button>
      </header>

      <div className="px-4 pt-4">
        <p className="font-mono text-sm tabular-nums text-[#8A9290]">{aberta.documento}</p>
        <h1 className="mt-0.5 text-2xl font-semibold leading-tight text-[#141B1E]">
          {aberta.cliente_nome}
        </h1>

        <p className="mt-2 flex items-start gap-2 text-[#55605F]">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {endereco}
            {aberta.bairro && <span className="block text-sm text-[#8A9290]">{aberta.bairro}</span>}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${endereco}, ${aberta.bairro ?? ''}, Ubatuba SP`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#DCDFD8] bg-white px-4 text-sm font-medium text-[#141B1E] active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" /> Abrir no mapa
          </a>
          {aberta.cliente_telefone && (
            <>
              <a
                href={`tel:${aberta.cliente_telefone}`}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#DCDFD8] bg-white px-4 text-sm font-medium text-[#141B1E] active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" /> Ligar
              </a>
              <a
                href={buildWhatsAppLink(aberta.cliente_telefone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#DCDFD8] bg-white px-4 text-sm font-medium text-[#141B1E] active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </>
          )}
        </div>

        {itens.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-2xl border border-[#DCDFD8] bg-white px-4 py-3">
            {itens.map((item, i) => (
              <li key={i} className="text-sm text-[#55605F]">
                {item}
              </li>
            ))}
          </ul>
        )}

        {erro && <p className="mt-4 text-sm font-medium text-[#B5362A]">{erro}</p>}

        {passo === 'parada' && (
          <div className="mt-6 grid gap-3">
            <button
              onClick={() => setPasso('entreguei')}
              className={`${BOTAO_GRANDE} bg-[#1F7A4C] text-white shadow-lg`}
            >
              <Check className="h-6 w-6" /> Entreguei
            </button>
            <button
              onClick={() => setPasso('nao-entreguei')}
              className={`${BOTAO_GRANDE} border border-[#DCDFD8] bg-white text-[#141B1E]`}
            >
              <X className="h-6 w-6" /> Não deu para entregar
            </button>
          </div>
        )}

        {passo === 'entreguei' && (
          <div className="mt-6">
            <label className="text-sm font-medium text-[#141B1E]">Quem recebeu (opcional)</label>
            <input
              value={quemRecebeu}
              onChange={(e) => setQuemRecebeu(e.target.value)}
              placeholder="Nome de quem pegou"
              className="mt-2 h-14 w-full rounded-2xl border border-[#DCDFD8] bg-white px-4 text-lg text-[#141B1E] placeholder:text-[#8A9290]"
            />
            <p className="mt-2 text-xs text-[#8A9290]">
              Pode deixar em branco. É só pra loja saber com quem falar se o cliente reclamar
              depois.
            </p>
            <button
              onClick={() => registrar('entregue')}
              disabled={enviando}
              className={`${BOTAO_GRANDE} mt-4 w-full bg-[#1F7A4C] text-white shadow-lg`}
            >
              {enviando ? 'Registrando...' : 'Confirmar entrega'}
            </button>
          </div>
        )}

        {passo === 'nao-entreguei' && (
          <div className="mt-6">
            <p className="text-sm font-medium text-[#141B1E]">Por que não deu?</p>
            <div className="mt-2 grid gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
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
              onClick={() => registrar('nao_entregue')}
              disabled={enviando || !motivo || (motivo === 'outro' && motivoTexto.trim() === '')}
              className={`${BOTAO_GRANDE} mt-4 w-full bg-[#B5362A] text-white shadow-lg`}
            >
              {enviando
                ? 'Registrando...'
                : !motivo
                  ? 'Escolha o motivo'
                  : 'Confirmar que não deu'}
            </button>
            <p className="mt-2 text-xs text-[#8A9290]">
              Esta entrega volta pra fila e aparece no topo da rota de amanhã, com o motivo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinhaRota;
