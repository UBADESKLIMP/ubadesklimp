import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Phone, MessageCircle } from 'lucide-react';
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

const SortableParada = ({
  parada,
  posicao,
  podeArrastar,
}: {
  parada: ParadaDaRota;
  posicao: number;
  podeArrastar: boolean;
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
      className={`rounded-lg border px-3 py-2.5 transition ${
        isDragging ? 'border-blue-500/60 bg-blue-600/10 shadow-lg' : 'border-blue-500/10'
      } ${resolvida ? 'opacity-70' : ''}`}
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
        <span className="mt-0.5 shrink-0 font-mono text-sm font-semibold tabular-nums text-blue-400">
          {String(posicao).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white truncate">{parada.cliente_nome}</span>
            <SeloEntrega situacao={parada.situacao} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-blue-300/55">
            <span className="font-mono tabular-nums">{parada.documento}</span>
            <span className="font-mono tabular-nums">{emReais(parada.valor)}</span>
            {parada.bairro && <span>{parada.bairro}</span>}
          </div>

          <p className="mt-1 inline-flex items-start gap-1 text-xs text-blue-300/70">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{parada.entregar_em || parada.endereco || 'Sem endereço no cadastro'}</span>
          </p>

          {itens && <p className="mt-1 text-xs text-blue-300/40">{itens}</p>}

          {parada.cliente_telefone && (
            <div className="mt-2 flex items-center gap-3">
              <a
                href={`tel:${parada.cliente_telefone}`}
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Phone className="h-3 w-3" /> Ligar
              </a>
              <a
                href={buildWhatsAppLink(parada.cliente_telefone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
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
      </div>
    </div>
  );
};

export default SortableParada;
