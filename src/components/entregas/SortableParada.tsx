import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Phone, MessageCircle, X } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { SeloEntrega } from './SeloEntrega';
import { MOTIVO_LABEL, emReais, type ItemEntrega, type ParadaDaRota } from '@/hooks/useEntregas';

const resumoDosItens = (itens: ItemEntrega[]) => {
  if (!Array.isArray(itens) || itens.length === 0) return null;
  return itens
    .map((item) =>
      [item.quantidade, item.unidade, item.descricao].filter(Boolean).join(' ').trim()
    )
    .filter(Boolean)
    .join(' · ');
};

const BORDA_DA_SITUACAO: Record<string, string> = {
  entregue: 'border-l-[#2F9E44]',
  nao_entregue: 'border-l-[#C0392B]',
  em_rota: 'border-l-[#f0b429]',
};

const SortableParada = ({
  parada,
  posicao,
  podeArrastar,
  onTirar,
}: {
  parada: ParadaDaRota;
  posicao: number;
  podeArrastar: boolean;
  /** Só existe para parada ainda em rota: tira da rota de hoje e volta para a fila. */
  onTirar?: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: parada.parada_id,
    disabled: !podeArrastar,
  });

  const resolvida = parada.situacao === 'entregue' || parada.situacao === 'nao_entregue';
  const itens = resumoDosItens(parada.itens);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-l-4 bg-adm-surface px-4 py-3 shadow-sm transition ${
        isDragging ? 'border-adm-accent shadow-lg' : 'border-adm-line'
      } ${BORDA_DA_SITUACAO[parada.situacao] ?? ''} ${resolvida ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        {podeArrastar ? (
          <button
            {...attributes}
            {...listeners}
            aria-label={`Mover ${parada.cliente_nome} de lugar`}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-blue-300/40 hover:text-blue-300 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : (
          <span className="mt-0.5 h-5 w-5 shrink-0" />
        )}

        {/* O número da parada é dado, não enfeite: é por ele que a loja fala
            com o entregador no telefone ("você já passou da 7?"). */}
        <span className="mt-0.5 shrink-0 font-mono text-base font-semibold tabular-nums text-adm-accent">
          {String(posicao).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-adm-ink">{parada.cliente_nome}</span>
            <SeloEntrega situacao={parada.situacao} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-blue-300/55">
            <span className="font-mono tabular-nums">{parada.documento}</span>
            <span className="font-mono tabular-nums">{emReais(parada.valor)}</span>
            {parada.bairro && <span>{parada.bairro}</span>}
          </div>

          <p className="mt-1.5 inline-flex items-start gap-1 text-sm text-adm-ink">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{parada.entregar_em || parada.endereco || 'Sem endereço no cadastro'}</span>
          </p>

          {itens && <p className="mt-1 text-xs text-blue-300/40">{itens}</p>}

          {parada.cliente_telefone && (
            <div className="mt-2 flex items-center gap-3">
              <a
                href={`tel:${parada.cliente_telefone}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-adm-line px-3 text-sm font-medium text-adm-ink hover:bg-adm-accent-soft"
              >
                <Phone className="h-4 w-4" /> Ligar
              </a>
              <a
                href={buildWhatsAppLink(parada.cliente_telefone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-adm-line px-3 text-sm font-medium text-adm-ink hover:bg-adm-accent-soft"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          )}

          {parada.evento && (
            <div className="mt-2 rounded-md border border-blue-500/10 bg-[#0c0c14] px-2.5 py-2 text-xs">
              {parada.evento.tipo === 'entregue' ? (
                <p className="text-[#2F9E44]">
                  Entregue às{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {parada.evento.hora}
                  </span>
                  {parada.evento.quem_recebeu && ` · recebeu: ${parada.evento.quem_recebeu}`}
                </p>
              ) : (
                <p className="text-[#ff8a7a]">
                  Não entregue às{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {parada.evento.hora}
                  </span>
                  {parada.evento.motivo && ` · ${MOTIVO_LABEL[parada.evento.motivo]}`}
                  {parada.evento.motivo_texto && ` — ${parada.evento.motivo_texto}`}
                </p>
              )}

              {/* Dizer o que a coordenada prova, e o que não prova. Sem isso a
                  tela vira acusação, e o GPS de condomínio cai na portaria. */}
              {parada.evento.lat != null && parada.evento.lng != null && (
                <p className="mt-1 text-blue-300/40">
                  Local informado pelo aparelho:{' '}
                  <a
                    href={`https://www.google.com/maps?q=${parada.evento.lat},${parada.evento.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono tabular-nums text-blue-400 hover:text-blue-300"
                  >
                    {parada.evento.lat.toFixed(5)}, {parada.evento.lng.toFixed(5)}
                  </a>
                  {parada.evento.precisao_m != null &&
                    ` · margem de ${Math.round(parada.evento.precisao_m)} m`}
                </p>
              )}
            </div>
          )}
        </div>
        {onTirar && (
          <button
            type="button"
            onClick={onTirar}
            title="Tirar da rota de hoje (volta para a fila)"
            aria-label={`Tirar ${parada.cliente_nome} da rota de hoje`}
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-adm-muted transition hover:bg-adm-alert-soft hover:text-adm-alert"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SortableParada;
