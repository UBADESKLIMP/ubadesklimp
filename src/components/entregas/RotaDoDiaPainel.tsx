import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowDownUp, MapPinned, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import SortableParada from './SortableParada';
import { diaCurto, type ParadaDaRota, type ResultadoRpc, type RotaDoDia } from '@/hooks/useEntregas';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

interface Props {
  rota: RotaDoDia | null;
  carregando: boolean;
  data: string;
  onInverter: () => Promise<ResultadoRpc>;
  onMover: (nova: ParadaDaRota[]) => Promise<ResultadoRpc>;
  onRecarregar: () => void;
  onIrParaFila: () => void;
}

/**
 * A rota do dia e a tela ao vivo da loja são a mesma coisa: a lista recarrega
 * sozinha a cada 30s. Fazer duas telas com a mesma informação é o tipo de coisa
 * que ninguém mantém — e a segunda sempre fica desatualizada.
 */
const RotaDoDiaPainel = ({
  rota,
  carregando,
  data,
  onInverter,
  onMover,
  onRecarregar,
  onIrParaFila,
}: Props) => {
  const [mexendo, setMexendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (carregando && !rota) return <AdminLoadingState label="Carregando a rota..." />;

  if (!rota?.existe) {
    return (
      <AdminEmptyState
        icon={MapPinned}
        title={`Nenhuma rota montada para ${diaCurto(data)}`}
        description="Escolha as entregas na aba Fila e monte a rota. Ela aparece no celular do entregador na hora."
        action={
          <Button onClick={onIrParaFila} className="bg-blue-600 hover:bg-blue-500 text-white">
            Ir para a fila
          </Button>
        }
      />
    );
  }

  const paradas = rota.paradas ?? [];
  const feitas = paradas.filter((p) => p.situacao === 'entregue').length;
  const falharam = paradas.filter((p) => p.situacao === 'nao_entregue').length;
  const faltam = paradas.length - feitas - falharam;

  const arrastou = async (evento: DragEndEvent) => {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const de = paradas.findIndex((p) => p.parada_id === active.id);
    const para = paradas.findIndex((p) => p.parada_id === over.id);
    if (de < 0 || para < 0) return;

    setMexendo(true);
    setAviso(null);
    const r = await onMover(arrayMove(paradas, de, para));
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não conseguimos guardar a nova ordem.');
  };

  const inverter = async () => {
    setMexendo(true);
    setAviso(null);
    const r = await onInverter();
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não conseguimos inverter a rota.');
  };

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-white">
                Rota de {diaCurto(data)}
                {rota.invertida && ' · do sul para o norte'}
              </CardTitle>
              <p className="mt-1 text-xs text-blue-300/50">
                <span className="font-mono tabular-nums">{paradas.length}</span> paradas ·{' '}
                <span className="font-mono tabular-nums text-[#2F9E44]">{feitas}</span> entregues ·{' '}
                <span className="font-mono tabular-nums text-[#C0392B]">{falharam}</span> voltaram ·{' '}
                <span className="font-mono tabular-nums">{faltam}</span> a caminho
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onRecarregar}
                className="h-11 border-blue-500/30 bg-[#0c0c14] text-blue-300 hover:bg-blue-600/10"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button
                onClick={inverter}
                disabled={mexendo || paradas.length < 2}
                className="h-11 bg-blue-600 text-white hover:bg-blue-500"
              >
                <ArrowDownUp className="mr-2 h-4 w-4" />
                {rota.invertida ? 'Voltar à ordem normal' : 'Começar pelo fim'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-blue-300/40">
            Atualiza sozinha a cada 30 segundos. Arraste pelo punho à esquerda para mudar a ordem —
            inverter depois não desfaz o seu arrasto.
          </p>
        </CardHeader>

        <CardContent className="space-y-2">
          {paradas.length === 0 ? (
            <p className="py-6 text-center text-sm text-blue-300/50">
              A rota existe mas está vazia. Escolha as entregas na aba Fila.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={arrastou}>
              <SortableContext
                items={paradas.map((p) => p.parada_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {paradas.map((parada, i) => (
                    <SortableParada
                      key={parada.parada_id}
                      parada={parada}
                      posicao={i + 1}
                      // Parada já resolvida não se arrasta: mexer na ordem do
                      // que já aconteceu não muda nada e só confunde.
                      podeArrastar={parada.situacao === 'em_rota'}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {aviso && <p className="text-sm text-[#ff8a7a]">{aviso}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default RotaDoDiaPainel;
