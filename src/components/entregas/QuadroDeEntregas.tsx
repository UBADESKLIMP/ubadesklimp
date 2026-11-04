import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CheckCircle2, GripVertical, XCircle } from 'lucide-react';
import { emReais, type EntregaDaFila, type ParadaDaRota, type ResultadoRpc } from '@/hooks/useEntregas';
import { nomeCurto } from '@/lib/nomeCurto';

/**
 * Quadro de três colunas para mexer nas entregas arrastando: Na fila, A caminho
 * e Resolvidas hoje. Cada arrasto chama a mesma regra do painel de hoje, e todos
 * dá para desfazer arrastando de volta:
 *   fila → a caminho    = manda para a rota de hoje
 *   a caminho → fila    = tira da rota
 *   resolvida → a caminho = reverte uma marcação errada (fica registrado)
 */

type Coluna = 'fila' | 'rota' | 'feitas';

interface CartaoDoQuadro {
  id: string;
  coluna: Coluna;
  /** id que cada regra precisa: entrega (fila) ou parada (rota e resolvidas). */
  alvo: string;
  titulo: string;
  linha2: string;
  valor: number | null;
  resultado?: 'entregue' | 'voltou';
  hora?: string | null;
}

interface Props {
  fila: EntregaDaFila[];
  paradas: ParadaDaRota[];
  onParaRota: (entregaId: string) => Promise<ResultadoRpc>;
  onParaFila: (paradaId: string) => Promise<ResultadoRpc>;
  onReverter: (paradaId: string) => Promise<ResultadoRpc>;
}

// As cores vêm das variáveis do painel (adm-*), então o quadro acompanha qualquer
// um dos quatro visuais.
const VIDRO_CARTAO = 'rounded-xl border border-adm-line bg-adm-surface shadow-sm';

/** Celular e tablet (dedo): o arrasto só começa pela alça, para o dedo que rola a tela não carregar um cartão. */
const usaToque = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const CartaoArrastavel = ({ cartao, fantasma = false }: { cartao: CartaoDoQuadro; fantasma?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cartao.id, data: cartao });
  const [toque] = useState(usaToque);
  const pegada = fantasma ? {} : { ...listeners, ...attributes };
  const listra =
    cartao.resultado === 'entregue' ? '#2F9E44' : cartao.resultado === 'voltou' ? '#C0392B' : 'var(--adm-accent)';

  return (
    <div
      ref={fantasma ? undefined : setNodeRef}
      // No computador o cartão inteiro é a pegada; no celular, só a alça.
      {...(toque ? {} : pegada)}
      className={`relative select-none overflow-hidden py-3 pr-3.5 ${toque ? 'pl-3 touch-pan-y' : 'cursor-grab touch-none pl-3.5 active:cursor-grabbing'} ${VIDRO_CARTAO} ${
        isDragging && !fantasma ? 'opacity-30' : ''
      } ${
        fantasma
          ? 'rotate-[-2deg] scale-[1.04] bg-popover text-popover-foreground shadow-[0_18px_40px_rgba(0,0,0,0.35)]'
          : 'transition hover:-translate-y-0.5'
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: listra }} />
      {toque && !fantasma && (
        <button
          type="button"
          aria-label="Segurar e arrastar"
          {...pegada}
          className="absolute inset-y-0 right-0 flex w-11 touch-none items-center justify-center border-l border-adm-line text-adm-faint active:bg-adm-accent-soft"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <div className={`flex items-start justify-between gap-2 ${toque && !fantasma ? 'pr-10' : ''}`}>
        <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-adm-ink">{nomeCurto(cartao.titulo)}</p>
        {cartao.resultado === 'entregue' && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2F9E44]" />}
        {cartao.resultado === 'voltou' && <XCircle className="h-4 w-4 shrink-0 text-[#C0392B]" />}
      </div>
      <p className="mt-0.5 truncate text-xs text-adm-muted">{cartao.linha2}</p>
      <div className={`mt-2 flex items-center justify-between text-xs ${toque && !fantasma ? 'pr-10' : ''}`}>
        <span className="font-mono tabular-nums text-adm-muted">{cartao.hora ?? ''}</span>
        <span className="font-mono tabular-nums text-adm-ink">{emReais(cartao.valor)}</span>
      </div>
    </div>
  );
};

const ColunaDoQuadro = ({
  id,
  titulo,
  dica,
  cartoes,
  destacar,
}: {
  id: Coluna;
  titulo: string;
  dica: string;
  cartoes: CartaoDoQuadro[];
  destacar: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[16rem] flex-col rounded-2xl border bg-adm-bg p-3 transition-colors ${
        destacar && isOver
          ? 'border-adm-accent bg-adm-accent-soft'
          : destacar
            ? 'border-dashed border-adm-accent-line'
            : 'border-adm-line'
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <p className="text-sm font-semibold text-adm-ink">{titulo}</p>
        <span className="font-mono text-xs tabular-nums text-adm-muted">{cartoes.length}</span>
      </div>
      <div className="flex max-h-[26rem] flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {cartoes.length === 0 ? (
          <p className="m-auto px-3 py-6 text-center text-xs text-adm-faint">{dica}</p>
        ) : (
          cartoes.map((c) => <CartaoArrastavel key={c.id} cartao={c} />)
        )}
      </div>
    </div>
  );
};

const QuadroDeEntregas = ({ fila, paradas, onParaRota, onParaFila, onReverter }: Props) => {
  const [arrastando, setArrastando] = useState<CartaoDoQuadro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // No celular o arrasto só começa na alça do cartão, depois de um toque curto e firme.
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const daFila: CartaoDoQuadro[] = fila.map((e) => ({
    id: `fila:${e.id}`,
    coluna: 'fila',
    alvo: e.id,
    titulo: e.cliente_nome,
    linha2: [e.documento_tipo, e.documento_numero].filter(Boolean).join(' ') + (e.bairro ? ` · ${e.bairro}` : ''),
    valor: e.valor,
  }));
  const daRota: CartaoDoQuadro[] = paradas
    .filter((p) => p.situacao === 'em_rota')
    .map((p) => ({
      id: `rota:${p.parada_id}`,
      coluna: 'rota',
      alvo: p.parada_id,
      titulo: p.cliente_nome,
      linha2: [p.documento, p.bairro].filter(Boolean).join(' · '),
      valor: p.valor,
    }));
  const resolvidas: CartaoDoQuadro[] = paradas
    .filter((p) => p.situacao === 'entregue' || p.situacao === 'nao_entregue')
    .map((p) => ({
      id: `feitas:${p.parada_id}`,
      coluna: 'feitas',
      alvo: p.parada_id,
      titulo: p.cliente_nome,
      linha2: [p.documento, p.bairro].filter(Boolean).join(' · '),
      valor: p.valor,
      resultado: p.situacao === 'entregue' ? 'entregue' : 'voltou',
      hora: p.evento?.hora,
    }));

  const aoComecar = (e: DragStartEvent) => setArrastando((e.active.data.current as CartaoDoQuadro) ?? null);

  const aoSoltar = async (e: DragEndEvent) => {
    setArrastando(null);
    const origem = e.active.data.current as CartaoDoQuadro | undefined;
    const destino = e.over?.id as Coluna | undefined;
    if (!origem || !destino || origem.coluna === destino) return;

    let acao: (() => Promise<ResultadoRpc>) | null = null;
    if (origem.coluna === 'fila' && destino === 'rota') acao = () => onParaRota(origem.alvo);
    if (origem.coluna === 'rota' && destino === 'fila') acao = () => onParaFila(origem.alvo);
    if (origem.coluna === 'feitas' && destino === 'rota') acao = () => onReverter(origem.alvo);

    if (!acao) {
      setAviso(
        destino === 'feitas'
          ? 'Quem marca como entregue é o motorista, pelo celular dele.'
          : 'Esse movimento não existe: use fila → a caminho, a caminho → fila ou resolvida → a caminho.'
      );
      return;
    }

    setOcupado(true);
    setAviso(null);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não deu para mover.');
  };

  // As colunas onde este cartão pode cair se acendem enquanto ele é arrastado.
  const destinoValido = (coluna: Coluna) =>
    !!arrastando &&
    ((arrastando.coluna === 'fila' && coluna === 'rota') ||
      (arrastando.coluna === 'rota' && coluna === 'fila') ||
      (arrastando.coluna === 'feitas' && coluna === 'rota'));

  return (
    <div className={ocupado ? 'pointer-events-none opacity-70 transition-opacity' : 'transition-opacity'}>
      <DndContext sensors={sensors} onDragStart={aoComecar} onDragEnd={aoSoltar} onDragCancel={() => setArrastando(null)}>
        <div className="grid gap-4 md:grid-cols-3">
          <ColunaDoQuadro id="fila" titulo="Na fila" dica="Nada esperando. Importe pedidos na aba Importar." cartoes={daFila} destacar={destinoValido('fila')} />
          <ColunaDoQuadro id="rota" titulo="A caminho" dica="Arraste uma entrega da fila para cá." cartoes={daRota} destacar={destinoValido('rota')} />
          <ColunaDoQuadro id="feitas" titulo="Resolvidas hoje" dica="O que o motorista marcar aparece aqui." cartoes={resolvidas} destacar={false} />
        </div>
        {/* No body: um pai com vidro desfocado (backdrop-filter) vira o referencial do
            "fixed" e o fantasma sairia do lugar do mouse. */}
        {createPortal(
          <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {arrastando ? <CartaoArrastavel cartao={arrastando} fantasma /> : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
      {aviso && <p className="mt-3 text-sm text-adm-alert">{aviso}</p>}
    </div>
  );
};

export default QuadroDeEntregas;
